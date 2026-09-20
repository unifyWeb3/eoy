import Link from "next/link";
import { Button } from "./ui/button";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "../lib/brand";

export function SiteHeader({
  end,
}: {
  /** Landing: launch CTA. App: wallet connection. */
  end:
    | { kind: "launch" }
    | { kind: "connect"; connected: string; onConnect: () => void };
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[#e5e2da] bg-[#fafaf7]/95">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-3 px-4 sm:px-6">
        <nav aria-label="Primary" className="flex items-center gap-6">
          <Link href="/" className="text-[15px] font-bold tracking-tight text-[#101828]">
            {PRODUCT_NAME}
          </Link>
          <Link href="/#how" className="hidden text-sm font-medium text-[#475467] hover:text-[#101828] sm:inline">
            How it works
          </Link>
          <Link href="/#proof" className="hidden text-sm font-medium text-[#475467] hover:text-[#101828] sm:inline">
            Live proof
          </Link>
        </nav>
        {end.kind === "launch" ? (
          <Button asChild className="min-h-[40px] px-4">
            <Link href="/app">Launch app</Link>
          </Button>
        ) : end.connected ? (
          <p className="mono truncate text-[13px] text-[#475467]" title={end.connected}>
            {end.connected.slice(0, 6)}…{end.connected.slice(-4)}
          </p>
        ) : (
          <Button variant="secondary" onClick={end.onConnect} className="min-h-[40px] px-4">
            Connect wallet
          </Button>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[#e5e2da]">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-4 py-8 text-[13px] text-[#667085] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          {PRODUCT_NAME} — {PRODUCT_TAGLINE.toLowerCase()}. Testnet build on GenLayer Studionet.
        </p>
        <p className="flex gap-4">
          <a className="underline-offset-2 hover:underline" href="https://studio.genlayer.com" target="_blank" rel="noreferrer">
            Studio
          </a>
          <a className="underline-offset-2 hover:underline" href="https://docs.genlayer.com" target="_blank" rel="noreferrer">
            Docs
          </a>
        </p>
      </div>
    </footer>
  );
}
