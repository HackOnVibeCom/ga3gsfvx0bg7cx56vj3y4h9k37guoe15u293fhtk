import { jsPDF } from "jspdf";
import { CURRENCIES, formatMoney, type CurrencyCode } from "./currency";
import {
  buildFallbackMediationCopy,
  isLegacyMediationRationale,
  stripLongDashes,
} from "./mediation-copy";
import type { ConfidenceTier } from "./midpoint";
import type { PublicNegotiationView } from "./store";

type RevealedData = Extract<PublicNegotiationView, { status: "revealed" }>;

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 16;
const CONTENT_W = PAGE_W - MARGIN_X * 2; // 178mm
const FOOTER_RULE_Y = 282.5;
const SAFE_MAX_Y = 279.5;

const COLORS = {
  bg: [7, 9, 13] as const,
  card: [16, 18, 25] as const,
  cardBorder: [30, 34, 49] as const,
  recessed: [9, 11, 16] as const,
  recessedBorder: [34, 38, 54] as const,
  tile: [22, 25, 35] as const,
  tileBorder: [36, 41, 56] as const,
  pillBg: [20, 23, 32] as const,
  white: [255, 255, 255] as const,
  ink100: [241, 241, 241] as const,
  ink300: [180, 184, 200] as const,
  ink500: [152, 152, 152] as const,
  blue: [86, 97, 255] as const,
  lavender: [168, 143, 255] as const,
  mint: [57, 217, 138] as const,
  amber: [255, 184, 0] as const,
  amberFill: [43, 34, 11] as const,
  rose: [255, 133, 184] as const,
};

interface ConfidencePdfTheme {
  label: string;
  accent: readonly [number, number, number];
  badgeFill: readonly [number, number, number];
  glowHex: string;
  baseHex: string;
}

const PDF_CONFIDENCE_THEMES: Record<ConfidenceTier, ConfidencePdfTheme> = {
  close: {
    label: "CLOSE ALIGNMENT",
    accent: [57, 217, 138],
    badgeFill: [14, 48, 37],
    glowHex: "rgba(57, 217, 138, 0.28)",
    baseHex: "#0D2921",
  },
  moderate: {
    label: "MODERATE GAP",
    accent: [255, 184, 0],
    badgeFill: [50, 37, 14],
    glowHex: "rgba(255, 184, 0, 0.28)",
    baseHex: "#2B1D0B",
  },
  wide: {
    label: "WIDE GAP",
    accent: [255, 0, 109],
    badgeFill: [52, 15, 35],
    glowHex: "rgba(255, 0, 109, 0.28)",
    baseHex: "#2E0C20",
  },
  no_overlap: {
    label: "NO OVERLAP",
    accent: [255, 0, 109],
    badgeFill: [52, 15, 35],
    glowHex: "rgba(255, 0, 109, 0.28)",
    baseHex: "#2E0C20",
  },
};

/** Currency codes whose Unicode symbol is absent from the latin Plus Jakarta Sans / Victor Mono subset */
const ISO_FALLBACK_CURRENCIES = new Set([
  "AFN", "AMD", "AZN", "BDT", "CRC", "CZK", "GEL", "GHS", "ILS", "INR",
  "KHR", "KPW", "KRW", "KZT", "LAK", "MNT", "NGN", "PHP", "PLN", "PYG",
  "RUB", "THB", "TRY", "UAH", "VND",
]);

interface CachedAssets {
  fontsLoaded: boolean;
  fonts: Record<string, string>;
  logoDataUrl: string | null;
  logoAspect: number;
}

const assetCache: CachedAssets = {
  fontsLoaded: false,
  fonts: {},
  logoDataUrl: null,
  logoAspect: 4.5,
};

export interface PdfAssetOverrides {
  fonts?: Record<string, string>;
  logoDataUrl?: string | null;
  logoAspect?: number;
}

const FONT_FILES = [
  { file: "PlusJakartaSans-Regular.ttf", family: "PlusJakartaSans", style: "normal" },
  { file: "PlusJakartaSans-Bold.ttf", family: "PlusJakartaSans", style: "bold" },
  { file: "VictorMono-Regular.ttf", family: "VictorMono", style: "normal" },
  { file: "VictorMono-SemiBold.ttf", family: "VictorMono", style: "bold" },
] as const;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadBrowserAssets(): Promise<CachedAssets> {
  if (assetCache.fontsLoaded) return assetCache;

  const [fontEntries, logoResult] = await Promise.all([
    Promise.all(
      FONT_FILES.map(async (f) => {
        try {
          const res = await fetch(`/fonts/${f.file}`);
          if (!res.ok) return [f.file, ""] as const;
          const buf = await res.arrayBuffer();
          return [f.file, arrayBufferToBase64(buf)] as const;
        } catch {
          return [f.file, ""] as const;
        }
      })
    ),
    new Promise<{ dataUrl: string | null; aspect: number }>((resolve) => {
      if (typeof Image === "undefined") {
        resolve({ dataUrl: null, aspect: 4.5 });
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
          const targetW = 420;
          const targetH = Math.max(1, Math.round(targetW / aspect));
          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({ dataUrl: null, aspect });
            return;
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, targetW, targetH);
          resolve({
            dataUrl: canvas.toDataURL("image/png"),
            aspect,
          });
        } catch {
          resolve({ dataUrl: null, aspect: 4.5 });
        }
      };
      img.onerror = () => resolve({ dataUrl: null, aspect: 4.5 });
      img.src = "/logo-full.png";
    }),
  ]);

  for (const [file, b64] of fontEntries) {
    if (b64) assetCache.fonts[file] = b64;
  }
  assetCache.logoDataUrl = logoResult.dataUrl;
  assetCache.logoAspect = logoResult.aspect;
  assetCache.fontsLoaded = true;
  return assetCache;
}

