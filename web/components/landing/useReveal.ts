"use client";

import { useRef, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Scoped scroll fade-up for any element carrying the `revealClass`.
 * Honors prefers-reduced-motion (elements are shown without animating).
 * Returns a ref to attach to the section root used as the GSAP scope.
 */
export function useReveal<T extends HTMLElement = HTMLElement>(
  revealClass: string,
): RefObject<T | null> {
  const root = useRef<T>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const targets = gsap.utils.toArray<HTMLElement>(`.${revealClass}`);
      if (reduce) {
        gsap.set(targets, { opacity: 1, y: 0 });
        return;
      }
      targets.forEach((el) => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 86%" },
        });
      });
    },
    { scope: root },
  );

  return root;
}
