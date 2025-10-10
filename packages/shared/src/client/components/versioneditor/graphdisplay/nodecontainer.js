'use client';
import React from "react";
import clsx from "clsx";

export function NodeContainer(props) {
    const {
        styling = {},
        children,
        onDragStart,
        draggable,
        width,
        height,
        className,
    } = props;

    if (width === undefined || height === undefined) {
        throw new Error("NodeContainer requires width and height props");
    }

    const resolveDimension = (dimension) =>
        typeof dimension === 'number' ? `${dimension}px` : dimension;

    const containerStyle = {
        width: resolveDimension(width),
        height: resolveDimension(height),
        backgroundColor: styling.backgroundColor || "rgba(12, 26, 48, 0.85)",
        color: styling.color || "#f8fafc",
        borderStyle: styling.borderStyle || "solid",
        borderColor: styling.borderColor || "rgba(148, 163, 184, 0.4)",
        ...(styling.style || {}),
    };

    return (
        <div
            className={clsx(
                "relative flex items-center gap-2 rounded-2xl border px-4 py-2 shadow-[0_18px_45px_-30px_rgba(56,189,248,0.45)] backdrop-blur transition-colors duration-200",
                !draggable ? "cursor-default" : "cursor-grab active:cursor-grabbing",
                styling.className,
                className,
            )}
            style={containerStyle}
            onDragStart={onDragStart}
            draggable={draggable}
        >
            {children}
        </div>
    );
}