function registerFonts(doc: jsPDF, fonts: Record<string, string>): boolean {
  let allLoaded = true;
  for (const spec of FONT_FILES) {
    const b64 = fonts[spec.file];
    if (!b64) {
      allLoaded = false;
      continue;
    }
    doc.addFileToVFS(spec.file, b64);
    doc.addFont(spec.file, spec.family, spec.style, undefined, "Identity-H");
  }
  return allLoaded;
}

function createGradientStripDataUrl(): string | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 8;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createLinearGradient(0, 0, 800, 0);
  grad.addColorStop(0, "#5661FF");
  grad.addColorStop(0.5, "#B14BFF");
  grad.addColorStop(1, "#FF006D");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 800, 8);
  return canvas.toDataURL("image/png");
}

function createVerdictCardBgDataUrl(theme: ConfidencePdfTheme): string | null {
  if (typeof document === "undefined") return null;
  const w = 900;
  const h = 300;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const baseGrad = ctx.createLinearGradient(0, 0, w, h);
  baseGrad.addColorStop(0, theme.baseHex);
  baseGrad.addColorStop(0.65, "#10131C");
  baseGrad.addColorStop(1, "#101219");
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  const radial = ctx.createRadialGradient(w * 0.16, h * 0.18, 10, w * 0.16, h * 0.18, w * 0.55);
  radial.addColorStop(0, theme.glowHex);
  radial.addColorStop(0.55, "rgba(16, 19, 28, 0.08)");
  radial.addColorStop(1, "rgba(16, 18, 25, 0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, w, h);

  return canvas.toDataURL("image/png");
}

/** Formats money safely for PDF fonts, swapping unsupported rare currency glyphs with ISO code */
function formatPdfMoney(
  amount: number,
  currency: CurrencyCode,
  decimals?: number
): string {
  if (!ISO_FALLBACK_CURRENCIES.has(currency)) {
    return formatMoney(amount, currency, decimals);
  }
  const meta = CURRENCIES[currency];
  const resolvedDecimals = decimals ?? (meta.zeroDecimal ? 0 : 0);
  const absFormatted = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: resolvedDecimals,
    maximumFractionDigits: resolvedDecimals,
  });
  return amount < 0 ? `-${currency} ${absFormatted}` : `${currency} ${absFormatted}`;
}

function sanitizePdfText(text: string): string {
  return text
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/✓/g, "v")
    .replace(/[^\u0009\u000A\u0020-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u20AC]/g, " ")
    .replace(/[ \t]+\n/g, "\n");
}

