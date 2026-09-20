"use client";

import Link from "next/link";
import { SiteHeader, SiteFooter } from "../components/site";
import { FlowDiagram } from "../components/flow-diagram";
import { ReceiptCard } from "../components/ui/receipt-card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { CANONICAL_PROOF } from "../lib/proof";

function Section({
  id,
  eyebrow,
  title,
  children,
  plain,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  plain?: boolean;
}) {
  return (
    <section id={id} className="mx-auto max-w-[1120px] scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20">
      {eyebrow && (
        <p className="text-xs font-bold tracking-[0.14em] text-[#2440d8] uppercase">{eyebrow}</p>
      )}
      <h2 className="mt-2 max-w-[640px] text-2xl font-bold tracking-tight text-[#101828] sm:text-[32px] sm:leading-[1.2]">
        {title}
      </h2>
      <div className={plain ? "mt-6" : "mt-6"}>{children}</div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div>
      <SiteHeader end={{ kind: "launch" }} />

      {/* Hero — one dominant idea, receipt as counterpart */}
      <div className="border-b border-[#e5e2da]">
        <div className="mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-[13px] font-semibold text-[#667085]">Escrow that can read.</p>
            <h1 className="mt-4 text-[44px] leading-[1.04] font-bold tracking-tight text-[#101828] sm:text-[64px]">
              Work gets paid when the evidence passes.
            </h1>
            <p className="mt-6 max-w-[540px] text-lg leading-relaxed text-[#475467]">
              Lock payment, define acceptance criteria, let GenLayer validators judge the submitted
              evidence, and settle automatically.
            </p>
            <div className="mt-8">
              <Button asChild className="px-7">
                <Link href="/app">Launch app</Link>
              </Button>
            </div>
          </div>
          <div aria-label="Canonical settlement receipt">
            <ReceiptCard proof={CANONICAL_PROOF} />
          </div>
        </div>
      </div>

      {/* How it works — one connected process */}
      <Section id="how" eyebrow="How it works" title="Define done. Prove it. Get paid.">
        <FlowDiagram />
      </Section>

      {/* Canonical proof */}
      <div className="border-y border-[#e5e2da] bg-white">
        <Section id="proof" eyebrow="Canonical live proof" title={`Job #${CANONICAL_PROOF.jobId} · ${CANONICAL_PROOF.status} on Studionet`}>
          <p className="max-w-[640px] text-[15px] leading-relaxed text-[#475467]">
            Created from a browser wallet through the production write path and judged by GenLayer
            consensus. Escrow {CANONICAL_PROOF.escrowGen} GEN. These are the verified on-chain values —
            nothing here is illustrative.
          </p>
          <div className="mt-6 max-w-[720px]">
            <ReceiptCard proof={CANONICAL_PROOF} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="accept">Post · finalized / majority-agree</Badge>
            <Badge tone="accept">Submit · finalized / majority-agree</Badge>
            <Badge tone="accept">Judge · finalized / majority-agree</Badge>
            <Badge tone="accept">Settlement · paid</Badge>
          </div>
        </Section>
      </div>

      {/* Problem + use cases */}
      <Section eyebrow="Problem" title="Someone always decides what “done” means. Make it neutral.">
        <div className="grid max-w-[880px] grid-cols-1 gap-6 text-[15px] leading-relaxed text-[#475467] sm:grid-cols-2">
          <div>
            <p className="font-bold text-[#101828]">Freelance and bounty payouts stall on disagreement</p>
            <p className="mt-1">
              A buyer and a worker read the same delivery and reach different verdicts. Platforms
              resolve this with staff, delays, and fees — or not at all.
            </p>
          </div>
          <div>
            <p className="font-bold text-[#101828]">Agents need machine-readable acceptance</p>
            <p className="mt-1">
              Agentic work fails on subjective review: code quality, completeness, fitness for purpose.
              A neutral verdict rail turns that review into a receipt payment systems can act on.
            </p>
          </div>
        </div>
      </Section>

      {/* Why GenLayer */}
      <div className="border-y border-[#e5e2da] bg-white">
        <Section eyebrow="Architecture" title="Why GenLayer does the judging">
          <div className="grid max-w-[880px] grid-cols-1 gap-6 text-[15px] leading-relaxed text-[#475467] sm:grid-cols-2">
            <p>
              The escrow contract lives on GenLayer, so it can fetch delivery content from the web
              and ask validator consensus what deterministic code cannot decide: does this delivery
              satisfy the rubric?
            </p>
            <p>
              Validators compare independent judgments and commit one verdict onchain. The receipt —
              status, verdict, payout state — is final and auditable by anyone.
            </p>
          </div>
        </Section>
      </div>

      {/* Limitations — demoted, plain */}
      <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="text-lg font-bold text-[#101828]">Limitations</h2>
        <ul className="mt-3 max-w-[720px] list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[#667085]">
          <li>Testnet build on GenLayer Studionet. Funds are test GEN with no real value.</li>
          <li>Studionet exposes no fee-estimation endpoint; the app uses a measured fee profile with a direct fallback.</li>
          <li>An UNDETERMINED verdict has been exercised in simulation only, not yet on a live network.</li>
          <li>0.004 GEN sits unaccounted at the contract from two malformed early attempts, with no recovery path in the current contract.</li>
        </ul>
        <div className="mt-8">
          <Button asChild className="px-7">
            <Link href="/app">Launch app</Link>
          </Button>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
