import React, { useState, useEffect } from 'react';
import { makeStyles } from "tss-react/mui";
import { 
    TextField, 
    IconButton,
    Box,
    Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import { useDropzone } from 'react-dropzone';
import { SpeechRecorder } from './speechrecorder';
import { nullUndefinedOrEmpty } from '@src/common/objects';


const useStyles = makeStyles()((theme, pageTheme) => {
    const {
      colors,
      fonts,
    } = pageTheme;
    return ({
    mediaAreaContainer: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        alignContent: 'center',
        width: '100%',
        bottom: 0,
        padding: theme.spacing(1),
        backgroundColor: colors.inputAreaBackgroundColor,
        position: 'relative', 
        flexGrow: 1, // This tells the container to take up any available space
    },
    inputContainer: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignContent: 'center',
        alignItems: 'center',
        width: '100%',
        bottom: 0,
        padding: theme.spacing(1),
        backgroundColor: colors.inputAreaBackgroundColor,
        position: 'relative', 
        flexGrow: 1, // This tells the container to take up any available space
    },
    textField: {
      flexGrow: 1,
      marginLeft: 2,
      marginRight: 2,
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
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    dragAndDropText: {
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
        alignContent: 'center',
        overflowY: 'auto',
        paddingTop: '40px',
        paddingBottom: '100px',
        backgroundColor: colors.messagesAreaBackgroundColor,
    },
  })});
  
const emptyMedia = {
  text: {
    data: "",
    source: "blob",
    type: "text",
    mimeType: "text",
  }
};

