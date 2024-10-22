import React, { useRef, useEffect, useState } from 'react';
import { 
    TextField, 
    IconButton, 
    Box,
    Typography,
    Button,
} from '@mui/material';
import { ArrowUpward } from '@mui/icons-material';
import { ArrowDownward } from '@mui/icons-material';
import { MessagesContainer } from './messagescontainer';
import { makeStyles } from 'tss-react/mui';
import { useConfig } from '@src/client/configprovider';
import { getMostRecentMessageOfType,getMostRecentMessageOfTypeSincePreviousTypes } from '@src/common/messages';
import { vhState } from '@src/client/states';
import { useRecoilState } from 'recoil';
import { RawHTMLBox } from './standard/rawhtmlbox';
import { CircularProgress } from '@mui/material';
import { MultimediaInput } from './multimediainput';
import { AudioPlaybackControls } from './audioplaybackcontrols';
import { PlayControls } from './playcontrols';
import { MessagesDebugControls } from './messagesdebugcontrols';


const useStyles = makeStyles()((theme, pageTheme) => {
    const {
      colors,
      fonts,
    } = pageTheme;
    return ({
    inputContainer: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        bottom: 0,
        padding: theme.spacing(1),
        backgroundColor: colors.inputAreaBackgroundColor,
        position: 'relative', 
    },
    textField: {
      flexGrow: 1,
      marginRight: theme.spacing(1),
      '& .MuiOutlinedInput-root': {
        backgroundColor: colors.inputAreaTextEntryBackgroundColor, // Use the new color as the background
      },
    },
    input: {
      color: colors.inputTextEnabledColor, // Use the primary text color for the main text
    },
    inputSuggestion: {
      color: colors.inputTextDisabledColor, // Use the secondary text color for the suggestion text
    },
    notchedOutline: {
      borderColor: colors.inputTextDisabledColor, // Use the default background color for the outline
    },
    iconButtonInacive: {
      color: colors.sendMessageButtonInactiveColor, // Use the default background colorfor the icon
    },
    iconButtonAcive: {
      color: colors.sendMessageButtonActiveColor, // Use the default background colorfor the icon
      '&:hover': {
        color: colors.sendMessageButtonActiveHoverColor,
      },
    },
    suggestionsContainer: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      backgroundColor: colors.inputAreaBackgroundColor,
    },
    suggestionButton: {
      flex: 1,
      margin: theme.spacing(0.5),
      color: colors.suggestionsButtonTextColor,
      backgroundColor: colors.suggestionsButtonColor,
      '&:hover': {
        color: colors.suggestionsButtonHoverTextColor,
        backgroundColor: colors.suggestionsButtonHoverColor, // replace with the color you want on hover
      },
    },
    noSuggestionsBox: {
      flex: 1,
      margin: theme.spacing(0.5),
      width: '100%',
      color: colors.suggestionsButtonTextColor,
      backgroundColor: colors.suggestionsButtonColor,
    },
    noSuggestionsText: {
      color: colors.suggestionsButtonTextColor,
    },
    outlinedInput: {
      color: colors.inputTextEnabledColor,
      borderColor: colors.inputTextEnabledColor,
      '&$focused': {
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: colors.inputTextEnabledColor, // Change this to the color you want when the TextField has input focus
        },
      },
      '&:hover': {
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: colors.inputTextEnabledColor, // Change this to the color you want when the TextField is being hovered
        },
      },
      '&$focused:not(:hover)': {
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: colors.inputTextEnabledColor, // Change this to the color you want when the TextField is being hovered
        },
      },
      '&:hover:not($focused)': {
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: colors.inputTextDisabledColor, // Change this to the color you want when the TextField is being hovered
        },
      },
      '&$disabled': {
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: colors.inputTextDisabledColor, // Change this to the color you want when the TextField is being hovered
        },
      },
    },
    focused: {},
    disabled: {},
    error: {},
    contentContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexGrow: 1,
        overflowY: 'auto',
        paddingTop: '40px',
        paddingBottom: '100px',
        backgroundColor: colors.messagesAreaBackgroundColor,
    },
  })});
  

