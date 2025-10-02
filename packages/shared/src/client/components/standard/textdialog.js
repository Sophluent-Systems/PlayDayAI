import React, { useEffect, useState } from "react";
import { Modal } from "../ui/modal";

export function TextDialog({ shown, label, currentText, onNewText, ...otherProps }) {
  const [text, setText] = useState(currentText ?? "");

  useEffect(() => {
    if (shown) {
      setText(currentText ?? "");
    }
  }, [shown, currentText]);

  const handleDone = (accept) => {
    if (!shown) {
      return;
    }
    onNewText?.(accept ? text : currentText);
  };

  const footer = [
    <button
      key="cancel"
      type="button"
      className="button-secondary"
      onClick={() => handleDone(false)}
    >
      Cancel
    </button>,
    <button
      key="save"
      type="button"
      className="button-primary"
      onClick={() => handleDone(true)}
    >
      Save
    </button>,
  ];

  return (
    <Modal
      open={Boolean(shown)}
      onClose={() => handleDone(false)}
      title={label}
      size="sm"
      footer={footer}
      {...otherProps}
    >
      <div className="space-y-3">
        <label htmlFor="text-dialog-input" className="text-sm font-semibold text-emphasis">
          {label}
        </label>
        <input
          id="text-dialog-input"
          type="text"
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="w-full rounded-2xl border border-border bg-surface px-4 py-2 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none"
        />
      </div>
    </Modal>
  );
}