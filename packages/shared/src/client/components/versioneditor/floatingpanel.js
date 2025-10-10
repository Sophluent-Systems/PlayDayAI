'use client';
import React, { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

const SIZE_CONFIG = {
  sm: "w-[260px] max-w-[80vw]",
  md: "w-[320px] max-w-[85vw]",
  lg: "w-[380px] max-w-[90vw]",
};

const COLLAPSED_BASE =
  "flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-200/70 shadow-[0_25px_70px_-45px_rgba(56,189,248,0.55)] backdrop-blur transition hover:border-white/20 hover:text-slate-50";

export function FloatingPanel({
  title,
  icon,
  actions,
  children,
  positionClass = "",
  defaultOpen = false,
  open,
  onOpenChange,
  size = "md",
  className = "",
  contentClassName = "",
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = typeof open === "boolean";
  const resolvedOpen = isControlled ? open : internalOpen;

  const containerClasses = useMemo(() => {
    const widthClass = SIZE_CONFIG[size] ?? SIZE_CONFIG.md;
    const base =
      "pointer-events-auto flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 text-slate-100 shadow-[0_45px_120px_-60px_rgba(56,189,248,0.65)] backdrop-blur transition";
    return `${base} ${resolvedOpen ? `${widthClass} px-5 py-4` : "px-2 py-2"} ${className}`.trim();
  }, [className, resolvedOpen, size]);

  const toggleOpen = () => {
    const next = !resolvedOpen;
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  return (
    <div className={`pointer-events-none ${positionClass}`}>
      <div className={containerClasses}>
        <button
          type="button"
          onClick={toggleOpen}
          className={
            resolvedOpen
              ? "pointer-events-auto flex items-center justify-between gap-3 text-left"
              : `pointer-events-auto ${COLLAPSED_BASE}`
          }
          aria-expanded={resolvedOpen}
        >
          <span className="flex items-center gap-3 text-left">
            {icon ? <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">{icon}</span> : null}
            <span className={`flex flex-col ${resolvedOpen ? "" : "leading-tight"}`}>
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-300">
                {title}
              </span>
            </span>
          </span>
          <div className="flex items-center gap-3">
            {actions && resolvedOpen ? <div className="pointer-events-auto">{actions}</div> : null}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${resolvedOpen ? "" : "-rotate-90"}`}
            />
          </div>
        </button>
        {resolvedOpen ? (
          <div
            className={`pointer-events-auto mt-4 max-h-[min(70vh,600px)] overflow-y-auto pr-1 ${contentClassName}`}
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default FloatingPanel;
