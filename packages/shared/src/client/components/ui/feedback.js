"use client";

import React, { useEffect } from "react";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

const toneConfig = {
  info: {
    container: "border-sky-400/40 bg-sky-500/10 text-sky-100",
    icon: Info,
  },
  success: {
    container: "border-emerald-400/45 bg-emerald-500/10 text-emerald-100",
    icon: CheckCircle2,
  },
  warning: {
    container: "border-amber-400/45 bg-amber-500/10 text-amber-100",
    icon: AlertTriangle,
  },
  error: {
    container: "border-rose-500/45 bg-rose-500/10 text-rose-100",
    icon: XCircle,
  },
};

export function InlineAlert({ tone = "info", title, description, className }) {
  const { container, icon: Icon } = toneConfig[tone] ?? toneConfig.info;

  return (
    <div className={clsx("glass-panel rounded-2xl border px-4 py-3 shadow-soft", container, className)}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="space-y-1 text-sm">
          {title ? <p className="font-semibold">{title}</p> : null}
          {description ? <p className="leading-relaxed opacity-90">{description}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function Toast({ open, tone = "info", message, onClose, autoHideDuration = 4000 }) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      onClose?.();
    }, autoHideDuration);
    return () => window.clearTimeout(timer);
  }, [open, autoHideDuration, onClose]);

  if (!open) {
    return null;
  }

  const { container, icon: Icon } = toneConfig[tone] ?? toneConfig.info;

  return (
    <div className="fixed inset-x-0 bottom-6 z-[1200] flex justify-center px-4">
      <div className={clsx(
        "glass-panel flex max-w-xl items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl",
        container
      )}>
        <Icon className="h-5 w-5" aria-hidden="true" />
        <p className="text-sm font-medium">{message}</p>
        <button
          type="button"
          onClick={() => onClose?.()}
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-surface/80 text-current transition hover:border-primary/50 hover:text-primary"
          aria-label="Dismiss notification"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
