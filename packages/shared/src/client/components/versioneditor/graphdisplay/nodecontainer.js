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
                "graph-node relative flex items-center gap-2 rounded-2xl border px-4 py-2 shadow-[0_12px_30px_-20px_rgba(56,189,248,0.35)] transition-colors duration-200",
                !draggable ? "cursor-default" : "cursor-grab active:cursor-grabbing",
                styling.className,
                className,
            )}
            style={{ ...containerStyle, willChange: "transform" }}
            onDragStart={onDragStart}
            draggable={draggable ?? undefined}
        >
            {children}
        </div>
    );
}

