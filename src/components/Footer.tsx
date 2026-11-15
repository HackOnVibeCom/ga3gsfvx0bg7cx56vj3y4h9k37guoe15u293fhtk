import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 mt-14 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#989898]">
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
      <p className="text-[#989898]">
        Blind two-party freelance developer deal mediation · No signup required
      </p>
    </footer>
  );
}
