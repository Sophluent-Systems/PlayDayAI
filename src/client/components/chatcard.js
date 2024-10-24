import React, { useState, useEffect, useRef, memo } from "react";
import { makeStyles } from "tss-react/mui";
import { 
  Button,
  Paper, 
  Box, 
  Typography, 
  IconButton 
} from "@mui/material";
import { PlayArrow } from "@mui/icons-material";
import { Pause } from "@mui/icons-material";
import { ThumbUp } from "@mui/icons-material";
import { ThumbDown } from "@mui/icons-material";
import { Plagiarism } from "@mui/icons-material";
import { Assistant } from "@mui/icons-material";
import { Terminal } from "@mui/icons-material";
import { Sync } from "@mui/icons-material";
import { SyncProblem } from "@mui/icons-material";
import { PrettyDate } from "@src/common/date";
import { PrettyElapsedTime } from "@src/common/date";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { marked } from "marked";
import { ImageWithFallback } from "./standard/imagewithfallback";
import { CircularProgress } from "@mui/material";
import { getMessageStyling } from "@src/client/themestyling";
import { PersonaIcons } from "./versioneditor/personas/icons";
import DOMPurify from 'dompurify';


// Create a custom renderer for marked
const renderer = new marked.Renderer();

// Override list item rendering to be more compact
renderer.listitem = (text) => `<li style="margin: 0; padding: 0;">${text}</li>`;

// Override paragraph rendering to remove extra spacing
renderer.paragraph = (text) => `<p style="margin: 0; padding: 0;">${text}</p>`;

// Configure marked options
marked.setOptions({
  renderer: renderer,
  gfm: true,
  breaks: true,
  smartLists: true
});

const useStyles = makeStyles()((theme, pageTheme) => {
  const { colors, fonts } = pageTheme;
  return {
    container: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      width: "100%",
    },
    feedbackDescriptionText: {
      color: colors.chatbotMessageTextColor,
      fontFamily: fonts.fontFamily,
    },
    image: {
      width: "100%",
      height: "auto",
      maxHeight: "600px",
      maxWidth: "800px",
      objectFit: "contain",
    },
    spinnerBox: {
      width: "100%",
      height: "auto",
      maxHeight: "600px",
      maxWidth: "800px",
      objectFit: "contain",
      padding: 20,
    },
  };
});

function ChatBotTypingIndicator(props) {
  const { styling } = props;
  const [ellipsis, setEllipsis] = useState(".");

  useEffect(() => {
    const timer = setInterval(() => {
      setEllipsis((prev) => (prev.length < 4 ? prev + "." : "."));
    }, 300);
    return () => clearInterval(timer);
  }, []);

  return (
    <Typography variant="body1" sx={{ color: styling.color }}>
      {` ${ellipsis}`}
    </Typography>
  );
}

