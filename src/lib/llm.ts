import {
  type CurrencyCode,
  type DealPosition,
  type FreelanceMediationSummary,
  type PartyRole,
  type PartyTerms,
  type PublicDealPosition,
  formatMoney,
} from "./midpoint.ts";
import {
  type MediationCopyResult,
  buildFallbackMediationCopy,
  isLegacyMediationRationale,
  stripLongDashes,
} from "./mediation-copy.ts";

export {
  buildFallbackMediationCopy,
  isLegacyMediationRationale,
  stripLongDashes,
};
export type { MediationCopyResult };

/**
 * Strips private walk-away reservation limits and internal hourly benchmarks
 * so neither party's secret floor/ceiling is ever transmitted to the browser.
 */
export function stripPrivateFields(pos: DealPosition): PublicDealPosition {
  return {
    budget: pos.budget,
    hours: pos.hours,
    depositPct: pos.depositPct,
    netDays: pos.netDays,
    revisions: pos.revisions,
    platformFeePct: pos.platformFeePct,
    flags: pos.flags ?? [],
    reason: pos.reason ?? "",
  };
}

const FORBIDDEN_JARGON = [
  "batna",
  "zopa",
  "topa",
  "schelling",
  "chatterjee",
  "samuelson",
  "kalai",
  "smorodinsky",
  "reservation price",
  "reservation value",
];

const PLACEHOLDER_REGEX =
  /\[(?:your|client|developer|recipient|party|company|name|date|time|insert|enter|add|fill)[^\]]*\]/i;

function containsForbiddenJargon(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_JARGON.some((term) => lower.includes(term));
}

function leaksReservationNumber(
  text: string,
  devReservation: number | undefined,
  clientReservation: number | undefined,
  allowedPublicNumbers: number[]
): boolean {
  const normalizedText = text.replace(/[,._]/g, "");
  const allowedSet = new Set(
    allowedPublicNumbers
      .filter((n) => Number.isFinite(n))
      .map((n) => Math.round(n))
  );

  const devRes = typeof devReservation === "number" ? Math.round(devReservation) : 0;
  const clientRes =
    typeof clientReservation === "number" ? Math.round(clientReservation) : 0;
  const privateReservationGap =
    devRes > 0 && clientRes > 0 ? Math.round(Math.abs(devRes - clientRes)) : 0;

  const candidates = [devRes, clientRes, privateReservationGap];

  for (const secret of candidates) {
    if (secret <= 0 || allowedSet.has(secret)) {
      continue;
    }
    const secretStr = String(secret);
    if (secretStr.length >= 3 && normalizedText.includes(secretStr)) {
      return true;
    }
  }
  return false;
}

/**
 * Shared DeepSeek-V4.1-Flash (`deepseek-flash`) JSON completion helper with
 * privacy, jargon, placeholder, and long-dash guardrails.
 */
async function callDeepSeekCopy(options: {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  timeoutMs: number;
  fallback: MediationCopyResult;
  developerReservation?: number;
  clientReservation?: number;
  allowedPublicNumbers: number[];
  requireDraftOnlyCheck?: boolean;
}): Promise<{ result: MediationCopyResult; source: "deepseek" | "fallback" }> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const baseUrl = (
    process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com"
  ).replace(/\/+$/, "");
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-flash";

  if (!apiKey) {
    return { result: options.fallback, source: "fallback" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: options.temperature,
        max_tokens: 1600,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: options.systemPrompt },
          { role: "user", content: options.userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { result: options.fallback, source: "fallback" };
    }

    const data = await response.json();
    const rawContent: string | undefined =
      data?.choices?.[0]?.message?.content;

    if (!rawContent) {
      return { result: options.fallback, source: "fallback" };
    }

    const parsed = JSON.parse(rawContent) as Partial<MediationCopyResult>;
    const rawRationale =
      typeof parsed.rationale === "string"
        ? stripLongDashes(parsed.rationale)
        : "";
    const rationale =
      rawRationale || (options.requireDraftOnlyCheck ? options.fallback.rationale : "");
    const draftMessage =
      typeof parsed.draftMessage === "string"
        ? stripLongDashes(parsed.draftMessage)
        : "";

    if (!rationale || !draftMessage || PLACEHOLDER_REGEX.test(draftMessage)) {
      return { result: options.fallback, source: "fallback" };
    }

    const combined = `${rationale} ${draftMessage}`;
    if (
      containsForbiddenJargon(combined) ||
      leaksReservationNumber(
        combined,
        options.developerReservation,
        options.clientReservation,
        options.allowedPublicNumbers
      )
    ) {
      return { result: options.fallback, source: "fallback" };
    }

    return { result: { rationale, draftMessage }, source: "deepseek" };
  } catch {
    clearTimeout(timeout);
    return { result: options.fallback, source: "fallback" };
  }
}

