import React from 'react';
import clsx from 'clsx';

export function RawHTMLBox({ html, className, ...rest }) {
  return (
    <div
      {...rest}
      className={clsx('space-y-2 text-sm leading-relaxed [color:inherit]', className)}
      dangerouslySetInnerHTML={{ __html: html || '' }}
    />
  );
}
