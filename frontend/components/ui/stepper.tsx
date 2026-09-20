import { cn } from "../../lib/cn";

export interface Step {
  id: string;
  label: string;
  description?: string;
  state: "done" | "current" | "todo";
}

/** Linear workflow progress. State changes only; no decorative animation. */
export function Stepper({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol aria-label="Workflow progress" className={cn("flex flex-col gap-0 sm:flex-row sm:items-start", className)}>
      {steps.map((s, i) => (
        <li key={s.id} className="flex flex-1 gap-3 pb-5 sm:flex-col sm:gap-2 sm:pb-0" aria-current={s.state === "current" ? "step" : undefined}>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold",
                s.state === "done" && "border-[#157f3d] bg-[#157f3d] text-white",
                s.state === "current" && "border-[#3b5bfd] bg-[#3b5bfd] text-white",
                s.state === "todo" && "border-[#d4cfc2] bg-white text-[#667085]"
              )}
            >
              {s.state === "done" ? "✓" : i + 1}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="hidden h-px flex-1 bg-[#e5e2da] sm:block" />
            )}
          </div>
          <div>
            <p className={cn("text-sm font-semibold", s.state === "todo" ? "text-[#667085]" : "text-[#101828]")}>
              {s.label}
            </p>
            {s.description && <p className="text-[13px] text-[#667085]">{s.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
