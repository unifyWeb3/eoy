import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const alertVariants = cva("rounded-lg border px-4 py-3 text-sm", {
  variants: {
    tone: {
      info: "border-[#c4cffb] bg-[#eef1ff] text-[#101828]",
      accept: "border-[#bfe6cc] bg-[#eaf7ef] text-[#101828]",
      reject: "border-[#f3c4c0] bg-[#fdeeee] text-[#101828]",
      undecided: "border-[#eed9ac] bg-[#fdf3e0] text-[#101828]",
    },
  },
  defaultVariants: { tone: "info" },
});

export function Alert({
  tone,
  title,
  className,
  children,
}: VariantProps<typeof alertVariants> & {
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role={tone === "reject" ? "alert" : "status"} className={cn(alertVariants({ tone }), className)}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
  );
}
