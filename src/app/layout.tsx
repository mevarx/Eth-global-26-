import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClientProviders } from "@/components/app/ClientProviders";
import { fontVariables } from "@/lib/ui/fonts";
import "@/styles/briefmint-tokens.css";
import "@/styles/typography.css";
import "./globals.css";

export const metadata: Metadata = { title: "BriefMint", description: "Private project notes to wallet-owned public opportunities." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