export const ChatCard = memo(({
  message,
  deleteAllowed,
  editMode,
  waitingForProcessingToComplete,
  onDelete,
  onCardActionSelected,
  theme,
  responseFeedbackMode,
  sessionID,
  onRequestAudioControl,
  playbackState,
}) => {
  const {
    content,
    recordID,
    nodeAttributes,
    executionTime,
    persona,
    ratings,
    processing,
    state,
    completionTime,
    codeLogs,
    error,
    nodeType,
    instanceName,
    hideOutput,
  } = message;
  const { classes } = useStyles(theme);
  const [styling, setStyling] = useState(null);
  const [Icon, setIcon] = useState(null);
  const mediaTypes = nodeAttributes["mediaTypes"] || [];

  const hidden = hideOutput || persona?.hideFromEndUsers;


  useEffect(() => {
    if (persona) {
      const newStyling = getMessageStyling(mediaTypes, persona);
      console.log("Chatcard styling: ", newStyling);
      setStyling(newStyling);
      const iconToUse = persona?.icon?.iconID
        ? PersonaIcons[persona.theme.icon.iconID]
        : PersonaIcons["Person"];
      setIcon(iconToUse);
    }
  }, [persona]);


  
  const isAIResponse = nodeAttributes["isAIResponse"];
  const codeExecutionResult = nodeAttributes["codeExecutionResult"];
  const canRateResponse = isAIResponse;
  const canDebugRecord = isAIResponse || codeExecutionResult;

  function renderResponseRatings(isPlayerRating) {
    let mode =
      canRateResponse && isPlayerRating
        ? responseFeedbackMode?.user
        : responseFeedbackMode?.admin;
    let textHint = isPlayerRating ? null : "admin rating";

   if (editMode && canRateResponse) {
      if (isPlayerRating) {
        mode = null;
      } else {
        mode = "edit";
        textHint = "admin rating";
      }
    }

    if (!mode) {
      return null;
    }

    const isReadOnly = mode == "readonly";

    const ratingExists =
      (isPlayerRating && typeof ratings?.playerRating !== "undefined") ||
      (!isPlayerRating && typeof ratings?.adminRating !== "undefined");
    const rating = isPlayerRating
      ? ratings?.playerRating
      : ratings?.adminRating;

    // default to gray
    let thumbsUpColor = "rgba(255, 255, 255, 0.6)";
    let thumbsDownColor = "rgba(255, 255, 255, 0.6)";
    if (ratingExists) {
      if (rating > 0.0) {
        thumbsUpColor = "rgba(0, 255, 0, 0.6)";
      } else {
        thumbsDownColor = "rgba(255, 0, 0, 0.6)";
      }
    }

    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginLeft: 0.5,
        }}
      >
      <Typography
        key="textHint"
        variant="caption"
        textAlign={"center"}
        className={classes.feedbackDescriptionText}
        sx={{
          color: "rgba(100, 100, 100, 0.4)",
        }}
      >
        {textHint}
      </Typography>
        <Box
          key="ratingButtons"
          sx={{
            display: "flex",
            flexDirection: "row",
          }}
        >
          <IconButton
            onClick={() =>
              onCardActionSelected("responseFeedback", {
                recordID: recordID,
                isPlayerRating: isPlayerRating,
                rating: -1.0,
              })
            }
            disabled={isReadOnly}
            sx={{
              position: "relative",
              backgroundColor: thumbsDownColor,
              border: "1px solid rgba(100, 100, 100, 0.4)",
              borderRadius: 0.5,
              margin: 0.5,
              height: 25,
              width: 25,
              "&:disabled": {
                backgroundColor: thumbsDownColor,
              },
            }}
          >
            <ThumbDown fontSize="small" />
          </IconButton>
          <IconButton
            onClick={() =>
              onCardActionSelected("responseFeedback", {
                recordID: recordID,
                isPlayerRating: isPlayerRating,
                rating: 1,
              })
            }
            disabled={isReadOnly}
            sx={{
              position: "relative",
              backgroundColor: thumbsUpColor,
              border: "1px solid rgba(100, 100, 100, 0.4)",
              borderRadius: 0.5,
              margin: 0.5,
              height: 25,
              width: 25,
              "&:disabled": {
                backgroundColor: thumbsUpColor,
              },
            }}
          >
            <ThumbUp fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    );
  }

  function renderText(key, text) {
    return (
      <Typography
        key={key}
        variant="body1"
        sx={{
          flex: 1,
          color: styling.color,
          whiteSpace: "pre-wrap",
          direction: "ltr",
          fontFamily: styling.fontFamily,
          wordBreak: "break-all",
        }}
      >
        {text}
      </Typography>
    );
  }

  
