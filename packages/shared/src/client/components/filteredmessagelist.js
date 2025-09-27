import React, { useMemo } from 'react';
import { ChatCard } from './chatcard';
import { stateManager } from '@src/client/statemanager';

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

  const visibleMessages = useMemo(() => {
    if (!Array.isArray(messages)) {
      return [];
    }
    return messages.filter((message) => {
      if (!message || message.deleted) {
        return false;
      }
      if ((message.hideOutput || message.persona?.hideFromEndUsers) && !showHidden) {
        return false;
      }
      return true;
    });
  }, [messages, showHidden]);

  return (
    <div className="flex w-full flex-col items-center gap-4 px-2 pb-8 sm:px-4">
      {visibleMessages.map((message, index) => (
        <ChatCard
          key={message.recordID || ${message.timestamp}-}
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
      ))}
    </div>
  );
}
