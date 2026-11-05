import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// shadcn/ui Button pattern (MIT), restyled to EnglishPath tokens: pills, one accent.
const buttonVariants = cva(
  "tap focus-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:brightness-105",
        secondary: "bg-surface-2 text-fg border border-line hover:border-line-strong",
        ghost: "text-fg-2 hover:bg-surface-2",
        success: "bg-success text-[#04140b]",
        danger: "bg-danger text-white",
        outline: "border border-line-strong text-fg hover:bg-surface-2",
      },
      size: {
        sm: "h-9 px-4 text-[13px]",
        md: "h-11 px-5 text-[14px]",
        lg: "h-[52px] px-7 text-[15px]",
        icon: "size-11",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, block, asChild, type = "button", ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp type={type} className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}

export { buttonVariants };
