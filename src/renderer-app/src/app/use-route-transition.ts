import { useEffect, type DependencyList, type RefObject } from "react";
import { gsap } from "gsap";

export function useRouteTransition(ref: RefObject<HTMLElement | null>, dependencies: DependencyList) {
  useEffect(() => {
    const target = ref.current;
    if (!target) return;

    gsap.set(target, { autoAlpha: 1, y: 0, clearProps: "opacity,visibility,transform" });
  }, dependencies);
}
