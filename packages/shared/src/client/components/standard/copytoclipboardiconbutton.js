"use client";

import React, { useState } from "react";

export function CopyToClipboardIconButton({ textToCopy, icon, label = "Copy to clipboard" }) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy ?? "");
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  };

  const title = isCopied ? "Copied!" : label;

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={title}
      aria-label={title}
      className="inline-flex items-center justify-center rounded-full border border-border bg-surface p-2 text-muted transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {icon}
    </button>
  );
}