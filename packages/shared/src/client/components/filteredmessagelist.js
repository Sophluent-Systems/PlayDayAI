import React, { useRef, useEffect, useState } from 'react';
import { 
    Box,
} from '@mui/material';
import { vhState } from '@src/client/states';
import { useAtom } from 'jotai';
import { ChatCard } from './chatcard';
import { stateManager } from '@src/client/statemanager';
import { nullUndefinedOrEmpty } from '@src/common/objects';


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
    const { account, editMode } = React.useContext(stateManager);
    const [messageAreaHeight, setMessageAreaHeight] = useState(0);
    const inputAreaRef = useRef(null);
    const [vh, setVh] = useAtom(vhState);

    useEffect(() => {
      
    // Function to update width
    const updateIntputAreaHeight = () => {
      if (inputAreaRef.current) {
        const inputAreaHeight = inputAreaRef.current.offsetHeight;
        const newMessageAreaHeight = vh - inputAreaHeight-1;
        if (messageAreaHeight != newMessageAreaHeight) {
          setMessageAreaHeight(newMessageAreaHeight);
        }
      }
    };

    // Call once to set initial width
    updateIntputAreaHeight();

    // Add resize event listener
    window.addEventListener('resize', updateIntputAreaHeight);

    // Clean up
    return () => {
      window.removeEventListener('resize', updateIntputAreaHeight);
    };


    }), [];


    return (
      <Box sx={{
          display: "flex",
          flexDirection: "column",
          width: '100%',
          justifyItems: 'center',
          alignItems: 'center',
          paddingTop: 8,
      }}>
                {messages.map((message, index) => {
                  if (message.deleted) {
                    return null;
                  }
                  if ((message.hideOutput || message.persona?.hideFromEndUsers) && !showHidden) {
                    return null;
                  }
                  return <ChatCard
                    message={message}
                    key={message.recordID}
                    responseFeedbackMode={responseFeedbackMode}
                    theme={theme}
                    onDelete={() => onMessageDelete(index)}
                    deleteAllowed={!!onMessageDelete}
                    waitingForProcessingToComplete={waitingForProcessingToComplete}
                    editMode={editMode}
                    onCardActionSelected={onCardActionSelected}
                    sessionID={sessionID}
                    onRequestAudioControl={onRequestAudioControl}
                    playbackState={playbackState}
                  />;
                })
              }
                
      </Box>
    );
};
