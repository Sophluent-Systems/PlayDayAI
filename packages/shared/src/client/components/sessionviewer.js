import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { MessagesContainer } from '@src/client/components/messagescontainer';
import { FilteredMessageList } from '@src/client/components/filteredmessagelist';
import { callGetSessionInfo } from '@src/client/gameplay';
import { callSubmitMessageRating } from '@src/client/responseratings';
import { findMessageIndexByRecordID } from '@src/common/messages';
import { callGetRecordResultField, callGetMessageHistorySnapshot } from '@src/client/editor';
import { defaultAppTheme } from '@src/common/theme';
import TextPreviewModal from './standard/textpreviewmodal';
import {
  Box,
  Button,
} from '@mui/material';
import { FileCopy } from '@mui/icons-material';
import { callCloneSession } from '@src/client/editor';
import { stateManager } from '@src/client/statemanager';
import { useConfig } from '@src/client/configprovider';
import { makeStyles } from 'tss-react/mui';


const useStyles = makeStyles()((theme) => ({
  container: {
       height: '100%',
        width: '100%',
       flexDirection: 'column',
       display: 'flex',
       justifyContent: 'center',
       marginTop: theme.spacing(1),
       backgroundColor: theme.palette.background.main,
   },
 }));

export function SessionViewer(props) {
  const { classes } = useStyles();
  const { Constants } = useConfig();
  const { 
    theme, 
    sessionID, 
    game,
    editMode
  } = props;
  const router = useRouter();
  const [sessionInfo, setSessionInfo] = useState(null);
  const [isDocPreviewOpen, setIsDocPreviewOpen] = useState(false);
  const [docPreviewText, setDocPreviewText] = useState("");
  const { switchSessionID, navigateTo, session } = React.useContext(stateManager);
  const [messageFilter, setMessageFilter] = useState(Constants.defaultMessageFilter);
  const scrollRef = useRef(null);
  const messageUpdateHandlers = {
      replaceMessageList: (newMessages) => {
        scrollToBottom();
      },
      newMessage: (message) => {
        scrollToBottom();
      }, 
      updateMessage: (message) => {
        scrollToBottom();
      },
      messageComplete: (message) => {
        scrollToBottom();
      },
 };
 const [messages, setMessages] = useState([]);
   
  function scrollToBottom() {
    const timer = setTimeout(() => {
      if (messagesScrollRef.current) {
       messagesScrollRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
};

  useEffect(() => {
    async function requestGameInfo() {
      if (sessionID) {
        try {
            const messageHistoryResponse = await callGetMessageHistorySnapshot(game.gameID, sessionID); 
            setMessages(messageHistoryResponse.messages);
        } catch (error) {
            console.error('Error fetching game info:', error);
            router.replace('/');
        };
      } 
    }
    requestGameInfo();
  }, [sessionID]);


  async function showRecordResultFields(props) {
    const { recordID, fields, label } = props;
    let prompt = await callGetRecordResultField(sessionID, recordID, fields);
    let text = prompt;
    if (text) {
     const screenReadyText = text.replace(/\\n/gi, '\n'); 
     setDocPreviewText(label + "\n\n" + screenReadyText);
     setIsDocPreviewOpen(true);
    }
 }


  async function handleCardActionSelected(action, params) {
    if (action === "responseFeedback") {
        const {
          message,
          isPlayerRating,
          rating
        } = params;

        let result =  await callSubmitMessageRating(session, message.index, isPlayerRating ? rating : undefined, !isPlayerRating ? rating : undefined);
        let updatedMessage = {...result.message};
        const arrayIndex = findMessageIndexByRecordID(messages,  recordID);
        var newMessages = [...messages];
        newMessages[arrayIndex] = updatedMessage;
        setMessages(newMessages);
    } else if (action === "showRecordResultFields") {
      await showRecordResultFields(props);
    }
  }

  async function handleCopyToDebug() {
    const response = await callCloneSession(game.gameID, sessionID);
    const newSessionID = response.sessionID;
    console.log("New session ID: ", newSessionID)
    await switchSessionID(newSessionID);
    navigateTo("/play", game.url);
  }

  const themeToUse = sessionInfo?.game?.theme ? sessionInfo.game.theme : defaultAppTheme;

  return (
        <Box className={classes.container}>
            <MessagesContainer
                theme={{...defaultAppTheme, ...game.theme}}
                title={game?.title}
                footer={sessionInfo?.versionInfo.versionName ? `Version: ${sessionInfo?.versionInfo.versionName}` : ``}
                editMode={true}
            >

                  <FilteredMessageList
                        theme={theme}
                        messages={messages}
                        responseFeedbackMode={{user: "readonly", admin: "edit"}}
                        editMode={editMode}
                        onCardActionSelected={handleCardActionSelected}
                        messageFilter={messageFilter ? messageFilter : Constants.defaultMessageFilter}
                    />

                    <div ref={scrollRef} />
            </MessagesContainer>
            
            <Box style={{ display: 'flex', gap: '8px',  justifyContent: 'center', padding: 1, margin: 5 }}>
                
                <Button
                variant="contained"
                color="secondary"
                onClick={() => handleCopyToDebug()}
                startIcon={<FileCopy />}
                >
                Copy to Debug
                </Button>
            </Box>
            
        <TextPreviewModal isOpen={isDocPreviewOpen} text={docPreviewText} onClose={() => setIsDocPreviewOpen(false)} />
      </Box>
  );
}

export default SessionViewer;
