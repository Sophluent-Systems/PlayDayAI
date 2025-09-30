'use client';

import React from 'react';
import clsx from 'clsx';

export function InfoBubble({ children, className = '' }) {
  return (
    <div
      className={clsx(
        'relative w-full max-w-4xl rounded-3xl border border-slate-200 bg-white px-6 py-5 text-slate-900 shadow-[0_18px_45px_-25px_rgba(15,23,42,0.25)]',
        className,
      )}
    >
      <div className="flex w-full items-start gap-4">{children}</div>
    </div>
  );
}
