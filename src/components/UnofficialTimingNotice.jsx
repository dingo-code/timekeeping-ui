export default function UnofficialTimingNotice({ className = '' }) {
  return (
    <section className={`border border-red-500/50 bg-[#111111] px-4 py-3 text-center shadow-sm ${className}`}>
      <div className="flex items-center justify-center gap-2 text-red-500">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-red-500 text-xs font-black" aria-hidden="true">!</span>
        <span className="text-xs font-black uppercase tracking-[0.2em]">Under Development</span>
      </div>
      <h2 className="mt-2 text-base font-black uppercase tracking-wide text-white sm:text-lg">Non Official Live Timing Result</h2>
      <p className="mt-1 text-xs font-bold text-red-500 sm:text-sm">This live timing is unofficial and for reference only.</p>
      <p className="mt-1 text-xs font-semibold text-white sm:text-sm">For official result please contact the official event.</p>
    </section>
  );
}
