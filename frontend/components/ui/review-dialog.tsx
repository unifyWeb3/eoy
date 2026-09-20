"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./button";

/** Pre-sign review: concise human-readable summary; technical payload expandable. */
export function ReviewDialog({
  open,
  onOpenChange,
  title,
  rows,
  technical,
  confirmLabel,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  rows: [string, string][];
  technical: [string, string][];
  confirmLabel: string;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-[#101828]/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-40 max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-[#e5e2da] bg-white p-6"
        >
          <Dialog.Title className="text-lg font-bold text-[#101828]">{title}</Dialog.Title>
          <p className="mt-1 text-sm text-[#667085]">
            Review before your wallet opens. Nothing is signed until you confirm in MetaMask.
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[140px_1fr]">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-[#667085]">{k}</dt>
                <dd className="break-words text-[#101828]">{v}</dd>
              </div>
            ))}
          </dl>
          <details className="mt-4 rounded-lg border border-[#e5e2da]">
            <summary className="min-h-[44px] cursor-pointer px-4 py-2.5 text-left text-sm font-semibold text-[#2440d8]">
              Technical details
            </summary>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 border-t border-[#e5e2da] px-4 py-3 text-[13px] sm:grid-cols-[140px_1fr]">
              {technical.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-[#667085]">{k}</dt>
                  <dd className="mono break-all text-[#101828]">{v}</dd>
                </div>
              ))}
            </dl>
          </details>
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <Button variant="secondary" disabled={busy}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button onClick={onConfirm} disabled={busy}>
              {busy ? "Waiting for wallet…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
