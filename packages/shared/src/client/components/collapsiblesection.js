"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

export function CollapsibleSection({ title, collapsedView, children, defaultExpanded }) {
  const [open, setOpen] = useState(Boolean(defaultExpanded));
  const contentRef = useRef(null);
  const [maxHeight, setMaxHeight] = useState(open ? "none" : "0px");

  useEffect(() => {
    const node = contentRef.current;
    if (!node) {
      return;
    }

    let timeoutId = null;
    let rafId = null;

    if (open) {
      const measured = node.scrollHeight;
      setMaxHeight(`${measured}px`);
      timeoutId = setTimeout(() => {
        setMaxHeight("none");
      }, 250);
    } else {
      const measured = node.scrollHeight;
      setMaxHeight(`${measured}px`);
      rafId = requestAnimationFrame(() => {
        setMaxHeight("0px");
      });
    }

    return () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [open, children]);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        className="flex w-full items-center justify-between rounded-3xl border border-border/60 bg-surface px-6 py-4 text-left transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="flex flex-col gap-2">
          {title ? <span className="text-sm font-semibold text-emphasis">{title}</span> : null}
          {collapsedView ? <div className="text-xs text-muted">{collapsedView}</div> : null}
        </div>
        <span className={clsx("flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted transition", open ? "bg-primary/10 text-primary" : "bg-surface")}
        >
          <ChevronDown className={clsx("h-4 w-4 transition-transform", open ? "rotate-180" : "")}
            aria-hidden="true"
          />
        </span>
      </button>
      <div
        className={clsx(
          "overflow-hidden transition-[max-height] duration-300 ease-in-out"
        )}
        style={{ maxHeight }}
        ref={contentRef}
      >
        <div className="mt-4 rounded-3xl border border-border/60 bg-surface/90 p-6 shadow-inner">
          {children}
        </div>
      </div>
    </div>
  );
}
