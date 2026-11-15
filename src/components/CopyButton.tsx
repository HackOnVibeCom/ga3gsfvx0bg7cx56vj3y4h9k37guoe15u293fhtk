"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  variant?: "ghost" | "cta" | "tile";
  className?: string;
}

export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  variant = "ghost",
  className = "",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore if clipboard access is blocked
    }
  }

  const baseStyles =
    variant === "cta"
      ? "btn-dsq-primary px-6 py-3 text-sm font-bold"
      : variant === "tile"
        ? "rounded-full border border-white/12 bg-[#0E0E13] hover:border-[#5661FF]/70 hover:bg-[#5661FF]/15 px-4 py-2.5 text-xs font-semibold text-[#F1F1F1] transition-all"
        : "rounded-full border border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.08] px-3.5 py-1.5 text-xs font-medium text-[#B4B8C8] hover:text-white transition-all";

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none ${baseStyles} ${className}`}
    >
      {copied ? (
        <>
          <Check
            className={`w-3.5 h-3.5 shrink-0 ${
              variant === "cta" ? "text-[#07090D]" : "text-[#39D98A]"
            }`}
          />
          <span className={variant === "cta" ? "text-[#07090D]" : "text-[#39D98A]"}>
            {copiedLabel}
          </span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 shrink-0" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
