"use client";

import React from "react";
import clsx from "clsx";

const toneStyles = {
  neutral: {
    container: "border-border/60 bg-surface/95 text-muted",
    iconWrap: "bg-primary/10 text-primary",
  },
  warning: {
    container: "border-amber-400/60 bg-amber-400/10 text-amber-600 dark:text-amber-200",
    iconWrap: "bg-amber-400/15 text-amber-500 dark:text-amber-300",
  },
  success: {
    container: "border-emerald-400/60 bg-emerald-400/10 text-emerald-600 dark:text-emerald-200",
    iconWrap: "bg-emerald-400/15 text-emerald-500 dark:text-emerald-300",
  },
  danger: {
    container: "border-rose-500/60 bg-rose-500/10 text-rose-600 dark:text-rose-200",
    iconWrap: "bg-rose-500/15 text-rose-500 dark:text-rose-200",
  },
};

export function StatusPanel({ icon: Icon, iconClassName, tone = "neutral", title, description, action, className }) {
  const toneConfig = toneStyles[tone] ?? toneStyles.neutral;

  return (
    <div
      className={clsx(
        "glass-panel rounded-3xl border p-8 shadow-xl backdrop-blur-xl",
        toneConfig.container,
        className
      )}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-1 items-start gap-4">
          {Icon ? (
            <span className={clsx("flex h-12 w-12 items-center justify-center rounded-full", toneConfig.iconWrap)}>
              <Icon className={clsx("h-6 w-6", iconClassName)} aria-hidden="true" />
            </span>
          ) : null}
          <div className="space-y-2">
            {title ? <h2 className="text-lg font-semibold text-emphasis">{title}</h2> : null}
            {description ? <p className="text-sm leading-relaxed">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-3">{action}</div> : null}
      </div>
    </div>
  );
}
