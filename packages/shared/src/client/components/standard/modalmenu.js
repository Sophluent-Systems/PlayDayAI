'use client';
import React, { useState } from "react";
import clsx from "clsx";
import { X } from "lucide-react";

function ActionButton({ tone = "neutral", variant = "solid", className = "", children, ...props }) {
  const baseClasses = "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition";
  const solidMap = {
    neutral: "border border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200",
    primary: "border border-sky-500/90 bg-sky-500 text-white hover:bg-sky-400",
    danger: "border border-rose-500/90 bg-rose-500 text-white hover:bg-rose-400",
  };
  const outlineMap = {
    neutral: "border border-slate-300 text-slate-700 hover:bg-slate-100",
    primary: "border border-sky-500 text-sky-600 hover:bg-sky-50",
    danger: "border border-rose-500 text-rose-600 hover:bg-rose-50",
  };

  const palette = variant === "solid" ? solidMap : outlineMap;
  const toneClasses = palette[tone] || solidMap.neutral;

  return (
    <button type="button" className={clsx(baseClasses, toneClasses, className)} {...props}>
      {children}
    </button>
  );
}

export function ModalMenu({ children, onCloseRequest, onConfirm }) {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleClose = () => {
    if (!onConfirm) {
      onCloseRequest?.();
      return;
    }

    setConfirmDialogOpen(true);
  };

  const handleCancelClose = () => {
    setConfirmDialogOpen(false);
  };

  const handleConfirmClose = () => {
    setConfirmDialogOpen(false);
    onCloseRequest?.();
  };

  const handleOnConfirm = (confirmed) => {
    onConfirm?.(confirmed);
    if (confirmed) {
      onCloseRequest?.();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm" onClick={handleClose}>
        <div className="relative w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 text-slate-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition hover:border-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="max-h-[75vh] overflow-y-auto pr-1">{children}</div>

          {onConfirm && (
            <div className="mt-8 flex justify-end gap-3">
              <ActionButton variant="outline" onClick={() => handleOnConfirm(false)}>
                Cancel
              </ActionButton>
              <ActionButton tone="primary" onClick={() => handleOnConfirm(true)}>
                Done
              </ActionButton>
            </div>
          )}
        </div>
      </div>

      {confirmDialogOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm" onClick={handleCancelClose}>
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold">Done?</h3>
            <p className="mt-3 text-sm text-slate-600">
              Are you sure you want to close without saving?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <ActionButton variant="outline" onClick={handleCancelClose}>
                No
              </ActionButton>
              <ActionButton tone="danger" onClick={handleConfirmClose}>
                Yes
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

