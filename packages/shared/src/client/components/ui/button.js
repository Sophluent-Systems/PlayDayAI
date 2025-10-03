"use client";

import React from "react";
import clsx from "clsx";

const VARIANT_STYLES = {
  primary:
    "bg-primary text-white shadow-[0_20px_45px_-20px_rgba(99,102,241,0.55)] hover:bg-primary/90 focus-visible:ring-primary/30",
  secondary:
    "border border-border/70 bg-surface/80 text-emphasis hover:border-primary/50 hover:text-primary focus-visible:ring-primary/25",
  ghost: "text-muted hover:text-primary",
  danger:
    "bg-rose-500 text-white shadow-[0_20px_45px_-20px_rgba(244,63,94,0.6)] hover:bg-rose-500/90 focus-visible:ring-rose-400/30",
};

const SIZE_STYLES = {
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-sm",
  sm: "h-9 px-4 text-xs",
};

export function Button({
  as: Component = "button",
  variant = "primary",
  size = "md",
  icon: Icon,
  iconPosition = "left",
  className,
  children,
  disabled,
  ...rest
}) {
  const variantClass = VARIANT_STYLES[variant] ?? VARIANT_STYLES.primary;
  const sizeClass = SIZE_STYLES[size] ?? SIZE_STYLES.md;

  return (
    <Component
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60",
        variantClass,
        sizeClass,
        className
      )}
      disabled={disabled}
      {...rest}
    >
      {Icon && iconPosition === "left" ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      <span>{children}</span>
      {Icon && iconPosition === "right" ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
    </Component>
  );
}

export const PrimaryButton = React.forwardRef(function PrimaryButton(props, ref) {
  return <Button ref={ref} variant="primary" {...props} />;
});

export const SecondaryButton = React.forwardRef(function SecondaryButton(props, ref) {
  return <Button ref={ref} variant="secondary" {...props} />;
});

export const GhostButton = React.forwardRef(function GhostButton(props, ref) {
  return <Button ref={ref} variant="ghost" {...props} />;
});

export const DangerButton = React.forwardRef(function DangerButton(props, ref) {
  return <Button ref={ref} variant="danger" {...props} />;
});
