const NODES = [
  { title: "Define", body: "Buyer locks escrow and writes explicit acceptance criteria." },
  { title: "Check", body: "Deterministic requirements are verified without consensus." },
  { title: "Judge", body: "Only the subjective remainder goes to GenLayer validators." },
  { title: "Settle", body: "Payment releases or refunds against the finalized receipt." },
];

/**
 * One continuous process: a single connecting rule with numbered nodes —
 * horizontal on desktop, vertical on mobile. No arrows, no animation.
 */
export function FlowDiagram() {
  return (
    <ol aria-label="How EOY works, in four steps" className="relative">
      <span
        aria-hidden="true"
        className="absolute top-[15px] bottom-[15px] left-[15px] w-px bg-[#d4cfc2] sm:top-[15px] sm:right-[15px] sm:bottom-auto sm:left-[15px] sm:h-px sm:w-auto"
      />
      <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-4 sm:gap-6">
        {NODES.map((n, i) => (
          <li key={n.title}>
            <p
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full border border-[#d4cfc2] bg-[#fafaf7] text-sm font-bold text-[#101828]"
            >
              {i + 1}
            </p>
            <p className="mt-3 text-[15px] font-bold text-[#101828]">{n.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-[#475467]">{n.body}</p>
          </li>
        ))}
      </div>
    </ol>
  );
}
