import React from 'react';
import Title from './standard/title';

export function MessagesContainer(props) {
  const { theme, title, footer, children } = props;

  const palette = {
    background: theme?.colors?.messagesAreaBackgroundColor ?? '#0b1120',
    footer: theme?.colors?.inputTextDisabledColor ?? '#94a3b8',
  };

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ backgroundColor: palette.background }}
    >
      <div className="sticky top-0 z-10">
        <Title theme={theme} title={title} />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-16 pt-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          {children}
        </div>
      </div>
      {footer && (
        <div className="px-6 pb-6 text-right text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: palette.footer }}>
          {footer}
        </div>
      )}
    </div>
  );
}
