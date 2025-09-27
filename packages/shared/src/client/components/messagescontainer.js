import React from "react";

export function MessagesContainer(props) {
  const {
    theme,
    title,
    footer,
    children,
  } = props;

  const colors = theme?.colors || {};
  const fonts = theme?.fonts || {};

  return (
    <div
      className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"
      style={{ backgroundColor: colors.messagesAreaBackgroundColor || "#050B1B" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent opacity-10" />

      <div className="relative z-10 flex flex-col items-center gap-6 px-4 pb-16">
        {title && (
          <div className="mt-6 text-center">
            <div
              className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60"
              style={{ fontFamily: fonts.titleFont }}
            >
              {title}
            </div>
          </div>
        )}

        {children}

        {footer && (
          <span
            className="self-end pr-4 text-[10px] uppercase tracking-[0.35em] text-white/50"
            style={{ fontFamily: fonts.fontFamily }}
          >
            {footer}
          </span>
        )}
      </div>
    </div>
  );
}
