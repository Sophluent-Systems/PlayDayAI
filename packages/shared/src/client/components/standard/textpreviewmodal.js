import React from "react";
import { Modal } from "../ui/modal";

function TextPreviewModal({ isOpen, text, onClose, title = "Preview" }) {
  return (
    <Modal
      open={Boolean(isOpen)}
      onClose={onClose}
      title={title}
      size="lg"
    >
      <div className="max-h-[60vh] overflow-auto rounded-2xl border border-border/60 bg-surface/90 p-4">
        <pre className="whitespace-pre-wrap font-mono text-sm text-muted">{text ?? ""}</pre>
      </div>
    </Modal>
  );
}

export default TextPreviewModal;
