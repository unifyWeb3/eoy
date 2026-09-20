import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PRODUCT_NAME } from "../lib/brand";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} — Verdict infrastructure for agentic work`,
  description:
    "Lock payment, define acceptance criteria, let GenLayer validators judge the submitted evidence, and settle automatically.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#FAFAF7", // warm-white canvas
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