function ChatBotView(props) {
  const { Constants } = useConfig();
    const { 
      theme, 
      title,
      versionString, 
      messages, 
      inputLength,
      onCardActionSelected,
      editMode,
      supportsSuggestions,
      waitingForInput,
      onSendMessage,
      supportedMediaTypes,
      conversational,
      audioState,
      onAudioStateChange,
      onGetAudioController,
      processingUnderway,
      onRequestStateChange,
      sessionID,
      debugSettings,
      onDebugSingleStep,
      onToggleSingleStep,
      children
    } = props;
    const { classes } = useStyles(theme);
    const [typingIndex, setTypingIndex] = useState(0);
    const [suggestions, setSuggestions] = useState([]);
    const [htmlForStatusBar, setHtmlForStatusBar] = useState("");
    const [messageAreaHeight, setMessageAreaHeight] = useState(0);
    const [suggestionsDrawerOpen, setSuggestionssuggestionsDrawerOpen] = useState(true);
    const inputAreaRef = useRef(null);
    const [vh, setVh] = useRecoilState(vhState);

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

  useEffect(() => {
    if (messages) {
      //
      // Have there been any eligible suggestions messages since the last user message?
      //
      Constants.debug.logSuggestions && console.log("SUGGESTIONS: messages: ", messages)
      let startingMessageIndex = getMostRecentMessageOfType(messages, ['user'], -1);
      if (startingMessageIndex == -1) {
        startingMessageIndex = 0;
      } else {
        startingMessageIndex++;
      }

      //
      // Search recent messages for one containing data... and suggestions
      //
      let newSuggestions = null;
      for (var i = startingMessageIndex; i < messages.length; i++) {
        const message = messages[i];
        if (message.data?.suggestions?.length > 0) {
          newSuggestions = message.data.suggestions;
          break;
        }
      }

      setSuggestions(newSuggestions);

      const mostRecentAssistantIndex = getMostRecentMessageOfType(messages, ['assistant'], -1);
      if (mostRecentAssistantIndex >=0) {
        const statusBarMarkup = messages[mostRecentAssistantIndex].statusBarMarkup;
        if (statusBarMarkup) {
          setHtmlForStatusBar(statusBarMarkup);
        } else {
          setHtmlForStatusBar("");
        }
      }
    }
  }, [messages, vh]);

  
  function handleDrawerToggle()  {
    setSuggestionssuggestionsDrawerOpen((prev) => !prev);
  };


    return (
      <Box sx={{
          top: 0,  
          width: '100%',
          height: '100%',
          backgroundColor: theme.colors.messagesAreaBackgroundColor,
      }}>
            <Box sx={{ 
              height: messageAreaHeight, 
              top: 0,  
              position: 'relative',
            }}>

              {/* MESSAGES PANE */}
              
              <MessagesContainer
                  theme={theme}
                  title={title}
                  footer={versionString}
                  editMode={editMode}
              >
                        
                  {children}

              </MessagesContainer>

              {editMode && <MessagesDebugControls debugSettings={debugSettings}  theme={theme} onDebugSingleStep={onDebugSingleStep} onToggleSingleStep={onToggleSingleStep} />}
              <PlayControls isRunning={processingUnderway} onRequestStateChange={onRequestStateChange} sessionID={sessionID} />
            </Box>
            <Box className={classes.inputContainer} ref={inputAreaRef}>
            <Box sx={{
                display: 'flex',
                flexGrow: 1,
                flexDirection: 'column',
                width: '100%',
            }}>
              <RawHTMLBox
                    sx={{
                        width: '100%', // 100% width of the container/screen
                        maxHeight: 100, // Up to 100 height
                        overflow: 'auto' // Adds scroll if the content exceeds the height
                    }}
                    html={htmlForStatusBar}
              />
              {supportsSuggestions && (
                  <Box className={classes.suggestionsContainer}>
                    <Box sx={{display: 'flex', flexDirection: 'row', width: '100%'}}>
                      <Typography variant="body1" sx={{alignSelf: 'flex-start', color: theme.colors.inputAreaInformationTextColor}}>
                            Optional suggestions:
                      </Typography>
                      <Typography variant="body1" sx={{position:'absolute', right: 40, margin: 0.2, color: theme.colors.inputAreaInformationTextColor}}>
                            {suggestionsDrawerOpen ? "Hide" : "Show"}
                      </Typography>

                      { /*  COLLAPSE / UNCOLLAPSE THE SECTION  */ }
                      <Box sx={{ position:'absolute', right: 0, top: 0,  margin: 1.5, zIndex: 200, height: 20, width: 20,  borderRadius: '50%', backgroundColor: 'gray', alignContent: 'center', alignItems: 'center', justifyContent: 'center', justifyItems: 'center'}}>
                          <IconButton onClick={() => handleDrawerToggle()} sx={{height: 15, width: 15, left: 2, bottom: 3}} >
                            {suggestionsDrawerOpen ? <ArrowDownward fontSize="small" sx={{color: theme.colors.inputAreaInformationTextColor}} /> : <ArrowUpward fontSize="small" sx={{color: theme.colors.inputAreaInformationTextColor}} />}
                          </IconButton>
                      </Box>
                    </Box>

                    {suggestionsDrawerOpen && (
                       <Box >
                          {suggestions ? 
                            suggestions.map((suggestion, i) => (
                            <Button
                              key={i}
                              variant="outlined"
                              onClick={() => onCardActionSelected("suggestion", {suggestion: suggestion })}
                              className={classes.suggestionButton}
                              disableElevation
                              sx={{
                                width:'98%'
                              }}
                            >
                              {suggestion}
                            </Button>
                          ))
                          :
                          <Box className={classes.noSuggestionsBox}>
                            {waitingForInput ? 
                              <Box sx={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}> <CircularProgress sx={{color: theme.colors.suggestionsButtonTextColor}} /> </Box>
                              : 
                            <Typography className={classes.noSuggestionsText}>No suggestions provided for this turn.</Typography>
                            }
                        </Box>
                        } 
                      </Box>
                    )}
                  </Box>
                )}
                <AudioPlaybackControls 
                  audioState={audioState} 
                  onAudioStateChange={onAudioStateChange}
                  onGetAudioController={onGetAudioController}
                  theme={theme}
                />
                <Box sx={{
                    display: 'flex',
                    flexGrow: 1,
                    flexDirection: 'row',
                    width: '100%',
                }}>
                    <MultimediaInput
                      theme={theme}
                      inputLength={inputLength}
                      waitingForInput={waitingForInput}
                      supportedMediaTypes={supportedMediaTypes}
                      handleSendMessage={onSendMessage}
                      sendAudioOnSpeechEnd={conversational}
                      debug={editMode}
                    />
                </Box>
            </Box>
          </Box>
      </Box>
    );
};

export default ChatBotView;