/**
 * Generates both rationale (Verdict Card) and initial draftMessage when both parties reveal.
 */
export async function generateMediationCopy(params: {
  projectTitle: string;
  currency: CurrencyCode;
  developer: PartyTerms;
  client: PartyTerms;
  summary: FreelanceMediationSummary;
}): Promise<MediationCopyResult> {
  const fallback = buildFallbackMediationCopy(params);
  const { projectTitle, currency, developer, client, summary } = params;

  const devOfferFmt = formatMoney(developer.budget, currency);
  const clientOfferFmt = formatMoney(client.budget, currency);
  const settlementFmt =
    summary.settlement !== null ? formatMoney(summary.settlement, currency) : null;
  const publicGapFmt = formatMoney(summary.bridgeOptions.publicGap, currency);
  const recommendedBudgetFmt = formatMoney(
    summary.bridgeOptions.recommendedBudget,
    currency
  );
  const recommendedHours = summary.bridgeOptions.recommendedHours;
  const devContext = developer.reason || developer.notes || "Standard delivery scope";
  const clientContext =
    client.reason || client.notes || "Standard budget allocation";

  const allowedPublicNumbers = [
    developer.budget,
    client.budget,
    summary.settlement ?? 0,
    summary.bridgeOptions.publicGap,
    summary.bridgeOptions.recommendedBudget,
  ];

  const systemPrompt = [
    "You are a neutral freelance contract mediator writing concise, plain-English deal explanations and ready-to-send SOW messages.",
    "STRICT RULES:",
    "1. NEVER use academic or technical negotiation jargon such as BATNA, ZOPA, TOPA, Schelling, Chatterjee, Samuelson, Kalai, Smorodinsky, or 'reservation price'. Keep wording simple, natural, and immediately understandable.",
    "2. NEVER use em-dashes (—), en-dashes (–), or double hyphens (--). Use commas, colons, or periods instead.",
    "3. NEVER invent numbers or use placeholders like [Client Name] or [Your Name]. Use only the exact figures provided.",
    "4. Return valid JSON with keys: {\"rationale\": string, \"draftMessage\": string}.",
    "5. 'rationale' must be 2 concise sentences (max 48 words) explaining the verdict clearly.",
    "6. 'draftMessage' must be a polite, ready-to-send SOW proposal message (70 to 120 words) with bulleted commercial terms.",
  ].join("\n");

  const userPayload = summary.hasZopa
    ? {
        outcome: "AGREEMENT_REACHED",
        projectTitle,
        currency,
        agreedSettlement: settlementFmt,
        developerInitialQuote: devOfferFmt,
        clientInitialOffer: clientOfferFmt,
        agreedHours: summary.hours.midpoint,
        agreedDepositPct: summary.depositPct.midpoint,
        agreedNetDays: summary.netDays.midpoint,
        agreedRevisions: summary.revisions.midpoint,
        developerContext: devContext,
        clientContext,
      }
    : {
        outcome: "NO_OVERLAP_YET",
        projectTitle,
        currency,
        developerInitialQuote: devOfferFmt,
        clientInitialOffer: clientOfferFmt,
        publicOfferSpread: publicGapFmt,
        compromiseFullScopeBudget: recommendedBudgetFmt,
        compromiseFullScopeHours: summary.hours.midpoint,
        cappedHoursAtClientBudget: recommendedHours,
        agreedDepositPct: summary.bridgeOptions.targetDepositPct,
        agreedNetDays: summary.bridgeOptions.targetNetDays,
        agreedRevisions: summary.bridgeOptions.maxRevisions,
        developerContext: devContext,
        clientContext,
      };

  const { result } = await callDeepSeekCopy({
    systemPrompt,
    userPrompt: `Generate the mediation rationale and ready-to-send SOW message for this deal:\n${JSON.stringify(
      userPayload,
      null,
      2
    )}`,
    temperature: 0.25,
    timeoutMs: 8500,
    fallback,
    developerReservation: developer.reservation,
    clientReservation: client.reservation,
    allowedPublicNumbers,
  });

  return result;
}

