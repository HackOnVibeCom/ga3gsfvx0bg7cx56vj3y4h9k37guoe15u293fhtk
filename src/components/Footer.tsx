import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 mt-14 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#989898]">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center opacity-85 hover:opacity-100 transition-opacity"
        >
          <img
            src="/logo-full.png"
            alt="MidPoint"
            className="h-5 w-auto object-contain"
          />
        </Link>
        <span>© 2026</span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-medium text-[#B4B8C8]">
        <Link href="/" className="hover:text-white transition-colors">
          Home
        </Link>
        <Link
          href="/#how-it-works-heading"
          className="hover:text-white transition-colors"
        >
          How it works
        </Link>
        <Link href="/#mediate" className="hover:text-white transition-colors">
          Start mediation
        </Link>
        <Link href="/pricing" className="hover:text-white transition-colors">
          Pricing
        </Link>
      </div>
    </footer>
  );
}
