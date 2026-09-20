import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const buttonVariants = cva(
  "inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition-[background-color,border-color] duration-150 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4",
  {
    variants: {
      variant: {
        primary: "border border-transparent bg-[#3b5bfd] text-white hover:bg-[#2440d8]",
        secondary:
          "border border-[#d4cfc2] bg-white text-[#101828] hover:border-[#101828]",
        ghost: "border-transparent text-[#2440d8] hover:bg-[#eef1ff]",
        danger:
          "border border-transparent bg-[#c4322b] text-white hover:bg-[#9c2721]",
      },
    },
    defaultVariants: { variant: "primary" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant }), className)} {...props} />;
}
