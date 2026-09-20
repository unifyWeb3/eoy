import { cn } from "../../lib/cn";

export interface Phase {
  id: string;
  label: string;
  detail?: string;
  state: "done" | "current" | "todo" | "failed";
}

/**
 * Transaction/finality timeline. Mirrors GenLayer semantics:
 * submitted → decided → finalized (+ payout). Color never stands alone —
 * each phase carries a text state.
 */
export function Timeline({ phases }: { phases: Phase[] }) {
  return (
    <ol className="flex flex-col">
      {phases.map((p, i) => (
        <li key={p.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < phases.length - 1 && (
            <span aria-hidden="true" className="absolute top-6 left-[13px] h-[calc(100%-20px)] w-px bg-[#e5e2da]" />
          )}
          <span
            aria-hidden="true"
            className={cn(
              "z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors duration-150",
              p.state === "done" && "border-[#157f3d] bg-[#eaf7ef] text-[#157f3d]",
              p.state === "current" && "border-[#3b5bfd] bg-[#eef1ff] text-[#2440d8]",
              p.state === "failed" && "border-[#c4322b] bg-[#fdeeee] text-[#c4322b]",
              p.state === "todo" && "border-[#d4cfc2] bg-white text-[#667085]"
            )}
          >
            {p.state === "done" ? "✓" : p.state === "failed" ? "!" : i + 1}
          </span>
          <div className="pt-0.5">
            <p className="text-sm font-semibold text-[#101828]">
              {p.label}{" "}
              <span className="font-normal text-[#667085]">
                {p.state === "done" ? "· done" : p.state === "current" ? "· in progress" : p.state === "failed" ? "· failed" : "· pending"}
              </span>
            </p>
            {p.detail && <p className="mono mt-1 text-[#475467]">{p.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
