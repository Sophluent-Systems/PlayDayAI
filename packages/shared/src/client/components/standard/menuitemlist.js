"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";

export function MenuItemList({ menuItems = [], onMenuItemSelected = () => {}, selectedIndex, autoSelect }) {
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);

  useEffect(() => {
    if (selectedIndex !== null && selectedIndex !== undefined) {
      setSelectedMenuItem(selectedIndex);
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (autoSelect && menuItems.length > 0 && selectedMenuItem === null) {
      setSelectedMenuItem(0);
      onMenuItemSelected(0);
    }
  }, [autoSelect, menuItems, onMenuItemSelected, selectedMenuItem]);

  const handleMenuItemSelected = (index) => {
    if (autoSelect) {
      setSelectedMenuItem(index);
    }
    onMenuItemSelected(index);
  };

  const renderMenuItem = (item, index) => {
    const isSelected = index === selectedMenuItem;
    const baseClass = clsx(
      "flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-2 text-left text-sm transition",
      isSelected
        ? "bg-primary/10 text-primary"
        : "text-emphasis hover:bg-primary/5 hover:text-primary"
    );

    if (React.isValidElement(item)) {
      const existingOnClick = item.props.onClick;
      const mergedOnClick = (event) => {
        existingOnClick?.(event);
        if (!event.defaultPrevented) {
          handleMenuItemSelected(index);
        }
      };

      return React.cloneElement(item, {
        key: item.key ?? index,
        onClick: mergedOnClick,
        className: clsx(baseClass, item.props.className),
      });
    }

    let label = null;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      label = item.label ?? item.primary ?? item.text ?? "";
    } else {
      label = item ?? "";
    }

    return (
      <button
        key={index}
        type="button"
        onClick={() => handleMenuItemSelected(index)}
        className={baseClass}
      >
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return <div className="flex flex-col gap-1 py-1">{menuItems.map(renderMenuItem)}</div>;
}