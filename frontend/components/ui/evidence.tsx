"use client";

import * as React from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { cn } from "../../lib/cn";

/** Deliberate technical-evidence disclosure. Hashes stay hidden until opened. */
export function Evidence({ label = "Technical evidence", children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <Accordion.Root type="single" collapsible className={cn("rounded-lg border border-[#e5e2da] bg-white", className)}>
      <Accordion.Item value="evidence">
        <Accordion.Header>
          <Accordion.Trigger className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm font-semibold text-[#2440d8] [&[data-state=open]>svg]:rotate-180">
            {label}
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 transition-transform duration-150 motion-reduce:transition-none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="overflow-hidden">
          <div className="border-t border-[#e5e2da] px-4 py-3">{children}</div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}
