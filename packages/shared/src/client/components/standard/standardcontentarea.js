'use client';
import React from 'react';
import clsx from 'clsx';
import { useAtom } from 'jotai';
import { vhState } from '@src/client/states';

export function StandardContentArea({ children, className = '', style }) {
  const [vh] = useAtom(vhState);
  const inlineStyle = { minHeight: String(vh || 0) + 'px', ...(style || {}) };

  return (
    <div
      className={clsx(
        'flex w-full flex-1 flex-col items-center bg-slate-50 px-6 pb-10 pt-8 sm:px-8 lg:px-12',
        className,
      )}
      style={inlineStyle}
    >
      {children}
    </div>
  );
}
