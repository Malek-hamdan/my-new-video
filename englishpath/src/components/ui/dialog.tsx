import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// shadcn/ui Dialog pattern (MIT), presented as a bottom sheet on phones.
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <DialogPrimitive.Content
          className={cn(
            "card safe-bottom fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-b-none px-5 pt-5 pb-6 outline-none data-[state=open]:animate-[sheet-up_320ms_var(--ease-out-expo)]",
            className,
          )}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" aria-hidden />
          <DialogPrimitive.Title className="display text-[24px]">{title}</DialogPrimitive.Title>
          {description ? <DialogPrimitive.Description className="mt-1.5 text-[14px] text-muted">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>}
          <div className="mt-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
