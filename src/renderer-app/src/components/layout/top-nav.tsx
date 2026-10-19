import { useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

export type TopNavProps = {
  title: string;
  subtitle?: string;
  runningSurfaces?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

type TopNavMotionSnapshot = {
  title: string;
  titleRight: number;
  titleLayoutRight: number;
  titleWidth: number;
  railLeft: number | null;
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readTransformX(node: HTMLElement) {
  const transform = window.getComputedStyle(node).transform;
  if (!transform || transform === "none") return 0;
  const matrix3d = transform.match(/^matrix3d\((.+)\)$/);
  if (matrix3d) {
    const values = matrix3d[1].split(",").map((part) => Number.parseFloat(part.trim()));
    return Number.isFinite(values[12]) ? values[12] : 0;
  }
  const matrix = transform.match(/^matrix\((.+)\)$/);
  if (matrix) {
    const values = matrix[1].split(",").map((part) => Number.parseFloat(part.trim()));
    return Number.isFinite(values[4]) ? values[4] : 0;
  }
  return 0;
}

function readLayoutLeft(node: HTMLElement | null) {
  const rect = node?.getBoundingClientRect();
  if (!node || !rect || rect.width <= 0) return null;
  return rect.left - readTransformX(node);
}

function readTitleVisualWidth(titleNode: HTMLElement) {
  const baseNode = titleNode.querySelector<HTMLElement>(".meowdesk-top-nav-title-base") || titleNode;
  const rectWidth = baseNode.getBoundingClientRect().width || 0;
  const scrollWidth = baseNode.scrollWidth || 0;
  return Math.max(rectWidth, scrollWidth);
}

function readMotionSnapshot(title: string, titleNode: HTMLElement, runningNode: HTMLElement) {
  const titleRect = titleNode.getBoundingClientRect();
  const titleX = readTransformX(titleNode);
  const titleWidth = readTitleVisualWidth(titleNode);
  const railNode = runningNode.querySelector<HTMLElement>("[data-product-shell-top-surface-rail]");
  const railLeft = readLayoutLeft(railNode);
  const titleLayoutRight = titleRect.right - titleX;
  const snapshot: TopNavMotionSnapshot = {
    title,
    titleRight: titleRect.left - titleX + Math.max(titleRect.width, titleWidth),
    titleLayoutRight,
    titleWidth,
    railLeft
  };
  return {
    snapshot,
    railNode,
    clearance: railLeft == null ? 0 : railLeft - titleLayoutRight
  };
}

export function TopNav({ title, runningSurfaces, actions, className }: TopNavProps) {
  const titleRef = useRef<HTMLDivElement>(null);
  const runningSurfacesRef = useRef<HTMLDivElement>(null);
  const previousMotionRef = useRef<TopNavMotionSnapshot | null>(null);
  const pushResetTimerRef = useRef<number | null>(null);
  const surfaceMotionRef = useRef<ReturnType<typeof gsap.timeline> | null>(null);
  const motionRetryTimerRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const titleNode = titleRef.current;
    const runningNode = runningSurfacesRef.current;
    if (!titleNode || !runningNode) return undefined;

    const clearMotionState = () => {
      if (pushResetTimerRef.current !== null) {
        window.clearTimeout(pushResetTimerRef.current);
        pushResetTimerRef.current = null;
      }
      if (motionRetryTimerRef.current !== null) {
        window.clearTimeout(motionRetryTimerRef.current);
        motionRetryTimerRef.current = null;
      }
      surfaceMotionRef.current?.kill();
      surfaceMotionRef.current = null;
      runningNode.removeAttribute("data-top-nav-surface-push");
      const activeRail = runningNode.querySelector<HTMLElement>("[data-product-shell-top-surface-rail]");
      if (activeRail) {
        activeRail.removeAttribute("data-top-nav-surface-motion");
        gsap.set(activeRail, { clearProps: "transform,willChange" });
      }
    };

    const playSurfaceMotion = (previous: TopNavMotionSnapshot, next: TopNavMotionSnapshot, railNode: HTMLElement | null, clearance: number) => {
      if (!railNode) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const widthShift = next.titleWidth - previous.titleWidth;
      const titleRightShift = next.titleRight - previous.titleRight;
      const measuredRailShift = previous.railLeft == null || next.railLeft == null ? 0 : next.railLeft - previous.railLeft;
      const layoutPushShift = Math.max(measuredRailShift, widthShift, titleRightShift);
      const shouldPushFromTitleGrowth = widthShift > 4 || titleRightShift > 4;
      const railShift = measuredRailShift > 4 || layoutPushShift <= 4 ? measuredRailShift : layoutPushShift;
      const shiftDistance = Math.max(Math.abs(measuredRailShift), Math.abs(widthShift), Math.abs(titleRightShift));
      if (shiftDistance <= 4) return;

      const maxLeftTravel = Math.max(0, clearance - 2);
      const startOffset = clampNumber(-measuredRailShift, -140, 140);
      const startX = startOffset < 0 ? Math.max(startOffset, -maxLeftTravel) : startOffset;
      const launchImpulse = shouldPushFromTitleGrowth ? Math.max(railShift, widthShift, titleRightShift) : railShift;
      const launchX = clampNumber(Math.max(56, launchImpulse * 1.72), 56, 128);
      const liftY = -clampNumber(Math.max(2.5, shiftDistance * 0.055), 2.5, 6);
      const defaultOvershoot = clampNumber(Math.max(6, shiftDistance * 0.16), 6, 12);
      const overshootX = -Math.min(defaultOvershoot, maxLeftTravel);
      const squashY = clampNumber(Math.max(1.8, shiftDistance * 0.035), 1.8, 3.8);
      const reboundX = clampNumber(Math.max(2.5, shiftDistance * 0.07), 2.5, 5.5);
      const reboundY = -clampNumber(Math.max(0.8, shiftDistance * 0.016), 0.8, 1.8);

      clearMotionState();
      runningNode.setAttribute("data-top-nav-surface-push", "true");
      railNode.setAttribute("data-top-nav-surface-motion", "magnet");
      railNode.style.setProperty("--meowdesk-top-surface-push-start-x", `${startX}px`);
      railNode.style.setProperty("--meowdesk-top-surface-push-launch-x", `${launchX}px`);
      railNode.style.setProperty("--meowdesk-top-surface-push-lift-y", `${liftY}px`);
      railNode.style.setProperty("--meowdesk-top-surface-push-overshoot-x", `${overshootX}px`);
      railNode.style.setProperty("--meowdesk-top-surface-push-squash-y", `${squashY}px`);
      railNode.style.setProperty("--meowdesk-top-surface-push-rebound-x", `${reboundX}px`);
      railNode.style.setProperty("--meowdesk-top-surface-push-rebound-y", `${reboundY}px`);

      gsap.killTweensOf(railNode);
      gsap.set(railNode, {
        x: startX,
        y: 0,
        willChange: "transform",
        overwrite: true
      });
      const timeline = gsap.timeline({
        defaults: { overwrite: "auto" },
        onComplete: () => {
          railNode.removeAttribute("data-top-nav-surface-motion");
          runningNode.removeAttribute("data-top-nav-surface-push");
          railNode.style.removeProperty("--meowdesk-top-surface-push-start-x");
          railNode.style.removeProperty("--meowdesk-top-surface-push-launch-x");
          railNode.style.removeProperty("--meowdesk-top-surface-push-lift-y");
          railNode.style.removeProperty("--meowdesk-top-surface-push-overshoot-x");
          railNode.style.removeProperty("--meowdesk-top-surface-push-squash-y");
          railNode.style.removeProperty("--meowdesk-top-surface-push-rebound-x");
          railNode.style.removeProperty("--meowdesk-top-surface-push-rebound-y");
          gsap.set(railNode, { clearProps: "transform,willChange" });
          surfaceMotionRef.current = null;
        }
      });

      if (shouldPushFromTitleGrowth) {
        timeline.to(railNode, {
          x: launchX,
          y: liftY,
          duration: 0.68,
          ease: "power2.out"
        }, 0.05)
          .to(railNode, {
            x: launchX,
            y: liftY,
            duration: 0.12,
            ease: "none"
          }, ">");
      }
      timeline.to(railNode, {
        x: overshootX,
        y: squashY,
        duration: shouldPushFromTitleGrowth ? 0.46 : 0.5,
        ease: "power2.in"
      }, shouldPushFromTitleGrowth ? 0.82 : 0.1)
        .to(railNode, {
          x: reboundX,
          y: reboundY,
          duration: 0.16,
          ease: "power2.out"
        }, ">")
        .to(railNode, {
          x: 0,
          y: 0,
          duration: 0.18,
          ease: "power2.out"
        }, ">");

      surfaceMotionRef.current = timeline;
      pushResetTimerRef.current = window.setTimeout(() => {
        if (surfaceMotionRef.current) return;
        runningNode.removeAttribute("data-top-nav-surface-push");
        railNode.removeAttribute("data-top-nav-surface-motion");
        pushResetTimerRef.current = null;
      }, 1900);
    };

    const measured = readMotionSnapshot(title, titleNode, runningNode);
    const previous = previousMotionRef.current;
    const next = measured.snapshot;
    previousMotionRef.current = next;
    if (!previous || previous.title === title) return undefined;

    if (!measured.railNode) {
      motionRetryTimerRef.current = window.setTimeout(() => {
        const retryTitleNode = titleRef.current;
        const retryRunningNode = runningSurfacesRef.current;
        if (!retryTitleNode || !retryRunningNode) return;
        const retry = readMotionSnapshot(title, retryTitleNode, retryRunningNode);
        previousMotionRef.current = retry.snapshot;
        playSurfaceMotion(previous, retry.snapshot, retry.railNode, retry.clearance);
      }, 90);
      return () => {
        if (motionRetryTimerRef.current !== null) {
          window.clearTimeout(motionRetryTimerRef.current);
          motionRetryTimerRef.current = null;
        }
      };
    }

    playSurfaceMotion(previous, next, measured.railNode, measured.clearance);

    return () => {
      clearMotionState();
    };
  }, [title]);

  return (
    <header className={cn("meowdesk-top-nav relative flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/80 px-5", className)} data-top-nav>
      <div className="flex min-w-[160px] flex-1 shrink items-center gap-2 overflow-visible" data-top-nav-title-cluster>
        <div className="inline-flex w-fit min-w-0 shrink-0 flex-col" data-top-nav-title-copy>
          <div
            key={title}
            ref={titleRef}
            className="meowdesk-top-nav-title truncate text-sm font-medium text-foreground"
            aria-label={title}
            data-top-nav-title
            data-top-nav-title-visual="meowdesk-scan"
          >
            <span className="meowdesk-top-nav-title-base">{title}</span>
            <span className="meowdesk-top-nav-title-scan-text" aria-hidden="true">{title}</span>
            <span className="meowdesk-top-nav-title-scan-bar" aria-hidden="true" />
          </div>
        </div>
        {runningSurfaces ? <div ref={runningSurfacesRef} className="pointer-events-none z-10 flex min-w-0 shrink-0 items-center justify-start overflow-visible" data-top-nav-running-surfaces>{runningSurfaces}</div> : null}
      </div>
      {actions ? <div className="ml-auto flex min-w-0 max-w-full shrink-0 items-center justify-end gap-2 overflow-x-auto overflow-y-visible whitespace-nowrap" data-top-nav-actions>{actions}</div> : <div className="ml-auto" data-top-nav-actions-placeholder />}
    </header>
  );
}
