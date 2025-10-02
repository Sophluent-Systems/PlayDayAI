import React from "react";
import { Modal } from "../ui/modal";

export const AlertComponent = ({ title, message, actions = [], onClose }) => {
  const footerButtons = actions.map((action, index) => {
    const handleClick = () => {
      action.onPress?.();
      onClose?.();
    };

    const buttonClass = index === 0 ? "button-primary" : "button-secondary";

    return (
      <button key={index} type="button" className={buttonClass} onClick={handleClick}>
        {action.text}
      </button>
    );
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={footerButtons}
    >
      {message ? (
        typeof message === "string" ? (
          <p className="text-sm text-muted">{message}</p>
        ) : (
          <div className="text-sm text-muted">{message}</div>
        )
      ) : null}
    </Modal>
  );
};