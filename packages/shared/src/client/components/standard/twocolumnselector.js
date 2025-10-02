import React, { useState } from "react";
import clsx from "clsx";
import { ArrowLeft, ArrowRight } from "lucide-react";

export function TwoColumnSelector({
  columnAlabel,
  columnAdata = [],
  columnBlabel,
  columnBdata = [],
  onAsynchronouslyMoveItems,
}) {
  const [selectedFromColumnA, setSelectedFromColumnA] = useState([]);
  const [selectedFromColumnB, setSelectedFromColumnB] = useState([]);

  const toggleSelection = (value, column) => {
    if (column === "A") {
      setSelectedFromColumnA((current) =>
        current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
      );
    } else {
      setSelectedFromColumnB((current) =>
        current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
      );
    }
  };

  const transferItems = async (direction) => {
    if (direction === "columnA" && selectedFromColumnB.length > 0) {
      const shouldMove = (await onAsynchronouslyMoveItems?.(selectedFromColumnB, null)) ?? true;
      if (shouldMove) {
        setSelectedFromColumnB([]);
      }
    }

    if (direction === "columnB" && selectedFromColumnA.length > 0) {
      const shouldMove = (await onAsynchronouslyMoveItems?.(null, selectedFromColumnA)) ?? true;
      if (shouldMove) {
        setSelectedFromColumnA([]);
      }
    }
  };

  const renderColumn = (data, label, selected, column) => (
    <div className="flex min-w-[220px] flex-1 flex-col gap-3">
      <div className="text-center text-sm font-semibold text-muted uppercase tracking-[0.3em]">
        {label}
      </div>
      <div className="glass-panel flex-1 overflow-hidden">
        <div className="flex max-h-[360px] flex-col gap-2 overflow-auto">
          {data.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              {column === "A" ? "No items assigned" : "No items available"}
            </div>
          ) : (
            data.map((item) => {
              const isSelected = selected.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleSelection(item, column)}
                  className={clsx(
                    "w-full rounded-2xl px-4 py-2 text-left text-sm font-medium transition",
                    isSelected
                      ? "bg-primary/15 text-primary shadow-[0_15px_40px_-28px_rgba(99,102,241,0.45)]"
                      : "text-emphasis hover:bg-primary/5"
                  )}
                >
                  {item}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-border/60 bg-surface/85 p-6 shadow-soft lg:flex-row">
      {renderColumn(columnAdata, columnAlabel, selectedFromColumnA, "A")}
      <div className="flex flex-col items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => transferItems("columnA")}
          disabled={selectedFromColumnB.length === 0}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-surface text-muted transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => transferItems("columnB")}
          disabled={selectedFromColumnA.length === 0}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-surface text-muted transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {renderColumn(columnBdata, columnBlabel, selectedFromColumnB, "B")}
    </div>
  );
}