function renderMarkup(key, markupText) {
  const rawMarkup = marked(markupText);
  const safeMarkup = DOMPurify.sanitize(rawMarkup);

  return (
    <Typography
      key={key}
      variant="body1"
      sx={{
        flex: 1,
        color: styling.color,
        fontFamily: styling.fontFamily,
        whiteSpace: "pre-wrap",
        direction: "ltr",
        overflowWrap: "break-word",
        wordBreak: "break-word",
        
        // Base styles
        '& > *:first-child': {
          marginTop: 0,
        },
        '& > *:last-child': {
          marginBottom: 0,
        },
        
        // Global reset
        '& *': {
          margin: 0,
          padding: 0,
        },
        
        // Typography
        '& p, & li': {
          lineHeight: 1.4,
          marginBottom: '0.2em',
        },
        
        // Lists
        '& ul, & ol': {
          paddingLeft: '1.5em',
          marginBottom: '0.2em',
        },
        
        // Nested lists
        '& ul ul, & ol ol, & ul ol, & ol ul': {
          marginTop: 0,
          marginBottom: 0,
        },
        
        // Headings
        '& h1, & h2, & h3, & h4, & h5, & h6': {
          lineHeight: 1.2,
          marginTop: '0.5em',
          marginBottom: '0.2em',
          
          '&:first-child': {
            marginTop: 0,
          }
        },
        
        // Code blocks
        '& pre': {
          margin: '0.3em 0',
        },
        
        // Inline code
        '& code': {
          padding: '0.1em 0.2em',
        },
        
        // Blockquotes
        '& blockquote': {
          margin: '0.3em 0',
          paddingLeft: '1em',
          borderLeft: '3px solid #ddd',
        },
      }}
      component="div"
      dangerouslySetInnerHTML={{ __html: safeMarkup }}
    />
  );
}


  function renderSpinner(key) {
    return (
      <Box key={key} className={classes.spinnerBox}>
        <CircularProgress sx={{ margin: 15 }} />
      </Box>
    );
  }

  function renderTextWaitingIndicator(key) {
    return <ChatBotTypingIndicator key={key} styling={styling} />;
  }

  function renderMessage() {
    let renderMessageResults = [];

    if (state == "failed") {
      const errorText =`**${error.title}: ${error.subtitle}**\n\n${error.details}`;
      renderMessageResults.push(renderMarkup('error', errorText));
    } else if (processing && nullUndefinedOrEmpty(content)) {
      //
      // THERE IS LITERALLY NOTHING YET... NO PENDING CONTENT
      // AT ALL JUST AN EMPTY ARRAY OR NULL FOR 'CONTENT'
      //
      if (!nullUndefinedOrEmpty(mediaTypes)) {
        for (let i = 0; i < mediaTypes.length; i++) {
          if (mediaTypes[i] == "image" || mediaTypes[i] == "audio") {
            renderMessageResults.push(renderSpinner(mediaTypes[i]));
          } else if (mediaTypes[i] == "text") {
            renderMessageResults.push(
              renderTextWaitingIndicator(mediaTypes[i])
            );
          }
        }
      }
    } else if (!nullUndefinedOrEmpty(content)) {

      //
      // WE NOW HAVE AT LEAST ONE ENTRY IN THE CONTENT ARRAY,
      // EVEN IF WE'RE STILL PROCESSING...
      //

      const contentTypesAvailable = Object.keys(content);
      if (contentTypesAvailable.length == 0) {
        throw new Error(
          "ChatCard:renderMessage: contentTypesAvailable is empty"
        );
      }

      for (let i = 0; i < contentTypesAvailable.length; i++) {
        const mediaType = contentTypesAvailable[i];
        const data = content[mediaType];

        if (mediaType == "image") {
          //
          // IMAGE
          //
          if (nullUndefinedOrEmpty(data) && processing) {
            renderMessageResults.push(renderSpinner(`${i}`));
          } else {
            renderMessageResults.push(
              <ImageWithFallback
                key={i}
                primary={data}
                fallback={"https://playday.ai" + data}
                alt="Generated image"
                className={classes.image}
              />
            );
          }
        } else if (mediaType == "audio") {
          //
          // AUDIO
          //
          if (nullUndefinedOrEmpty(data) && processing) {
            renderMessageResults.push(renderSpinner(`${i}`));
          } else {
            const thisAudioIsPlaying = playbackState?.speech?.playState == 'playing' && playbackState?.speech?.recordID == recordID;
            renderMessageResults.push(
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} key='audioPlayContainer'>
                <Button
                      key={`${i}play`}
                      variant="contained"
                      size='large'
                      sx={{
                          borderRadius: '50%',
                          height: 50,
                          width: 50,
                          minWidth: 50,
                          padding: 0,
                          color: styling.color,
                          backgroundColor: styling.buttonColor,
                      }}
                      onClick={() => {
                        const audioType = data.audioType || "speech";
                        if (thisAudioIsPlaying) {
                            onRequestAudioControl("pause", audioType);
                        } else {
                            onRequestAudioControl("play", audioType, {recordID, source: data, speakerName: persona?.displayName, styling});
                        }
                      }}
                  >
                    {thisAudioIsPlaying ?
                        <Pause sx={{ fontSize: 16, height: 20, width: 20, color: styling.color }} />
                    :
                        <PlayArrow  sx={{ fontSize: 16, height: 20, width: 20, color: styling.color }} />
                    }
                  </Button>
                </Box>
            );
          }
        } else if (mediaType == "text") {
          //
          // TEXT
          //
          if (nullUndefinedOrEmpty(data) && processing) {
            renderMessageResults.push(renderTextWaitingIndicator(`${i}`));
          } else {
            renderMessageResults.push(renderMarkup(`${i}`, data));
          }
        } else if (mediaType == "data") {
          //
          // DATA
          //
          if (nullUndefinedOrEmpty(data) && processing) {
            renderMessageResults.push(renderSpinner(`${i}`));
          } else {
            renderMessageResults.push(
              renderText(`${i}`, JSON.stringify(data, null, 2))
            );
          }
        } else {
          if (nullUndefinedOrEmpty(data) && processing) {
            renderMessageResults.push(renderSpinner(`${i}`));
          } else {
            renderMessageResults.push(renderText(`${i}`, nullUndefinedOrEmpty(data) ? 'null' : JSON.stringify(data)));
          }
        }
      }
    } else {
      renderMessageResults.push(
        renderText("The server response was empty")
      );
    }
    return renderMessageResults;
  }

  if (!styling || state == "waitingForExternalInput") {
    // Do not show user input processing
    return null;
  }

  if (hidden && !editMode) {
    // Do not show messages from hidden personas
    return null;
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "80%" }}>
      <Box sx={{ display: "flex", width: "100%", justifyContent: "center" }} key="paper">
        <Paper
          sx={{
            ...styling.paperStyle,
            backgroundColor: styling.backgroundColor,
            width: "100%",
          }}
        >
          <Box className={classes.container}>
            <Box
              sx={{
                width: "100%",
                display: "flex",
                height: 20,
                mb: 1,
                alignContent: "center",
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              {editMode && 
                <Typography
                  key="instanceName"
                  variant="caption"
                  sx={{
                    width: "80%",
                    color: styling.color,
                    alignSelf: "flex-start",
                  }}
                >
                  {!nullUndefinedOrEmpty(instanceName)
                    ? `[${instanceName}]`
                    : !nullUndefinedOrEmpty(nodeType)
                    ? `[${nodeType}]`
                    : recordID
                    ? `Rec: ${recordID}`
                    : ""}
                </Typography>
        }

              {!processing &&
                onCardActionSelected &&
                editMode &&
                canDebugRecord && (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "row",
                      width: "100%",
                      alignSelf: "flex-end",
                      justifyContent: "flex-end",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        marginLeft: 2,
                        marginRight: 2,
                        color: styling.color,
                      }}
                      key="executionTime"
                    >
                      {executionTime
                        ? "Exec: " + PrettyElapsedTime(executionTime)
                        : ""}
                    </Typography>
                    {codeLogs ? (
                      <IconButton
                        onClick={() =>
                          onCardActionSelected("codeLogs", {
                            recordID: recordID,
                          })
                        }
                        sx={{
                          backgroundColor: "rgba(255, 255, 255, 0.6)",
                          borderRadius: 1,
                          height: 20,
                          width: 20,
                          marginRight: 0.5,
                        }}
                      >
                        <Terminal fontSize="small" />
                      </IconButton>
                    ) : null}
                    <IconButton
                      onClick={() =>
                        onCardActionSelected("showRecordResultFields", {
                          recordID: recordID,
                          label: isAIResponse ? "RAW PROMPT" : "CONSOLE LOGS",
                          fields: isAIResponse ? "context.prompt" : "context.consoleLogs"
                        })
                      }
                      sx={{
                        backgroundColor: "rgba(255, 255, 255, 0.6)",
                        borderRadius: 1,
                        height: 20,
                        width: 20,
                        marginRight: 0.5,
                      }}
                    >
                      <Plagiarism fontSize="small" />
                    </IconButton>

                    <IconButton
                      onClick={() =>
                        onCardActionSelected("showRecordResultFields", {
                          recordID: recordID,
                          label: "OUTPUT",
                          fields: isAIResponse ? "context.rawResponse" : "output"
                        })
                      }
                      sx={{
                        backgroundColor: "rgba(255, 255, 255, 0.6)",
                        borderRadius: 1,
                        height: 20,
                        width: 20,
                        marginRight: 0.5,
                      }}
                    >
                      <Assistant fontSize="small" />
                    </IconButton>
                  </Box>
                )}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', position: "relative", flexGrow: 1, width: "100%" }}>
              {renderMessage()}
            </Box>
          </Box>
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              width: "100%",
              justifyContent: "flex-start",
              alignContent: "center",
              alignItems: "center",
            }}
            key="topbar"
          >
            {Icon && <Icon sx={{ color: styling.iconColor }} />}
            <Typography
              key="completionTime"
              sx={{
                fontSize: "0.8em",
                color: "rgba(0, 0, 0, 0.6)",
                ml: 1,
                color: styling.color,
              }}
            >
              {PrettyDate(completionTime)}
            </Typography>
            {onCardActionSelected && canRateResponse && (
              <Box
                sx={{
                  display: "flex",
                  flex: 1,
                  flexDirection: "row",
                  flexGrow: 1,
                  justifyContent: "flex-end",
                  alignContent: "flex-end",
                  alignItems: "flex-end",
                }}
              >
                {renderResponseRatings(true)}
              </Box>
            )}
            {canRateResponse && renderResponseRatings(false)}
          </Box>
        </Paper>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "flex-start",
          right: -10, // Adjust this value to position the icon outside the chat card
        }}
        key="rerunButton"
      >
        {((state == "failed") || editMode) && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              ...(state == "failed" && { backgroundColor: "rgba(255, 0, 0, 0.1)" }), // Apply a reddish tint on error
            }}
          >
            <IconButton
              onClick={onDelete}
              disabled={waitingForProcessingToComplete || !deleteAllowed}
              sx={{
                position: "relative",
                top: 0,
                backgroundColor: "rgba(255, 255, 255, 0.6)",
                borderRadius: 1,
                marginLeft: 0.5,
                height: 30,
                width: 30,
                ...(state == "failed" && { color: "red" }), // Make the icon color red when error is true
              }}
            >
              {state == "failed" ? <SyncProblem /> : <Sync />}
            </IconButton>
          </Box>
        )}
      </Box>
    </Box>
  );
});
