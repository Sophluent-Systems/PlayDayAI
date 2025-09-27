import React from "react";
import { ChatCard } from "./chatcard";
import { stateManager } from "@src/client/statemanager";

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

  return (
    <div className="flex w-full flex-col items-center gap-6 pb-10">
      {messages.map((message, index) => {
        if (message.deleted) {
          return null;
        }
        if ((message.hideOutput || message.persona?.hideFromEndUsers) && !showHidden) {
          return null;
        }
        return (
          <ChatCard
            key={message.recordID || `${message.timestamp}-${index}`}
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
          />
        );
      })}
    </div>
  );
}
