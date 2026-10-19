import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

function assignForwardedRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, onPointerDown, onClickCapture, onFocusCapture, onKeyDownCapture, ...props }, ref) => {
  const listRef = React.useRef<React.ElementRef<typeof TabsPrimitive.List> | null>(null);
  const scheduledSyncsRef = React.useRef<{ frames: number[]; timers: number[] }>({ frames: [], timers: [] });
  const setRefs = React.useCallback((node: React.ElementRef<typeof TabsPrimitive.List> | null) => {
    listRef.current = node;
    assignForwardedRef(ref, node);
  }, [ref]);
  const clearScheduledSyncs = React.useCallback(() => {
    scheduledSyncsRef.current.frames.forEach((frame) => window.cancelAnimationFrame(frame));
    scheduledSyncsRef.current.timers.forEach((timer) => window.clearTimeout(timer));
    scheduledSyncsRef.current = { frames: [], timers: [] };
  }, []);

  const syncCursor = React.useCallback((preferred?: Element | null) => {
    const list = listRef.current;
    if (!list) return;
    const triggers = Array.from(list.querySelectorAll<HTMLElement>(":scope > [role='tab']"))
      .filter((trigger) => {
        const rect = trigger.getBoundingClientRect();
        const style = window.getComputedStyle(trigger);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
    const preferredTrigger = preferred instanceof HTMLElement && triggers.includes(preferred) ? preferred : null;
    const active = preferredTrigger ||
      triggers.find((trigger) => trigger.dataset.state === "active" || trigger.getAttribute("aria-selected") === "true") ||
      triggers[0];
    if (!active) {
      list.dataset.meowSegmentReady = "false";
      return;
    }
    const listRect = list.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const width = Math.max(0, Math.min(activeRect.width, listRect.width));
    const height = Math.max(0, Math.min(activeRect.height, listRect.height));
    const x = Math.max(0, Math.min(activeRect.left - listRect.left, Math.max(0, listRect.width - width)));
    const y = Math.max(0, Math.min(activeRect.top - listRect.top, Math.max(0, listRect.height - height)));
    const nextVars = {
      "--meow-segment-x": `${Math.round(x)}px`,
      "--meow-segment-y": `${Math.round(y)}px`,
      "--meow-segment-width": `${Math.round(width)}px`,
      "--meow-segment-height": `${Math.round(height)}px`
    };
    Object.entries(nextVars).forEach(([name, value]) => {
      if (list.style.getPropertyValue(name) !== value) {
        list.style.setProperty(name, value);
      }
    });
    if (list.dataset.meowSegmentReady !== "true") {
      list.dataset.meowSegmentReady = "true";
    }
  }, []);
  const queueCursorSync = React.useCallback((preferred?: Element | null) => {
    clearScheduledSyncs();
    const run = () => syncCursor(preferred instanceof HTMLElement && preferred.isConnected ? preferred : null);
    run();
    const frames = scheduledSyncsRef.current.frames;
    const timers = scheduledSyncsRef.current.timers;
    frames.push(window.requestAnimationFrame(run));
    frames.push(window.requestAnimationFrame(() => {
      frames.push(window.requestAnimationFrame(run));
    }));
    [60, 180, 360, 720].forEach((delay) => {
      timers.push(window.setTimeout(run, delay));
    });
  }, [clearScheduledSyncs, syncCursor]);
  const triggerFromEvent = React.useCallback((target: EventTarget | null) => {
    const trigger = (target as Element | null)?.closest?.("[role='tab']");
    return trigger?.parentElement === listRef.current ? trigger : null;
  }, []);

  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    queueCursorSync();
    const resizeObserver = new ResizeObserver(() => queueCursorSync());
    resizeObserver.observe(list);
    Array.from(list.children).forEach((child) => resizeObserver.observe(child));
    const mutationObserver = new MutationObserver(() => queueCursorSync());
    mutationObserver.observe(list, { attributes: true, childList: true, subtree: true, attributeFilter: ["data-state", "aria-selected", "hidden", "class", "style"] });
    const handleWindowResize = () => queueCursorSync();
    window.addEventListener("resize", handleWindowResize);
    return () => {
      clearScheduledSyncs();
      window.removeEventListener("resize", handleWindowResize);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [children, clearScheduledSyncs, queueCursorSync]);

  return (
    <TabsPrimitive.List
      ref={setRefs}
      className={cn("meowdesk-segmented-control inline-flex h-9 items-center rounded-lg border border-border bg-background/60 p-1", className)}
      data-meow-segmented-control
      onPointerDown={(event) => {
        const trigger = triggerFromEvent(event.target);
        if (trigger) queueCursorSync(trigger);
        onPointerDown?.(event);
      }}
      onClickCapture={(event) => {
        const trigger = triggerFromEvent(event.target);
        if (trigger) queueCursorSync(trigger);
        onClickCapture?.(event);
      }}
      onFocusCapture={(event) => {
        const trigger = triggerFromEvent(event.target);
        if (trigger) queueCursorSync(trigger);
        onFocusCapture?.(event);
      }}
      onKeyDownCapture={(event) => {
        const trigger = triggerFromEvent(event.target);
        if (trigger) window.setTimeout(() => queueCursorSync(trigger), 0);
        onKeyDownCapture?.(event);
      }}
      {...props}
    >
      <span className="meowdesk-segment-cursor" aria-hidden="true" data-meow-segment-cursor />
      {children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex h-7 items-center justify-center rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 data-[state=active]:text-foreground",
      className
    )}
    data-meow-segment-trigger
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-3 focus-visible:outline-none", className)} {...props} />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