export const MultimediaInput = (props) => {
  const { 
    theme, 
    inputLength,
    waitingForInput,
    sendAudioOnSpeechEnd,
    supportedMediaTypes,
    handleSendMessage,
    debug,
  } = props;
  const { classes } = useStyles(theme);
  const [inputText, setInputText] = useState('');
  const [media, setMedia] = useState(emptyMedia);
  const [isDragging, setIsDragging] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');


  const supportsText = nullUndefinedOrEmpty(supportedMediaTypes) || supportedMediaTypes.includes("text");
  const supportsAudio = supportedMediaTypes && supportedMediaTypes.includes("audio");
  const supportsImage = supportedMediaTypes && supportedMediaTypes.includes("image");
  const supportsVideo = supportedMediaTypes && supportedMediaTypes.includes("video");
  
  const handleAudioSave = (blob) => {
    console.log("Saving audio blob");
    if (sendAudioOnSpeechEnd) { 

        handleSendMessage({ 
          audio : {
            data: blob, 
            mimeType: "audio/webm",
            source: "blob" 
          }
        });
    } else {
        setMedia((prev) => {
          let newMedia = {...prev};
          newMedia.audio = {
            data: blob,
            mimeType: "audio/webm",
            source: "blob",
          };

          return newMedia;
        });
        
    }
  };

  useEffect(() => {
    if (media["audio"]) {
        const audioBlob = media["audio"].data;
        const newAudioUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(newAudioUrl);
    }

    // Cleanup the URL when the component unmounts
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [media]);

  const handleMediaDelete = () => {
    setMedia(prev => {
      let newMedia = {...prev};
      Object.keys(prev).forEach((type) => {
        if (type != "text") {
          delete newMedia[type];
        }
      });
      return newMedia;
    });
  };
  
  const doSendMessage = () => {
    let newMedia = {...media};
    if (newMedia.text?.data === "") {
      delete newMedia.text;
    }
    handleSendMessage(newMedia);
    setMedia(emptyMedia);
  }

  const handleInputKeyPress = (event) => {
    if (event.key === 'Enter') {
        doSendMessage();
    }
  };

  const updateText = (text) => {
    setMedia((prev) => {
      let newMedia = {...prev};
      newMedia.text = {
        data: text,
        source: "blob",
        mimeType: "text",
      };

      return newMedia;
    });
  };

  const {getRootProps, getInputProps, isDragActive} = useDropzone({
    onDrop: (acceptedFiles) => {
        const file = acceptedFiles[0];
        const type = file.type.split('/')[0];
        setMedia((prev) => {
          let newMedia = {...prev};
          // type is the first component of the MIME type
          newMedia[type] = {
            data: file,
            mimeType: file.type,
            source: "blob",
          };

          return newMedia;
        });
      setIsDragging(false);
    },
    noClick: true, // Disable manual clicks if necessary
    noKeyboard: true,
    accept: {
      "audio/mpeg": [],
      "audio/webm": [],
      "audio/webm": [],
      "video/mp4": [],
      "video/mpeg": [],
      "video/quicktime": [],
      "image/jpeg": [],
      "image/png": [],
      "image/gif": [],
    }, // Correct MIME types
    onDragOver: () => {
      setIsDragging(true);
    },
    onDragLeave: () => {
      setIsDragging(false);
    },
  });


  const dragDropProps = (supportsImage || supportsVideo) ? getRootProps({ className: "dropzone" }) : {};
  const inputProps = (supportsText || supportsAudio) ? getInputProps() : {};

  return (
    <Box className={classes.mediaAreaContainer}>
        <Box {...dragDropProps} width='100%' height='100%'>
            {isDragging && (
            <Box
                className={classes.dragAndDropOverlay}
                style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "white",
                opacity: 0.5,
                zIndex: 1,
                }}
            >
                <Typography className={classes.dragAndDropText} >
                    
                </Typography>
            </Box>
            )}
            {(supportsImage || supportsVideo) && 
                    <input {...getInputProps()} /> 
            }            
            {(supportsImage || supportsVideo) && 
                <Typography className={classes.dragAndDropText} >
                    {isDragging ? "Drop the file here ..." : (supportsImage && supportsVideo) ? "Drag and drop an image or video file here, or click to select" :
                    (supportsImage ? "Drag and drop an image file here, or click to select" : "Drag and drop a video file here, or click to select")}
                </Typography>
            }
            <Box
                className={classes.inputContainer}
            >
                {supportsText &&
                    <TextField
                        slotProps={{ 
                          textField: {
                          maxLength: inputLength,
                          className: classes.outlinedInput,
                          classes: {
                              root: classes.outlinedInput,  
                              focused: classes.focused,
                              disabled: classes.disabled,
                              error: classes.error,
                          },
                          }}
                        }
                        className={classes.textField}
                        variant="outlined"
                        placeholder="Type your next turn here..."
                        value={media["text"].data}
                        onChange={(e) => updateText(e.target.value)}                        
                        onKeyUp={handleInputKeyPress}
                        disabled={!waitingForInput}
                    />
                }
                {supportsAudio && !media["audio"] &&
                    <SpeechRecorder
                        onRecordingComplete={handleAudioSave}
                        audioTrackConstraints={{
                        noiseSuppression: true,
                        echoCancellation: true,
                        }} 
                        showVisualizer={true}
                        speechDetection={true}
                        disableListening={!waitingForInput}
                        debug={debug}
                    />
                }
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignContent: 'center',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ml: 1, 
                    mr: 1,
                }}>
                    {media["audio"] && (
                      <div>
                        <audio src={URL.createObjectURL(media["audio"].data)} controls />
                      </div>
                    )}
                    {(media["image"] || media["video"] || media["audio"]) && (
                      <IconButton onClick={handleMediaDelete}>
                          <DeleteIcon className={classes.iconButtonAcive}  />
                      </IconButton>
                    )}
                </Box>
                {/* Always show "halt" option if processing is ongoing */}
                {/* since the user can still type and hit "enter" to   */}
                {/* send input                                         */}
                <IconButton 
                    onClick={doSendMessage}
                    disabled={!waitingForInput}
                    >
                    <SendIcon
                        className={(!waitingForInput) ? classes.iconButtonAcive : classes.iconButtonInacive} 
                    />
                </IconButton>
            </Box>
        </Box>
    </Box>
  );
};
