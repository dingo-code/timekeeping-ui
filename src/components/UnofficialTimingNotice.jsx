export default function UnofficialTimingNotice({ className = '' }) {
  return (
    <section className={`border border-red-500/40 bg-[#111111] px-3 py-2 shadow-sm ${className}`}>
      <div className="flex flex-col items-center justify-between gap-2 text-center md:flex-row md:text-left">
        <div className="flex shrink-0 items-center gap-2 text-red-500">
          <NoticeIcon />
          <span className="text-[10px] font-black uppercase tracking-[0.18em] sm:text-xs">Under Development</span>
        </div>
        <h2 className="text-xs font-black uppercase tracking-wide text-white sm:text-sm">Non Official Live Timing Result</h2>
        <div className="text-[10px] leading-tight md:text-right sm:text-xs">
          <p className="font-bold text-red-500">This live timing is unofficial and for reference only.</p>
          <p className="mt-0.5 font-semibold text-white">For official result please contact the official event.</p>
        </div>
      </div>
    </section>
  );
}

export function UnofficialResultMark() {
  return (
    <div className="unofficial-result-mark w-full border border-red-500/60 bg-[#111111] px-2 py-1.5 text-center">
      <div className="flex items-center justify-center gap-1 text-red-500"><NoticeIcon small /><span className="text-[7px] font-black uppercase tracking-wider">Under Development</span></div>
      <p className="mt-1 text-[8px] font-black uppercase leading-none text-white">Non Official Live Timing Result</p>
      <p className="mt-1 text-[7px] font-bold leading-tight text-red-500">Unofficial and for reference only.</p>
      <p className="text-[7px] font-semibold leading-tight text-white">Official result: contact the event.</p>
    </div>
  );
}

function NoticeIcon({ small = false }) {
  return <span className={`flex shrink-0 items-center justify-center rounded-full border-2 border-red-500 font-black ${small ? 'h-3 w-3 text-[7px]' : 'h-4 w-4 text-[9px]'}`} aria-hidden="true">!</span>;
}