function setRgbFill(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setRgbDraw(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function setRgbText(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function initDarkPage(doc: jsPDF, stripUrl: string | null) {
  setRgbFill(doc, COLORS.bg);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  if (stripUrl) {
    doc.addImage(stripUrl, "PNG", 0, 0, PAGE_W, 1.3);
  } else {
    setRgbFill(doc, COLORS.blue);
    doc.rect(0, 0, PAGE_W, 1.2, "F");
  }
}

function ensurePageSpace(
  doc: jsPDF,
  currentY: number,
  neededH: number,
  stripUrl: string | null
): number {
  if (currentY + neededH <= SAFE_MAX_Y) return currentY;
  doc.addPage();
  initDarkPage(doc, stripUrl);
  return 16;
}

function drawCheckCircle(doc: jsPDF, cx: number, cy: number) {
  setRgbFill(doc, COLORS.amberFill);
  setRgbDraw(doc, COLORS.amber);
  doc.setLineWidth(0.32);
  doc.circle(cx, cy, 2.1, "FD");

  doc.setLineWidth(0.42);
  doc.line(cx - 0.9, cy + 0.05, cx - 0.25, cy + 0.7);
  doc.line(cx - 0.25, cy + 0.7, cx + 1.0, cy - 0.65);
}

export async function createMediationPdf(
  data: RevealedData,
  shareUrl: string,
  overrides?: PdfAssetOverrides
): Promise<{ doc: jsPDF; filename: string }> {
  const loaded = overrides
    ? {
        fonts: overrides.fonts ?? {},
        logoDataUrl: overrides.logoDataUrl ?? null,
        logoAspect: overrides.logoAspect ?? 4.5,
      }
    : await loadBrowserAssets();

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const hasBrandFonts = registerFonts(doc, loaded.fonts);
  const sans = hasBrandFonts ? "PlusJakartaSans" : "helvetica";
  const mono = hasBrandFonts ? "VictorMono" : "courier";

  const { developer, client, summary, currency, projectTitle, createdAt, id } = data;
  const theme = PDF_CONFIDENCE_THEMES[summary.budget.confidence];
  const settledBudget = summary.budget.midpoint;
  const mediatedEcon = summary.mediatedEconomics;
  const hasOverlap =
    summary.hasZopa && settledBudget !== null && mediatedEcon !== null;
  const gapPctFormatted = `${(summary.budget.gapPct * 100).toFixed(
    summary.budget.gapPct === 0 ? 0 : 1
  )}%`;

  const resolvedCopy = isLegacyMediationRationale(data.rationale)
    ? buildFallbackMediationCopy({
        projectTitle,
        currency,
        developer,
        client,
        summary,
      })
    : { rationale: data.rationale, draftMessage: data.draftMessage };

  const verdictText = sanitizePdfText(stripLongDashes(resolvedCopy.rationale));
  const sowDraftText = sanitizePdfText(stripLongDashes(resolvedCopy.draftMessage));
  const stripUrl = createGradientStripDataUrl();

  initDarkPage(doc, stripUrl);

  // 1. Brand Header (Logo + Session Pill)
  let y = 10;
  if (loaded.logoDataUrl) {
    const logoH = 7.6;
    const logoW = logoH * loaded.logoAspect;
    doc.addImage(loaded.logoDataUrl, "PNG", MARGIN_X, y, logoW, logoH);
  } else {
    doc.setFont(sans, "bold");
    doc.setFontSize(14);
    setRgbText(doc, COLORS.white);
    doc.text("MidPoint", MARGIN_X, y + 6);
  }

  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Right-aligned metadata pill
  const pillLabel = "MEDIATED DEAL SUMMARY";
  doc.setFont(sans, "bold");
  doc.setFontSize(6.5);
  const pillW = doc.getTextWidth(pillLabel) + 7;
  const pillX = PAGE_W - MARGIN_X - pillW;
  setRgbFill(doc, COLORS.pillBg);
  setRgbDraw(doc, COLORS.tileBorder);
  doc.setLineWidth(0.28);
  doc.roundedRect(pillX, y, pillW, 5.2, 2.6, 2.6, "FD");
  setRgbText(doc, COLORS.lavender);
  doc.text(pillLabel, pillX + 3.5, y + 3.45);

  doc.setFont(mono, "normal");
  doc.setFontSize(7.1);
  setRgbText(doc, COLORS.ink500);
  doc.text(
    `Session ${id} · ${formattedDate}`,
    PAGE_W - MARGIN_X,
    y + 9.4,
    { align: "right" }
  );

  // 2. Project Scope Title
  y = 24.5;
  doc.setFont(sans, "bold");
  doc.setFontSize(6.8);
  setRgbText(doc, COLORS.ink500);
  doc.text("PROJECT SCOPE", MARGIN_X, y);

  y += 4.6;
  doc.setFont(sans, "bold");
  doc.setFontSize(14);
  setRgbText(doc, COLORS.white);
  const titleLines = doc.splitTextToSize(sanitizePdfText(projectTitle), CONTENT_W);
  doc.text(titleLines, MARGIN_X, y);
  y += titleLines.length * 5.4 + 1.2;

  setRgbDraw(doc, COLORS.cardBorder);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  y += 3.6;

  // 3. Hero Mediated Verdict Card
  doc.setFont(sans, "normal");
  doc.setFontSize(8.4);
  const verdictLines = doc.splitTextToSize(verdictText, CONTENT_W - 12);
  const verdictCardH = 29.5 + verdictLines.length * 3.85;

  setRgbFill(doc, COLORS.card);
  setRgbDraw(doc, COLORS.tileBorder);
  doc.setLineWidth(0.35);
  doc.roundedRect(MARGIN_X, y, CONTENT_W, verdictCardH, 4, 4, "FD");

  const verdictBgUrl = createVerdictCardBgDataUrl(theme);
  if (verdictBgUrl) {
    doc.addImage(
      verdictBgUrl,
      "PNG",
      MARGIN_X + 0.35,
      y + 0.35,
      CONTENT_W - 0.7,
      verdictCardH - 0.7
    );
    // Crisp top border stroke after image fill
    setRgbDraw(doc, COLORS.tileBorder);
    doc.roundedRect(MARGIN_X, y, CONTENT_W, verdictCardH, 4, 4, "S");
  }

  const cardPad = 6;
  let cy = y + 6.5;

  // Verdict header row
  doc.setFont(sans, "bold");
  doc.setFontSize(7.2);
  setRgbText(doc, COLORS.ink300);
  doc.text("MEDIATED VERDICT", MARGIN_X + cardPad, cy);
  const verdictLblW = doc.getTextWidth("MEDIATED VERDICT");

  doc.setFontSize(6.4);
  const tierW = doc.getTextWidth(theme.label) + 6;
  const tierX = MARGIN_X + cardPad + verdictLblW + 3;
  const badgeTopY = cy - 3.35;
  setRgbFill(doc, theme.badgeFill);
  setRgbDraw(doc, theme.accent);
  doc.setLineWidth(0.25);
  doc.roundedRect(tierX, badgeTopY, tierW, 4.6, 2.3, 2.3, "FD");
  setRgbText(doc, theme.accent);
  doc.text(theme.label, tierX + 3, badgeTopY + 3.05);

  const gapText = hasOverlap
    ? `${gapPctFormatted} budget gap`
    : `Spread: ${formatPdfMoney(summary.bridgeOptions?.publicGap ?? Math.abs(developer.budget - client.budget), currency)}`;
  doc.setFont(mono, "bold");
  doc.setFontSize(7.1);
  const gapW = doc.getTextWidth(gapText) + 6;
  const gapX = PAGE_W - MARGIN_X - cardPad - gapW;
  const gapTopY = cy - 3.5;
  setRgbFill(doc, theme.badgeFill);
  setRgbDraw(doc, theme.accent);
  doc.roundedRect(gapX, gapTopY, gapW, 4.9, 2.45, 2.45, "FD");
  setRgbText(doc, theme.accent);
  doc.text(gapText, gapX + 3, gapTopY + 3.3);

  const rateText =
    hasOverlap && mediatedEcon !== null
      ? formatPdfMoney(mediatedEcon.effectiveRate, currency, 2)
      : null;

  // Key Metrics Row
  cy += 6.2;
  doc.setFont(sans, "normal");
  doc.setFontSize(7.5);
  setRgbText(doc, COLORS.ink300);
  doc.text(
    hasOverlap ? "Fair Mediated Budget" : "Public Offer Spread",
    MARGIN_X + cardPad,
    cy
  );
  setRgbText(doc, COLORS.ink500);
  doc.text(
    hasOverlap ? "Mediated Effective Rate (Net)" : "Public Offer Range",
    PAGE_W - MARGIN_X - cardPad,
    cy,
    {
      align: "right",
    }
  );

  cy += 7.1;
  doc.setFont(mono, "bold");
  doc.setFontSize(22);
  setRgbText(doc, COLORS.white);
  doc.text(
    hasOverlap && settledBudget !== null
      ? formatPdfMoney(settledBudget, currency)
      : formatPdfMoney(
          summary.bridgeOptions?.publicGap ??
            Math.abs(developer.budget - client.budget),
          currency
        ),
    MARGIN_X + cardPad,
    cy
  );

  if (hasOverlap && rateText !== null) {
    doc.setFont(sans, "normal");
    doc.setFontSize(8.2);
    const perHrW = doc.getTextWidth("/hr");
    setRgbText(doc, COLORS.ink500);
    doc.text("/hr", PAGE_W - MARGIN_X - cardPad, cy, { align: "right" });
    doc.setFont(mono, "bold");
    doc.setFontSize(14.5);
    setRgbText(doc, COLORS.ink100);
    doc.text(rateText, PAGE_W - MARGIN_X - cardPad - perHrW - 0.6, cy, {
      align: "right",
    });
  } else {
    doc.setFont(mono, "bold");
    doc.setFontSize(11);
    setRgbText(doc, COLORS.ink100);
    doc.text(
      `${formatPdfMoney(client.budget, currency)} vs ${formatPdfMoney(
        developer.budget,
        currency
      )}`,
      PAGE_W - MARGIN_X - cardPad,
      cy,
      { align: "right" }
    );
  }

  cy += 3.6;
  setRgbDraw(doc, COLORS.tileBorder);
  doc.setLineWidth(0.25);
  doc.line(MARGIN_X + cardPad, cy, PAGE_W - MARGIN_X - cardPad, cy);

  cy += 4.2;
  doc.setFont(sans, "normal");
  doc.setFontSize(8.4);
  setRgbText(doc, COLORS.ink100);
  doc.text(verdictLines, MARGIN_X + cardPad, cy, { lineHeightFactor: 1.38 });

  y += verdictCardH + 3.6;

  // 4. Deal Breakdown Matrix + Visualizer Card
  const matrixRows = [
    {
      label: "Project Budget",
      dev: formatPdfMoney(developer.budget, currency),
      client: formatPdfMoney(client.budget, currency),
      spread: gapPctFormatted,
      midpoint:
        hasOverlap && settledBudget !== null
          ? formatPdfMoney(settledBudget, currency)
          : "No overlap",
      highlight: true,
    },
    {
      label: "Estimated Scope",
      dev: `${developer.hours} hrs`,
      client: `${client.hours} hrs`,
      spread: `${Math.abs(developer.hours - client.hours)} hrs`,
      midpoint: hasOverlap ? `${summary.hours.midpoint} hrs` : "Pending",
      highlight: false,
    },
    {
      label: "Effective Rate (Net)",
      dev: `${formatPdfMoney(summary.developerEconomics.effectiveRate, currency, 2)}/hr`,
      client: `${formatPdfMoney(summary.clientEconomics.effectiveRate, currency, 2)}/hr`,
      spread: `${summary.platformFeePct}% fee`,
      midpoint: rateText !== null ? `${rateText}/hr` : "Pending",
      highlight: true,
    },
    {
      label: "Upfront Deposit",
      dev: `${developer.depositPct}%`,
      client: `${client.depositPct}%`,
      spread: `${Math.abs(developer.depositPct - client.depositPct)} pts`,
      midpoint: hasOverlap
        ? `${summary.depositPct.midpoint}% (${formatPdfMoney(
            summary.depositAmount,
            currency
          )})`
        : "Pending",
      highlight: false,
    },
    {
      label: "Payment Terms",
      dev: `Net ${developer.netDays}`,
      client: `Net ${client.netDays}`,
      spread: `${Math.abs(developer.netDays - client.netDays)} days`,
      midpoint: hasOverlap ? `Net ${summary.netDays.midpoint} days` : "Pending",
      highlight: false,
    },
    {
      label: "Revision Cap",
      dev: `${developer.revisions} ${developer.revisions === 1 ? "round" : "rounds"}`,
      client: `${client.revisions} ${client.revisions === 1 ? "round" : "rounds"}`,
      spread: `${Math.abs(developer.revisions - client.revisions)} ${
        Math.abs(developer.revisions - client.revisions) === 1 ? "round" : "rounds"
      }`,
      midpoint: hasOverlap
        ? `${summary.revisions.midpoint} ${
            summary.revisions.midpoint === 1 ? "round" : "rounds"
          }`
        : "Pending",
      highlight: false,
    },
  ];

  const rowH = 5.9;
  const vizH = 22.8;
  const matrixH = 14.5 + rowH * matrixRows.length + 3 + vizH + 4.5;

  setRgbFill(doc, COLORS.card);
  setRgbDraw(doc, COLORS.cardBorder);
  doc.setLineWidth(0.32);
  doc.roundedRect(MARGIN_X, y, CONTENT_W, matrixH, 4, 4, "FD");

  let my = y + 6.2;
  doc.setFont(sans, "bold");
  doc.setFontSize(7.2);
  setRgbText(doc, COLORS.ink300);
  doc.text("DEAL BREAKDOWN MATRIX", MARGIN_X + cardPad, my);

  doc.setFont(mono, "normal");
  doc.setFontSize(7);
  setRgbText(doc, COLORS.ink500);
  doc.text(
    `Platform / Escrow Fee: ${summary.platformFeePct}%`,
    PAGE_W - MARGIN_X - cardPad,
    my,
    { align: "right" }
  );

  my += 3.5;
  const innerW = CONTENT_W - cardPad * 2;
  const innerX = MARGIN_X + cardPad;
  const colDevX = innerX + 49;
  const colClientX = innerX + 80;
  const colSpreadX = innerX + 111;
  const colMidX = innerX + innerW - 2;

  setRgbFill(doc, COLORS.tile);
  doc.roundedRect(innerX, my, innerW, 6.2, 1.5, 1.5, "F");

  doc.setFont(sans, "bold");
  doc.setFontSize(6.2);
  setRgbText(doc, COLORS.ink500);
  doc.text("PARAMETER", innerX + 2.5, my + 4.1);
  doc.text("DEVELOPER", colDevX, my + 4.1);
  doc.text("CLIENT", colClientX, my + 4.1);
  doc.text("SPREAD", colSpreadX, my + 4.1);
  setRgbText(doc, COLORS.white);
  doc.text("FAIR MIDPOINT", colMidX, my + 4.1, { align: "right" });

  my += 6.2;

  matrixRows.forEach((row, idx) => {
    const rowY = my + idx * rowH;
    if (idx > 0) {
      setRgbDraw(doc, COLORS.cardBorder);
      doc.setLineWidth(0.2);
      doc.line(innerX, rowY, innerX + innerW, rowY);
    }
    const baseline = rowY + 4.2;

    doc.setFont(sans, "normal");
    doc.setFontSize(7.8);
    setRgbText(doc, COLORS.ink300);
    doc.text(row.label, innerX + 2.5, baseline);

    doc.setFont(mono, "normal");
    doc.setFontSize(7.7);
    setRgbText(doc, COLORS.ink100);
    doc.text(row.dev, colDevX, baseline);
    doc.text(row.client, colClientX, baseline);

    doc.setFontSize(7.2);
    setRgbText(doc, COLORS.ink500);
    doc.text(row.spread, colSpreadX, baseline);

    doc.setFont(mono, "bold");
    doc.setFontSize(7.8);
    setRgbText(
      doc,
      row.highlight
        ? hasOverlap
          ? COLORS.mint
          : COLORS.rose
        : hasOverlap
          ? COLORS.white
          : COLORS.ink500
    );
    doc.text(row.midpoint, colMidX, baseline, { align: "right" });
  });

  // Comparison Visualizer Tile
  const vizY = my + matrixRows.length * rowH + 3.2;
  const lowSide = developer.budget <= client.budget ? "DEVELOPER" : "CLIENT";
  const highSide = developer.budget <= client.budget ? "CLIENT" : "DEVELOPER";
  const lowVal = Math.min(developer.budget, client.budget);
  const highVal = Math.max(developer.budget, client.budget);
  const isExactMatch = developer.budget === client.budget;

  setRgbFill(doc, COLORS.tile);
  setRgbDraw(doc, COLORS.tileBorder);
  doc.setLineWidth(0.28);
  doc.roundedRect(innerX, vizY, innerW, vizH, 2.5, 2.5, "FD");

  doc.setFont(sans, "bold");
  doc.setFontSize(6.8);
  setRgbText(doc, COLORS.ink300);
  doc.text("BUDGET COMPARISON VISUALIZER", innerX + 4, vizY + 4.8);

  doc.setFont(mono, "normal");
  doc.setFontSize(6.8);
  setRgbText(doc, COLORS.ink500);
  doc.text(
    hasOverlap
      ? `Spread: ${formatPdfMoney(highVal - lowVal, currency)}`
      : `Gap to bridge: ${formatPdfMoney(summary.shortfall, currency)}`,
    innerX + innerW - 4,
    vizY + 4.8,
    { align: "right" }
  );

  const trackStart = innerX + 16;
  const trackEnd = innerX + innerW - 16;
  const trackMid = (trackStart + trackEnd) / 2;
  const trackY = vizY + 13.8;

  if (!hasOverlap || settledBudget === null) {
    const segW = Math.max(12, trackMid - 10 - trackStart);
    setRgbFill(doc, COLORS.recessedBorder);
    doc.roundedRect(trackStart, trackY - 0.55, segW, 1.1, 0.5, 0.5, "F");
    doc.roundedRect(trackMid + 10, trackY - 0.55, segW, 1.1, 0.5, 0.5, "F");

    setRgbDraw(doc, theme.accent);
    doc.setLineWidth(0.45);
    doc.line(trackMid - 5, trackY, trackMid - 2, trackY);
    doc.line(trackMid + 2, trackY, trackMid + 5, trackY);

    setRgbFill(doc, COLORS.bg);
    setRgbDraw(doc, COLORS.ink300);
    doc.setLineWidth(0.45);
    doc.circle(trackStart, trackY, 1.4, "FD");
    doc.circle(trackEnd, trackY, 1.4, "FD");

    doc.setFont(sans, "bold");
    doc.setFontSize(5.8);
    setRgbText(doc, theme.accent);
    doc.text("NO OVERLAP", trackMid, vizY + 6.8, { align: "center" });
    doc.setFont(mono, "bold");
    doc.setFontSize(7.2);
    setRgbText(doc, COLORS.white);
    doc.text(
      `Offer Spread: ${formatPdfMoney(summary.bridgeOptions?.publicGap ?? summary.shortfall, currency)}`,
      trackMid,
      vizY + 9.8,
      { align: "center" }
    );

    doc.setFont(sans, "bold");
    doc.setFontSize(5.8);
    setRgbText(doc, COLORS.ink500);
    doc.text(`${lowSide} OFFER`, trackStart, vizY + 18.0, { align: "center" });
    doc.text(`${highSide} OFFER`, trackEnd, vizY + 18.0, { align: "center" });

    doc.setFont(mono, "bold");
    doc.setFontSize(6.8);
    setRgbText(doc, COLORS.ink300);
    doc.text(formatPdfMoney(lowVal, currency), trackStart, vizY + 20.6, {
      align: "center",
    });
    doc.text(formatPdfMoney(highVal, currency), trackEnd, vizY + 20.6, {
      align: "center",
    });
  } else {
    // Base track bar
    setRgbFill(doc, COLORS.recessedBorder);
    doc.roundedRect(trackStart, trackY - 0.55, trackEnd - trackStart, 1.1, 0.5, 0.5, "F");

    if (isExactMatch) {
      setRgbFill(doc, COLORS.mint);
      setRgbDraw(doc, COLORS.white);
      doc.setLineWidth(0.45);
      doc.circle(trackMid, trackY, 1.7, "FD");

      doc.setFont(mono, "bold");
      doc.setFontSize(7.2);
      setRgbText(doc, COLORS.mint);
      doc.text(
        `Exact match at ${formatPdfMoney(settledBudget, currency)}`,
        trackMid,
        vizY + 19.8,
        { align: "center" }
      );
    } else {
      // Highlighted range bridge
      setRgbFill(doc, theme.accent);
      doc.rect(trackStart, trackY - 0.55, trackEnd - trackStart, 1.1, "F");

      // Low and High endpoint markers
      setRgbFill(doc, COLORS.bg);
      setRgbDraw(doc, COLORS.ink300);
      doc.setLineWidth(0.45);
      doc.circle(trackStart, trackY, 1.4, "FD");
      doc.circle(trackEnd, trackY, 1.4, "FD");

      // Proportional Settled Deal marker
      const settledRatio =
        highVal > lowVal
          ? Math.min(1, Math.max(0, (settledBudget - lowVal) / (highVal - lowVal)))
          : 0.5;
      const settledX = trackStart + settledRatio * (trackEnd - trackStart);
      const settledLabelX = Math.min(
        trackEnd - 8,
        Math.max(trackStart + 8, settledX)
      );

      setRgbFill(doc, COLORS.white);
      setRgbDraw(doc, theme.accent);
      doc.setLineWidth(0.55);
      doc.circle(settledX, trackY, 1.85, "FD");

      // Settled Deal callout cleanly positioned above node
      doc.setFont(sans, "bold");
      doc.setFontSize(5.8);
      setRgbText(doc, theme.accent);
      doc.text("SETTLED DEAL", settledLabelX, vizY + 6.8, { align: "center" });
      doc.setFont(mono, "bold");
      doc.setFontSize(7.2);
      setRgbText(doc, COLORS.white);
      doc.text(
        formatPdfMoney(settledBudget, currency),
        settledLabelX,
        vizY + 9.8,
        { align: "center" }
      );

      // Endpoint labels below
      doc.setFont(sans, "bold");
      doc.setFontSize(5.8);
      setRgbText(doc, COLORS.ink500);
      doc.text(lowSide, trackStart, vizY + 18.0, { align: "center" });
      doc.text(highSide, trackEnd, vizY + 18.0, { align: "center" });

      doc.setFont(mono, "bold");
      doc.setFontSize(6.8);
      setRgbText(doc, COLORS.ink300);
      doc.text(formatPdfMoney(lowVal, currency), trackStart, vizY + 20.6, {
        align: "center",
      });
      doc.text(formatPdfMoney(highVal, currency), trackEnd, vizY + 20.6, {
        align: "center",
      });
    }
  }

  y += matrixH + 3.6;

  // 5. Two-Column Split: Require Before Kickoff / Next Steps + SOW / Follow-Up Draft
  const halfW = (CONTENT_W - 4.5) / 2; // ~86.75mm
  const rightColX = MARGIN_X + halfW + 4.5;

  const publicGap =
    summary.bridgeOptions?.publicGap ??
    Math.round(Math.abs(developer.budget - client.budget));

  const guardrails =
    summary.actionPlan?.items && summary.actionPlan.items.length > 0
      ? summary.actionPlan.items
      : summary.guardrails && summary.guardrails.length > 0
      ? summary.guardrails
      : hasOverlap && settledBudget !== null
      ? [
          `Lock ${summary.depositPct.midpoint}% upfront deposit (${formatPdfMoney(
            summary.depositAmount,
            currency
          )}) prior to kickoff.`,
          `Cap scope at ${summary.hours.midpoint} engineering hours and ${summary.revisions.midpoint} revision rounds.`,
          `Settle remaining balance on Net ${summary.netDays.midpoint} day invoice terms.`,
          `Sign a Scope of Work (SOW) referencing the ${formatPdfMoney(
            settledBudget,
            currency
          )} mediated price.`,
        ]
      : [
          `Clarify must-have vs. optional features across the ${formatPdfMoney(
            publicGap,
            currency
          )} offer spread.`,
          `Split delivery into Phase 1 MVP and Phase 2 add-ons so budgets align cleanly.`,
          `Adjust deposit (${developer.depositPct}% vs ${client.depositPct}%) or payment timing to share cashflow risk.`,
          `Start a new MidPoint round once both sides adjust scope or price range.`,
        ];

  doc.setFont(sans, "normal");
  doc.setFontSize(7.6);
  const guardrailWrapped = guardrails.map((item) =>
    doc.splitTextToSize(sanitizePdfText(item), halfW - 18)
  );
  const guardrailsContentH = guardrailWrapped.reduce(
    (sum, lines) => sum + lines.length * 3.45 + 2.4,
    0
  );

  doc.setFont(sans, "normal");
  doc.setFontSize(7.3);
  const sowWrapped = doc.splitTextToSize(sowDraftText, halfW - 16);
  const sowBoxH = sowWrapped.length * 3.35 + 6.5;

  const splitCardH = Math.max(15 + guardrailsContentH + 4, 15 + sowBoxH + 5);
  y = ensurePageSpace(doc, y, splitCardH, stripUrl);

  // Left: Dynamic Action Plan / Next Steps Card
  setRgbFill(doc, COLORS.card);
  setRgbDraw(doc, COLORS.cardBorder);
  doc.setLineWidth(0.32);
  doc.roundedRect(MARGIN_X, y, halfW, splitCardH, 4, 4, "FD");

  doc.setFont(sans, "bold");
  doc.setFontSize(7);
  setRgbText(doc, COLORS.ink300);
  doc.text(
    summary.actionPlan?.badge ??
      (hasOverlap ? "REQUIRE BEFORE KICKOFF" : "WAYS TO BRIDGE THIS GAP"),
    MARGIN_X + 5.5,
    y + 6
  );

  doc.setFont(mono, "normal");
  doc.setFontSize(6.8);
  setRgbText(doc, COLORS.ink500);
  doc.text(
    hasOverlap
      ? `Risk ${summary.mediatedRisk.score}/100`
      : `Spread ${formatPdfMoney(publicGap, currency)}`,
    MARGIN_X + halfW - 5.5,
    y + 6,
    { align: "right" }
  );

  let gy = y + 12.2;
  guardrailWrapped.forEach((lines) => {
    drawCheckCircle(doc, MARGIN_X + 7.5, gy - 0.6);
    doc.setFont(sans, "normal");
    doc.setFontSize(7.6);
    setRgbText(doc, COLORS.ink100);
    doc.text(lines, MARGIN_X + 12, gy, { lineHeightFactor: 1.35 });
    gy += lines.length * 3.45 + 2.4;
  });

  // Right: Ready-to-Send SOW / Suggested Follow-Up Draft Card
  setRgbFill(doc, COLORS.card);
  setRgbDraw(doc, COLORS.cardBorder);
  doc.setLineWidth(0.32);
  doc.roundedRect(rightColX, y, halfW, splitCardH, 4, 4, "FD");

  doc.setFont(sans, "bold");
  doc.setFontSize(7);
  setRgbText(doc, COLORS.ink300);
  doc.text(
    hasOverlap ? "READY-TO-SEND SOW DRAFT" : "SUGGESTED FOLLOW-UP MESSAGE",
    rightColX + 5.5,
    y + 6
  );

  const sowInnerY = y + 10;
  const sowInnerH = splitCardH - 14.5;
  setRgbFill(doc, COLORS.recessed);
  setRgbDraw(doc, COLORS.recessedBorder);
  doc.setLineWidth(0.28);
  doc.roundedRect(rightColX + 4.8, sowInnerY, halfW - 9.6, sowInnerH, 2.5, 2.5, "FD");

  doc.setFont(sans, "normal");
  doc.setFontSize(7.3);
  setRgbText(doc, COLORS.ink100);
  doc.text(sowWrapped, rightColX + 8, sowInnerY + 5, { lineHeightFactor: 1.32 });

  y += splitCardH + 4.2;

  // 6. Party Scope & Context Notes Card (full unwrapped text, auto-paginates if needed)
  const devReason = developer.reason.trim()
    ? sanitizePdfText(`“${developer.reason}”`)
    : "No notes added.";
  const clientReason = client.reason.trim()
    ? sanitizePdfText(`“${client.reason}”`)
    : "No notes added.";
  doc.setFont(sans, "normal");
  doc.setFontSize(7.4);
  const devNoteLines = doc.splitTextToSize(devReason, halfW - 14);
  const clientNoteLines = doc.splitTextToSize(clientReason, halfW - 14);
  const notesInnerH =
    Math.max(devNoteLines.length, clientNoteLines.length) * 3.35 + 10.5;
  const notesCardH = 14 + notesInnerH + 4.5;

  y = ensurePageSpace(doc, y, notesCardH, stripUrl);

  setRgbFill(doc, COLORS.card);
  setRgbDraw(doc, COLORS.cardBorder);
  doc.setLineWidth(0.32);
  doc.roundedRect(MARGIN_X, y, CONTENT_W, notesCardH, 4, 4, "FD");

  doc.setFont(sans, "bold");
  doc.setFontSize(7);
  setRgbText(doc, COLORS.ink300);
  doc.text("PARTY SCOPE & BUDGET NOTES", MARGIN_X + 5.5, y + 6);

  const tileY = y + 9.8;
  const tileW = (CONTENT_W - 15) / 2;
  const tileRightX = MARGIN_X + 5.5 + tileW + 4;

  // Developer tile
  setRgbFill(doc, COLORS.tile);
  setRgbDraw(doc, COLORS.tileBorder);
  doc.setLineWidth(0.25);
  doc.roundedRect(MARGIN_X + 5.5, tileY, tileW, notesInnerH, 2.5, 2.5, "FD");

  doc.setFont(sans, "bold");
  doc.setFontSize(6.2);
  setRgbText(doc, COLORS.ink300);
  doc.text("DEVELOPER SCOPE NOTES", MARGIN_X + 9, tileY + 4.8);
  doc.setFont(sans, "normal");
  doc.setFontSize(7.4);
  setRgbText(doc, COLORS.ink100);
  doc.text(devNoteLines, MARGIN_X + 9, tileY + 9, { lineHeightFactor: 1.32 });

  // Client tile
  setRgbFill(doc, COLORS.tile);
  setRgbDraw(doc, COLORS.tileBorder);
  doc.roundedRect(tileRightX, tileY, tileW, notesInnerH, 2.5, 2.5, "FD");

  doc.setFont(sans, "bold");
  doc.setFontSize(6.2);
  setRgbText(doc, COLORS.ink300);
  doc.text("CLIENT BUDGET CONTEXT", tileRightX + 3.5, tileY + 4.8);
  doc.setFont(sans, "normal");
  doc.setFontSize(7.4);
  setRgbText(doc, COLORS.ink100);
  doc.text(clientNoteLines, tileRightX + 3.5, tileY + 9, {
    lineHeightFactor: 1.32,
  });

  // 7. Page Footers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    setRgbDraw(doc, COLORS.cardBorder);
    doc.setLineWidth(0.25);
    doc.line(MARGIN_X, FOOTER_RULE_Y, PAGE_W - MARGIN_X, FOOTER_RULE_Y);

    doc.setFont(sans, "normal");
    doc.setFontSize(6.8);
    setRgbText(doc, COLORS.ink500);
    const footerBrandText = "Settled with MidPoint  ·  Mediate your next deal free";
    if (shareUrl.startsWith("http")) {
      let rootOrigin = shareUrl;
      try {
        rootOrigin = new URL(shareUrl).origin;
      } catch {
        // Keep fallback URL
      }
      doc.textWithLink(footerBrandText, MARGIN_X, FOOTER_RULE_Y + 4.8, {
        url: rootOrigin,
      });
    } else {
      doc.text(footerBrandText, MARGIN_X, FOOTER_RULE_Y + 4.8);
    }

    const linkLabel =
      totalPages > 1 ? `${shareUrl}  ·  ${p}/${totalPages}` : shareUrl;
    doc.setFont(mono, "normal");
    doc.setFontSize(6.8);
    setRgbText(doc, COLORS.lavender);
    const linkW = doc.getTextWidth(linkLabel);
    if (shareUrl.startsWith("http")) {
      doc.textWithLink(linkLabel, PAGE_W - MARGIN_X - linkW, FOOTER_RULE_Y + 4.8, {
        url: shareUrl,
      });
    } else {
      doc.text(linkLabel, PAGE_W - MARGIN_X, FOOTER_RULE_Y + 4.8, {
        align: "right",
      });
    }
  }

  const slug = projectTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
  const filename = `MidPoint-${slug || id}.pdf`;

  return { doc, filename };
}

export async function downloadMediationPdf(
  data: RevealedData,
  shareUrl: string
): Promise<void> {
  const { doc, filename } = await createMediationPdf(data, shareUrl);
  doc.save(filename);
}
