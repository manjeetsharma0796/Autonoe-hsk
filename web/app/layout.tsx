import type { Metadata, Viewport } from "next";
import { Orbitron, Exo_2, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/AppShell";
import { SmoothScroll } from "@/components/SmoothScroll";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  display: "swap",
});

const exo2 = Exo_2({
  variable: "--font-exo2",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Autonoe",
  description: "Your autonomous mind for on-chain trades.",
};

export const viewport: Viewport = {
  themeColor: "#080b12",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${orbitron.variable} ${exo2.variable} ${jetbrainsMono.variable}`}
      >
        {/* Atmosphere - gradient orbs + vignette behind everything */}
        <div className="orb g" aria-hidden />
        <div className="orb v" aria-hidden />
        <div className="orb t" aria-hidden />
        <div className="vignette" aria-hidden />

        <Providers>
          <SmoothScroll>
            <AppShell>{children}</AppShell>
          </SmoothScroll>
        </Providers>
      </body>
    </html>
  );
}
