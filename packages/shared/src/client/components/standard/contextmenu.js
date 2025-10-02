"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

export function ContextMenu({ children, menuItems = [] }) {
  const [menuState, setMenuState] = useState({ open: false, x: 0, y: 0 });

  const handleContextMenu = (event) => {
    event.preventDefault();
    setMenuState({
      open: true,
      x: event.clientX,
      y: event.clientY,
    });
  };

  useEffect(() => {
    if (!menuState.open) {
      return undefined;
    }

    const handleClickAway = (event) => {
      if (event.button !== 2) {
        setMenuState({ open: false, x: 0, y: 0 });
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMenuState({ open: false, x: 0, y: 0 });
      }
    };

    document.addEventListener("mousedown", handleClickAway);
    document.addEventListener("contextmenu", handleClickAway);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickAway);
      document.removeEventListener("contextmenu", handleClickAway);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuState.open]);

  const renderMenu = () => {
    if (!menuState.open) {
      return null;
    }

    const style = {
      top: `${menuState.y}px`,
      left: `${menuState.x}px`,
    };

    return createPortal(
      <div className="fixed inset-0 z-[1200]" aria-hidden>
        <div
          className={clsx(
            "absolute min-w-[200px] rounded-2xl border border-border/70 bg-surface/95 py-2 text-sm shadow-2xl backdrop-blur"
          )}
          style={style}
        >
          {menuItems.map((item, index) => (
            <button
              key={`contextmenu-item-${index}`}
              type="button"
              onClick={() => {
                setMenuState({ open: false, x: 0, y: 0 });
                item.onClick?.();
              }}
              className="flex w-full items-center justify-between px-4 py-2 text-left text-emphasis transition hover:bg-primary/10 hover:text-primary"
            >
              <span>{item.label}</span>
              {item.shortcut ? (
                <span className="text-xs uppercase tracking-[0.2em] text-muted">{item.shortcut}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div
      id="context-menu-container"
      onContextMenu={handleContextMenu}
      className="w-full"
      style={{ cursor: "context-menu", userSelect: "none" }}
    >
      {children}
      {renderMenu()}
    </div>
  );
}