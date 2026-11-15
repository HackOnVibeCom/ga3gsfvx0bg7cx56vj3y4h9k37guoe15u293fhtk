"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

interface HeaderProps {
  showNewButton?: boolean;
}

export function Header({ showNewButton = true }: HeaderProps) {
  const pathname = usePathname();
  const isPricing = pathname === "/pricing";

  return (
    <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr] md:items-center gap-4">
      <div className="md:justify-self-start">
        <Link
          href="/"
          className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5661FF]/50 rounded-lg"
          aria-label="MidPoint Home"
        >
          <img
            src="/logo-full.png"
            alt="MidPoint"
            className="h-7 sm:h-8 w-auto object-contain select-none"
          />
        </Link>
      </div>

      <nav
        aria-label="Main Navigation"
        className="hidden md:flex md:justify-self-center items-center gap-8 lg:gap-10 text-xs sm:text-sm font-semibold"
      >
        <Link
          href="/#how-it-works-heading"
          className="text-[#B4B8C8] hover:text-white transition-colors whitespace-nowrap"
        >
          How it works
        </Link>
        <Link
          href="/#mediate"
          className="text-[#B4B8C8] hover:text-white transition-colors whitespace-nowrap"
        >
          Workbench
        </Link>
        <Link
          href="/pricing"
          className={`transition-colors whitespace-nowrap ${
            isPricing ? "text-white font-bold" : "text-[#B4B8C8] hover:text-white"
          }`}
        >
          Pricing
        </Link>
      </nav>

      <div className="flex items-center gap-3 md:justify-self-end">
        <Link
          href="/pricing"
          className={`md:hidden text-xs px-2 py-1 transition-colors ${
            isPricing
              ? "text-white font-bold"
              : "text-[#B4B8C8] font-semibold hover:text-white"
          }`}
        >
          Pricing
        </Link>

        {showNewButton && (
          <Link
            href="/#mediate"
            className="btn-dsq-nav inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New mediation</span>
          </Link>
        )}
      </div>
    </header>
  );
}
