import React from "react";
import { ChatCard } from "./chatcard";
import { stateManager } from "@src/client/statemanager";

function buildMessageTree(messages) {
  const roots = [];
  const stack = [];

  const isPrefix = (path, prefix) => {
    if (!prefix || prefix.length === 0) {
      return true;
    }
    if (!path || prefix.length > path.length) {
      return false;
    }
    for (let i = 0; i < prefix.length; i += 1) {
      if (path[i] !== prefix[i]) {
        return false;
      }
    }
    return true;
  };

  messages.forEach((message, index) => {
    const path = Array.isArray(message.componentBreadcrumb)
      ? [...message.componentBreadcrumb]
      : [];

    while (stack.length > 0 && !isPrefix(path, stack[stack.length - 1].path)) {
      stack.pop();
    }

    const key = message.recordID || `${message.nodeInstanceID || "node"}:${index}`;
    const node = {
      message,
      path,
      key,
      index,
      children: [],
    };

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node);
    } else {
      roots.push(node);
    }

    if (message.isComponentRoot) {
      stack.push(node);
    }
  });

  const computeDescendantCount = (node) => {
    let total = 0;
    node.children.forEach((child) => {
      total += 1 + computeDescendantCount(child);
    });
    node.descendantCount = total;
    return total;
  };

  roots.forEach((node) => computeDescendantCount(node));
  return roots;
}

export function FilteredMessageList(props) {
  const {
    theme,
    messages,
    onMessageDelete,
    onCardActionSelected,
    responseFeedbackMode,
    waitingForProcessingToComplete,
    onDebugSingleStep,
    onToggleSingleStep,
    onRequestAudioControl,
    playbackState,
    sessionID,
    showHidden,
  } = props;
  const { editMode } = React.useContext(stateManager);

  const messageTree = React.useMemo(() => buildMessageTree(messages), [messages]);
  const [collapsedComponents, setCollapsedComponents] = React.useState(() => new Set());

  React.useEffect(() => {
    setCollapsedComponents((previous) => {
      if (!previous || previous.size === 0) {
        return previous;
      }
      const next = new Set();
      const visit = (node) => {
        if (previous.has(node.key)) {
          next.add(node.key);
        }
        node.children.forEach(visit);
      };
      messageTree.forEach(visit);
      return next;
    });
  }, [messageTree]);

  const toggleComponent = React.useCallback((key) => {
    setCollapsedComponents((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const renderNode = (node, depth = 0) => {
    const { message, children, key, index, descendantCount } = node;
    if (message.deleted) {
      return null;
    }
    if ((message.hideOutput || message.persona?.hideFromEndUsers) && !showHidden) {
      return null;
    }

    const isComponentRoot = Boolean(message.isComponentRoot);
    const hasChildren = children.length > 0;
    const collapsed = isComponentRoot && collapsedComponents.has(key);

    return (
      <React.Fragment key={key}>
        <ChatCard
          message={message}
          responseFeedbackMode={responseFeedbackMode}
          theme={theme}
          onDelete={() => onMessageDelete?.(index)}
          deleteAllowed={Boolean(onMessageDelete)}
          waitingForProcessingToComplete={waitingForProcessingToComplete}
          editMode={editMode}
          onCardActionSelected={onCardActionSelected}
          sessionID={sessionID}
          onRequestAudioControl={onRequestAudioControl}
          playbackState={playbackState}
          onDebugSingleStep={onDebugSingleStep}
          onToggleSingleStep={onToggleSingleStep}
          depth={depth}
          isComponentRoot={isComponentRoot}
          hasChildren={hasChildren}
          collapsed={collapsed}
          onToggleCollapsed={
            hasChildren && isComponentRoot ? () => toggleComponent(key) : undefined
          }
          descendantCount={descendantCount}
        />
        {!collapsed &&
          children.map((child) => renderNode(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="flex w-full flex-col items-center gap-6 pb-10">
      {messageTree.map((node) => renderNode(node, 0))}
    </div>
  );
}
