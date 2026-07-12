"use client";

import { Hero } from "@/components/landing/Hero";
import { Tribunal } from "@/components/landing/Tribunal";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Benchmark } from "@/components/landing/Benchmark";
import { MarketsPreview } from "@/components/landing/MarketsPreview";
import { FinalCta } from "@/components/landing/FinalCta";

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Tribunal />
      <HowItWorks />
      <Benchmark />
      <MarketsPreview />
      <FinalCta />
    </main>
  );
}
