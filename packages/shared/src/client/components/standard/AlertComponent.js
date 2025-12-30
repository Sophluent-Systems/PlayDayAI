import React from "react";
import { Modal } from "../ui/modal";

const renderMessageContent = (message) => {
  if (message == null) {
    return null;
  }

  if (typeof message === "string") {
    return <p className="text-sm text-muted whitespace-pre-line">{message}</p>;
  }

  if (React.isValidElement(message)) {
    return <div className="text-sm text-muted">{message}</div>;
  }

  if (message instanceof Error) {
    const errorText = message.message || message.toString();

    return (
      <div className="text-sm text-muted whitespace-pre-line">
        {errorText}
        {message.stack ? (
          <pre className="mt-2 whitespace-pre-wrap text-xs text-muted overflow-x-auto">
            {message.stack}
          </pre>
        ) : null}
      </div>
    );
  }

  if (typeof message === "object") {
    if (typeof message.message === "string") {
      return <p className="text-sm text-muted whitespace-pre-line">{message.message}</p>;
    }

    try {
      const serialized = JSON.stringify(message, null, 2);
      return (
        <pre className="text-sm text-muted whitespace-pre-wrap overflow-x-auto">
          {serialized}
        </pre>
      );
    } catch (serializationError) {
      return <p className="text-sm text-muted whitespace-pre-line">{String(message)}</p>;
    }
  }

  return <p className="text-sm text-muted whitespace-pre-line">{String(message)}</p>;
};

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
      {renderMessageContent(message)}
    </Modal>
  );
};
