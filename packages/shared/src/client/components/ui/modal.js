"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { X } from "lucide-react";

const portalTarget = typeof window !== "undefined" ? () => document.body : null;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  showCloseButton = true,
  layerClassName,
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open || !portalTarget) {
    return null;
  }

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-xl",
    lg: "max-w-3xl",
  }[size] ?? "max-w-xl";

  return createPortal(
    <div
      className={clsx(
        "fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4",
        layerClassName ?? "z-[1000]",
      )}
      role="dialog"
      aria-modal="true"
      onClick={() => onClose?.()}
    >
      <div
        className={clsx(
          "glass-panel relative w-full",
          maxWidthClass,
          "border border-border/70 bg-surface/95 p-8 shadow-2xl"
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {showCloseButton ? (
          <button
            type="button"
            onClick={() => onClose?.()}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-surface/90 text-muted transition hover:border-primary/50 hover:text-primary"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}

        {(title || description) && (
          <div className="space-y-3">
            {title ? <h2 className="text-xl font-semibold text-emphasis">{title}</h2> : null}
            {description ? <p className="text-sm text-muted">{description}</p> : null}
          </div>
        )}

        {children ? (
          <div className={clsx(title || description ? "mt-6" : undefined, "space-y-4")}>{children}</div>
        ) : null}

        {Array.isArray(footer) ? (
          <div className="mt-8 flex flex-wrap justify-end gap-3">{footer}</div>
        ) : footer ? (
          <div className="mt-8 flex justify-end">{footer}</div>
        ) : null}
      </div>
    </div>,
    portalTarget()
  );
}
