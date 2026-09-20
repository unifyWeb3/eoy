import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-wide uppercase",
  {
    variants: {
      tone: {
        neutral: "border-[#d4cfc2] bg-white text-[#475467]",
        info: "border-[#c4cffb] bg-[#eef1ff] text-[#2440d8]",
        accept: "border-[#bfe6cc] bg-[#eaf7ef] text-[#157f3d]",
        reject: "border-[#f3c4c0] bg-[#fdeeee] text-[#c4322b]",
        undecided: "border-[#eed9ac] bg-[#fdf3e0] text-[#9a6700]",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

const DOTS: Record<string, string> = {
  neutral: "bg-[#667085]",
  info: "bg-[#3b5bfd]",
  accept: "bg-[#157f3d]",
  reject: "bg-[#c4322b]",
  undecided: "bg-[#9a6700]",
};

/** Status badge: always icon (dot) + text, never color alone. */
export function Badge({
  tone,
  className,
  children,
}: VariantProps<typeof badgeVariants> & {
  className?: string;
  children: React.ReactNode;
}) {
  const t = tone ?? "neutral";
  return (
    <span className={cn(badgeVariants({ tone: t }), className)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", DOTS[t])} />
      {children}
    </span>
  );
}

/** Map a job status to its semantic tone. */
export function statusTone(status: string): "neutral" | "info" | "accept" | "reject" | "undecided" {
  if (status === "ACCEPTED" || status === "RESOLVED") return "accept";
  if (status === "REJECTED" || status === "REFUNDED") return "reject";
  if (status === "UNDETERMINED") return "undecided";
  if (status === "SUBMITTED") return "info";
  return "neutral";
}
