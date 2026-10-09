"use client";

import { useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ReceiptKind } from "@/lib/receipts";

/**
 * "View" opens the receipt in an overlay on top of the current page (native <dialog>: Escape, a
 * click outside, or Close dismisses it), with a Download button. Nothing loads until it's opened.
 */
export function ReceiptViewer({
  expenseId,
  kind,
  title,
  triggerLabel = "View",
  triggerClassName = "text-sm underline",
}: {
  expenseId: number;
  kind: ReceiptKind;
  title: string;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = `/expenses/${expenseId}/receipt`;

  const show = () => {
    setFailed(false);
    setOpen(true);
    ref.current?.showModal();
  };
  const close = () => ref.current?.close();

  return (
    <>
      <button type="button" onClick={show} className={triggerClassName}>
        {triggerLabel}
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        // A click on the backdrop lands on the dialog element itself.
        onClick={(e) => e.target === e.currentTarget && close()}
        aria-label={`Receipt: ${title}`}
        className="m-auto w-[min(56rem,calc(100vw-1.5rem))] rounded-lg bg-background p-0 text-foreground not-italic shadow-xl backdrop:bg-black/60"
      >
        {open && (
          <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div className="min-w-0 truncate text-sm font-medium">{title}</div>
              <div className="flex shrink-0 gap-2">
                <a href={`${src}?download=1`} download className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Download
                </a>
                <Button size="sm" onClick={close} autoFocus>
                  Close
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-auto overflow-auto bg-muted/40">
              {kind === "pdf" ? (
                <iframe src={src} title={`Receipt: ${title}`} className="h-[75dvh] w-full border-0 bg-white" />
              ) : failed ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  This browser can&apos;t show this photo format. Use Download to open it.
                </p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- served from the uploads route, not optimizable
                <img src={src} alt={`Receipt: ${title}`} onError={() => setFailed(true)} className="mx-auto block max-h-[75dvh] w-auto max-w-full object-contain" />
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
