"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useAtom } from "jotai";
import { MenuItemList } from "./menuitemlist";
import { vhState } from "@src/client/states";

export function MenuItemDropdown({ menuItems = [], onMenuItemSelected, selectedIndex = 0, autoSelect, title }) {
  const triggerRef = useRef(null);
  const [vh] = useAtom(vhState);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);

  const closeMenu = useCallback(() => setIsOpen(false), []);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  const openMenu = () => {
    updateMenuPosition();
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (triggerRef.current && !triggerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleResize = () => {
      updateMenuPosition();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [isOpen, updateMenuPosition]);

  const selectedLabel = (() => {
    const item = menuItems[selectedIndex];
    if (React.isValidElement(item)) {
      return item.props.children ?? item.props.label ?? `Item ${selectedIndex + 1}`;
    }
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return item.label ?? item.primary ?? item.text ?? `Item ${selectedIndex + 1}`;
    }
    if (item === null || item === undefined) {
      return "Select an item";
    }
    return String(item);
  })();

  const renderMenu = () => {
    if (!isOpen || !menuPosition) {
      return null;
    }

    const menuStyle = {
      top: `${menuPosition.top}px`,
      left: `${menuPosition.left}px`,
      minWidth: `${menuPosition.width}px`,
      maxHeight: `${Math.max(vh - 80, 260)}px`,
    };

    return createPortal(
      <div className="fixed inset-0 z-[1150]" aria-hidden>
        <div
          className="absolute overflow-hidden rounded-3xl border border-border/70 bg-surface/95 py-2 shadow-2xl backdrop-blur"
          style={menuStyle}
        >
          <MenuItemList
            menuItems={menuItems}
            autoSelect={autoSelect}
            selectedIndex={selectedIndex}
            onMenuItemSelected={(index) => {
              onMenuItemSelected?.(index);
              closeMenu();
            }}
          />
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        title={title ?? "Select an item"}
        className={clsx(
          "inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-emphasis transition",
          "hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={clsx("h-4 w-4 transition", isOpen && "rotate-180 text-primary")}
          aria-hidden="true"
        />
      </button>
      {renderMenu()}
    </div>
  );
}