/**
 * Dedicated on-demand LLM generator for the "Generate with AI" button in the Ready-to-Send SOW Draft card.
 */
export async function generatePolishedDraftCopy(params: {
  projectTitle: string;
  currency: CurrencyCode;
  developer: PartyTerms;
  client: PartyTerms;
  summary: FreelanceMediationSummary;
  viewerRole?: PartyRole | null;
  previousDraft?: string | null;
}): Promise<{
  draftMessage: string;
  rationale: string;
  source: "deepseek" | "fallback";
}> {
  const fallback = buildFallbackMediationCopy(params);
  const { projectTitle, currency, developer, client, summary, viewerRole } =
    params;

  const cleanTitle = stripLongDashes(projectTitle || "Freelance Project");
  const devOfferFmt = formatMoney(developer.budget, currency);
  const clientOfferFmt = formatMoney(client.budget, currency);
  const settlementFmt =
    summary.settlement !== null ? formatMoney(summary.settlement, currency) : null;
  const upfrontFmt = formatMoney(
    summary.mediatedEconomics.upfrontAmount,
    currency
  );
  const completionFmt = formatMoney(
    summary.mediatedEconomics.completionAmount,
    currency
  );
  const hourlyGrossFmt = formatMoney(
    summary.mediatedEconomics.effectiveRate ||
      summary.mediatedEconomics.effectiveHourlyGross,
    currency
  );
  const publicGapFmt = formatMoney(summary.bridgeOptions.publicGap, currency);
  const recommendedBudgetFmt = formatMoney(
    summary.bridgeOptions.recommendedBudget,
    currency
  );
  const recommendedHours = summary.bridgeOptions.recommendedHours;
  const devContext =
    developer.reason || developer.notes || "Core engineering & QA deliverables";
  const clientContext =
    client.reason || client.notes || "On-time milestone delivery";

  const allowedPublicNumbers = [
    developer.budget,
    client.budget,
    summary.settlement ?? 0,
    summary.bridgeOptions.publicGap,
    summary.bridgeOptions.recommendedBudget,
    summary.mediatedEconomics.upfrontAmount,
    summary.mediatedEconomics.completionAmount,
  ];

  const perspectiveInstruction =
    viewerRole === "developer"
      ? "Write from the Freelance Developer's perspective addressing the Client."
      : viewerRole === "client"
      ? "Write from the Client's perspective addressing the Freelance Developer."
      : "Write from a collaborative shared perspective that either side can send directly.";

  const systemPrompt = [
    "You are an elite commercial deal advisor and freelance SOW copywriter.",
    "Your job is to write a crisp, persuasive, ready-to-send SOW alignment message and a 2-sentence verdict summary.",
    perspectiveInstruction,
    "STRICT FORMATTING & CONTENT RULES:",
    "1. NO LONG DASHES ALLOWED: Never use em-dashes (—), en-dashes (–), or double hyphens (--). Use commas, colons, or standard bullet points (- ) instead.",
    "2. NO JARGON: Never mention BATNA, ZOPA, TOPA, Schelling, Chatterjee, Samuelson, Kalai, Smorodinsky, game theory, or 'reservation price'.",
    "3. NO PLACEHOLDERS: Never output bracketed placeholders like [Client Name], [Your Name], or [Date]. The message must be 100% ready to paste into Slack, Email, or WhatsApp right now.",
    "4. TONE: Warm, confident, collaborative, and executive-ready. Frame the mediated terms as a win-win path to start building immediately.",
    "5. STRUCTURE OF 'draftMessage':",
    "   - Brief, friendly opening referencing the project title.",
    "   - 3 to 4 clean bullet points (- ) locking in the exact numbers (Total Fee or Bridge Options, Upfront Deposit + Net Payment Schedule, Estimated Hours + Revision Rounds + Hourly Overage Rate).",
    "   - A clear, single-sentence call to action to confirm and kick off.",
    "6. STRUCTURE OF 'rationale':",
    "   - 2 concise sentences (30 to 48 words) explaining why this settlement or bridge option is balanced for both sides.",
    "7. Return valid JSON with exact keys: {\"rationale\": string, \"draftMessage\": string}.",
  ].join("\n");

  const userContext = summary.hasZopa
    ? {
        status: "DEAL_OVERLAP_CONFIRMED",
        projectTitle: cleanTitle,
        agreedTotalFee: settlementFmt,
        effectiveHourlyRate: `${hourlyGrossFmt}/hr`,
        agreedHours: `${summary.hours.midpoint} hours`,
        upfrontDeposit:
          summary.depositPct.midpoint > 0
            ? `${summary.depositPct.midpoint}% (${upfrontFmt} due before kickoff)`
            : `Milestone split (two equal invoices totaling ${settlementFmt})`,
        completionBalance: `${completionFmt} due on Net ${summary.netDays.midpoint} days`,
        includedRevisions: `${summary.revisions.midpoint} consolidated revision rounds`,
        outOfScopeRate: `${hourlyGrossFmt}/hr with prior written approval`,
        actionPlanHighlights: summary.actionPlan.items.slice(0, 2),
        developerScopeNotes: devContext,
        clientPriorityNotes: clientContext,
      }
    : {
        status: "GAP_BRIDGE_PROPOSAL",
        projectTitle: cleanTitle,
        developerInitialQuote: `${devOfferFmt} (${developer.hours} hrs)`,
        clientInitialOffer: `${clientOfferFmt} (${client.hours} hrs)`,
        publicOfferSpread: publicGapFmt,
        option1FullScopeCompromise: `Meet at ${recommendedBudgetFmt} for ${summary.hours.midpoint} estimated hours (${summary.bridgeOptions.targetDepositPct}% upfront deposit, Net ${summary.bridgeOptions.targetNetDays} days)`,
        option2CapScopeToClientBudget: `Keep budget at ${clientOfferFmt} by capping Phase 1 MVP scope at ${recommendedHours} estimated hours and ${summary.bridgeOptions.maxRevisions} revision rounds`,
        developerScopeNotes: devContext,
        clientPriorityNotes: clientContext,
      };

  const { result, source } = await callDeepSeekCopy({
    systemPrompt,
    userPrompt: `Write the polished SOW message and rationale using these exact mediated figures:\n${JSON.stringify(
      userContext,
      null,
      2
    )}`,
    temperature: 0.35,
    timeoutMs: 9500,
    fallback,
    developerReservation: developer.reservation,
    clientReservation: client.reservation,
    allowedPublicNumbers,
    requireDraftOnlyCheck: true,
  });

  return { ...result, source };
}

export const generatePolishedSowDraft = generatePolishedDraftCopy;
