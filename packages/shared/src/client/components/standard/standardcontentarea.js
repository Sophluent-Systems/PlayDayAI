import React from 'react';
import clsx from 'clsx';
import { useAtom } from 'jotai';
import { vhState } from '@src/client/states';

export function StandardContentArea({ children, className }) {
  const [vh] = useAtom(vhState);

  return (
    <div
      style={{ minHeight: `${vh}px` }}
      className={clsx(
        'flex w-full flex-1 flex-col items-center justify-start bg-gradient-to-br from-[#030712] via-[#050a1a] to-[#0f172a] px-4 py-6 sm:px-8',
        className,
      )}
    >
      {children}
    </div>
  );
}
