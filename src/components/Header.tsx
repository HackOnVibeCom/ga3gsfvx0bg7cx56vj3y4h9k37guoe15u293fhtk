import Link from "next/link";
import { Plus } from "lucide-react";

interface HeaderProps {
  showNewButton?: boolean;
}

export function Header({ showNewButton = false }: HeaderProps) {
  return (
    <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between gap-4">
      <Link
        href="/"
        className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5661FF]/50 rounded-lg"
        aria-label="MidPoint Home"
      >
        <img
          src="/logo-full.png"
          alt="MidPoint"
          className="h-8 sm:h-9 w-auto object-contain select-none"
        />
      </Link>

      {showNewButton && (
        <Link
          href="/"
          className="btn-dsq-nav inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New mediation</span>
        </Link>
      )}
    </header>
  );
}
