'use client';

// pages/play/[game].js
import { useRouter } from 'next/router';
import React, { memo, useState, useEffect } from 'react';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { InfoBubble } from '@src/client/components/standard/infobubble';
import { defaultAppTheme } from '@src/common/theme';
import { callUpdateGameInfo } from '@src/client/gameplay';
import { Error as ErrorIcon } from '@mui/icons-material';
import { makeStyles } from 'tss-react/mui';
import { CheckCircle } from '@mui/icons-material';
import { Save } from '@mui/icons-material';
import { PlayArrow } from '@mui/icons-material';
import { isEqual } from 'lodash';
import {
  TextField,
  Button,
  Tooltip,
  Box,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { MuiColorInput } from 'mui-color-input';
import Title from '@src/client/components/standard/title';
import { Warning } from '@mui/icons-material';
import GameMenu  from '@src/client/components/gamemenu';
import { callDeleteGameAndAllData } from '@src/client/editor';
import { stateManager } from '@src/client/statemanager';
import ChatBotView from '@src/client/components/chatbotview';
import { PersonaPreview } from '@src/client/components/versioneditor/personas/personapreview';
import { BuiltInPersonas } from '@src/common/builtinpersonas';
import { FontChooser } from '@src/client/components/standard/fontchooser';
import { nullUndefinedOrEmpty } from '@src/common/objects';

const useStyles = makeStyles()((theme, pageTheme) => {
  const {
    colors,
    fonts,
  } = pageTheme;
  return ({
  inputField: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  themeEditorContainer: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderWidth: 1,
    borderColor: theme.palette.primary.main,
    borderStyle: 'solid',
    borderRadius: theme.shape.borderRadius,
    backgroundColor:  theme.palette.background.main , 
    marginTop: theme.spacing(4), 
    width: '100%',
  },
  themePreviewContainer: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderWidth: 1,
    borderColor: theme.palette.primary.main,
    borderStyle: 'solid',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.main, 
    marginTop: theme.spacing(4), 
    width: '100%',
    alignContent: 'center',
    justifyContent: 'center',
  },
  themeEditorTitle: {
    marginBottom: theme.spacing(2),
  },
  themeEditorField: {
    marginBottom: theme.spacing(2),
    padding: theme.spacing(1),
  },
  scenarioStyle: {
    padding: '8px',
    marginBottom: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: colors.inputAreaTextEntryBackgroundColor, 
  },
})});


function ThemePreview(props) {
  const { gameInfo, primaryVersion } = props;
  const [appliedTheme, setAppliedTheme] = useState(defaultAppTheme);
  const { classes } = useStyles(appliedTheme);

  useEffect(() => {
    if (gameInfo && gameInfo.theme) {
      const themeToSet = {
        colors: {...defaultAppTheme.colors, ...gameInfo.theme.colors},
        fonts: {...defaultAppTheme.fonts, ...gameInfo.theme.fonts},
      };
      setAppliedTheme(themeToSet);
    }
  }, [gameInfo]);


  async function handleCardActionSelected(props) {
     // does nothing
     return;
  }

  if (!gameInfo) {
    return null;
  }

  return (
    <div width="50%">
        <Box className={classes.themePreviewContainer}>
          <Typography variant="h6" className={classes.themeEditorTitle}>
            Preview
          </Typography>
            <ChatBotView   
                theme={appliedTheme}
                title={gameInfo?.title}
                waitingForProcessingToComplete={false}
                waitingForInput={true}
                inputLength={100}
                editMode={true}
                supportsSuggestions={true}
            >
                <Box sx={{
                  display: "flex",
                  flexDirection: "column",
                  width: '100%',
                  justifyContent: 'center',
                  alignItems: 'center',
                  justifyItems: 'center',
                  }}>
                
                    {!nullUndefinedOrEmpty(primaryVersion?.personas) && primaryVersion.personas.map(persona =>
                      <PersonaPreview
                          theme={appliedTheme}
                          persona={persona}
                          mediaTypes={['text', 'image', 'audio']}
                          extended={true}
                          key={persona.personaID}
                      />
                    )}
                    {BuiltInPersonas.map(persona => 
                        <PersonaPreview 
                            theme={appliedTheme}
                            persona={persona} 
                            mediaTypes={['text', 'image', 'audio']}
                            extended={true}
                            key={persona.personaID}
                        />
                    )}
                </Box>

            </ChatBotView>
        </Box>
    </div>
  );
}

const fontStrings = {
  titleFont: "Title font (large text)",
  fontFamily: "Main font family",
}

const colorStrings = {
  titleBackgroundColor: "Title background",
  titleFontColor: "Title text",
  menuButtonColor: "Menu button color",
  chatbotMessageBackgroundColor: "Chatbot message background",
  chatbotMessageTextColor: " Default chatbot message text",
  userMessageBackgroundColor: "Default user message background",
  userMessageTextColor: "Default user message text",
  debugMessageBackgroundColor: "Default debug message background",
  debugMessageTextColor: "Default debug message text",
  messagesAreaBackgroundColor: "Messages area background",
  inputAreaBackgroundColor: "Input area background",
  inputAreaTextEntryBackgroundColor: "Input area text entry background",
  inputTextEnabledColor: "Input text enabled",
  inputTextDisabledColor: "Input text disabled",
  inputAreaInformationTextColor: "Input area information text",
  sendMessageButtonInactiveColor: "Send message button inactive",
  sendMessageButtonActiveColor: "Send message button active color",
  sendMessageButtonActiveHoverColor: "Send message button active hover",
  suggestionsButtonColor: "Suggestions button",
  suggestionsButtonTextColor: "Suggestions button text",
  suggestionsButtonHoverColor: "Suggestions button hover",
  suggestionsButtonHoverTextColor: "Suggestions button hover text",
  imageBackgroundColor: "Image background",
};

function ThemeEditor(props) {
  const { classes } = useStyles(defaultAppTheme);
  const { onChange, gameInfo } = props;
  const [appliedTheme, setAppliedTheme] = useState(null);
  
  useEffect(() => {
    if (gameInfo && gameInfo.theme) {
      const themeToSet = {
        colors: {...defaultAppTheme.colors, ...gameInfo.theme.colors},
        fonts: {...defaultAppTheme.fonts, ...gameInfo.theme.fonts},
      };
      setAppliedTheme(themeToSet);
    } else if (gameInfo) {
      setAppliedTheme(defaultAppTheme);
    }
  }, [gameInfo]);

  useEffect(() => {
    if (appliedTheme && !isEqual(appliedTheme, gameInfo.theme)){ 
      onChange(appliedTheme);
    }
  }, [appliedTheme]);

  const handleColorChange = (field, value) => {
    setAppliedTheme((prevTheme) => ({
      ...prevTheme,
      colors: {
        ...prevTheme.colors,
        [field]: value,
      },
    }));
  };

  const handleFontChange = (field, value) => {
    setAppliedTheme((prevTheme) => ({
      ...prevTheme,
      fonts: {
        ...prevTheme.fonts,
        [field]: value,
      },
    }));
  };

  if (!appliedTheme) {

    return (
    <Box className={classes.themeEditorContainer}>
      <Typography variant="h6" className={classes.themeEditorTitle}>
        Theme
      </Typography>
      </Box>
    );
  }

  return (
    <Box className={classes.themeEditorContainer}>
      <Typography variant="h6" className={classes.themeEditorTitle}>
        Theme
      </Typography>


      <Grid container spacing={2} alignItems="flex-start">
        {Object.keys(defaultAppTheme.fonts).map((fontKey) => (
          <Grid item xs={12} sm={4} key={fontKey}>
            <Box key={fontKey} className={classes.themeEditorField}>
              <Typography variant="subtitle1">{fontStrings[fontKey]}</Typography>
              <FontChooser
                value={appliedTheme.fonts?.[fontKey]}
                defaultValue={ defaultAppTheme.fonts[fontKey]}
                onChange={(nextFont) => handleFontChange(fontKey, nextFont)}
              />
            </Box>
            </Grid>))}
        {Object.keys(defaultAppTheme.colors).map((colorKey) => (
          <Grid item xs={12} sm={4} key={colorKey}>
            <Box key={colorKey} className={classes.themeEditorField}>
              <Typography variant="subtitle1">{colorStrings[colorKey]}</Typography>
              <MuiColorInput
                value={(appliedTheme.colors?.[colorKey]) ? appliedTheme.colors?.[colorKey] : defaultAppTheme.colors[colorKey]}
                onChange={(newValue) => handleColorChange(colorKey, newValue)}
                format={'hex8'}
              />
            </Box>
          </Grid>))}
      </Grid>
    </Box>
  );
}

function Home(props) {
  const { loading, account, game, versionList, switchGameByUrl,setAccountPreference, gamePermissions , editMode } = React.useContext(stateManager);
  const router = useRouter();
  const { classes } = useStyles(defaultAppTheme);
  const [isDirty, setIsDirty] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false);
  const [gameInfo, setGameInfo] = useState(null);
  const [automaticallyModifiedPrimaryVersion, setAutomaticallyModifiedPrimaryVersion] = useState(false);
  const [noQualifiedPrimaryVersion, setNoQualifiedPrimaryVersion ] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [primaryVersion, setPrimaryVersion] = useState(null);

  useEffect(() => {
    // turn on edit mode by defualt when editing
    if (!loading && !editMode) {
      setAccountPreference("editMode", true);
    }
  }, [loading]);

  useEffect(() => {
      let newGameInfo = null;
      if (game && !gameInfo) {
        newGameInfo = JSON.parse(JSON.stringify(game));
      } else if (gameInfo) {
        newGameInfo = JSON.parse(JSON.stringify(gameInfo));
      }
      
      if (newGameInfo && versionList) {
        if (nullUndefinedOrEmpty(newGameInfo?.primaryVersion) && !nullUndefinedOrEmpty(versionList)) {

          // Choose the best primary version to set

          let candidates = versionList.filter((version) => version.published);

          if (candidates.length == 0) {
            candidates = versionList;
          }

          // get the most recently edited version, highest lastUpdatedDate
          let primaryVersion = candidates.reduce((prev, current) => (prev.lastUpdatedDate > current.lastUpdatedDate) ? prev : current);
          newGameInfo.primaryVersion = primaryVersion?.versionName;
          setPrimaryVersion(primaryVersion);
        }
     }
     
     setGameInfo(newGameInfo);
  }, [game, versionList]);

  useEffect(() => {
    if (versionList) {
      
      let newGameInfo = JSON.parse(JSON.stringify(game));
      if (newGameInfo) {
        setPrimaryVersion(versionList.find((version) => version.versionName == newGameInfo.primaryVersion));
      }
    }
  }, [versionList]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (isDirty) {
        // Display a confirmation dialog
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Clean up the listener when the component unmounts
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  const handleTopLevelInputChange = (e) => {
    const { name, value } = e.target;
    setGameInfo((prevState) => ({
      ...prevState,
      [name]: value,
    }));
    setIsDirty(true);
  };


  const handleThemeChange = (newTheme) => {
    var newGameInfo = {...gameInfo};
    newGameInfo.theme = newTheme;
    setGameInfo(newGameInfo);
    setIsDirty(true);
  };


  async function submitNewGameInfo() {
    try {
      await callUpdateGameInfo(gameInfo);
      setIsDirty(false);
      setIsUpdated(true);
      await switchGameByUrl(gameInfo.url, true);
    } catch (error) {
      alert("Error saving updates: " + error);
    }
  }

  const handleDeleteVersion = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    console.log("handleConfirmDelete");
    callDeleteGameAndAllData(gameInfo.gameID);
    setDeleteDialogOpen(false); // Close the dialog
    router.replace('/');
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false); // Close the dialog
  };
  


  function renderWithFormatting(children) {
    return (
      <StandardContentArea>
          <InfoBubble>
            {children}
          </InfoBubble>
      </StandardContentArea>
    );
  }

  if (!gameInfo) {
    return renderWithFormatting(<h1>Loading...</h1>);
  }

  return (
    <RequireAuthentication>
      <DefaultLayout title={!game ? "Loading" : `Edit ${game.title}`} theme={defaultAppTheme} >
          {(loading || !account || !gamePermissions) ? renderWithFormatting(<h1>Loading...</h1>) 
          : (!gamePermissions.includes('game_edit') ?
             renderWithFormatting(<h1>You are not authorized to edit this app.</h1>)
            : (
              <StandardContentArea>
                  <TextField
                    label="Title"
                    name="title"
                    value={gameInfo.title}
                    onChange={handleTopLevelInputChange}
                    className={classes.inputfield}
                    variant="filled"
                    fullWidth
                  />
                  <TextField
                    label="URL"
                    name="url"
                    value={gameInfo.url}
                    onChange={handleTopLevelInputChange}
                    className={classes.inputfield}
                    variant="filled"
                    fullWidth
                  />
                  <TextField
                    label="Description"
                    name="description"
                    value={gameInfo.description}
                    onChange={handleTopLevelInputChange}
                    className={classes.inputfield}
                    variant="filled"
                    fullWidth
                  />
              <FormControl
                className={classes.inputfield}
                variant="filled"
                fullWidth
              >
                <InputLabel id="primaryVersion-label">
                  Primary Version
                </InputLabel>
                <Select
                  labelId="primaryVersion"
                  value={gameInfo.primaryVersion || ""}
                  onChange={handleTopLevelInputChange}
                  name="primaryVersion"
                >
                  {versionList?.map((version) => (
                    <MenuItem key={version.versionName} value={version.versionName}>
                      {version.versionName}
                    </MenuItem>
                  ))}
                </Select>
                {automaticallyModifiedPrimaryVersion && (
                <Tooltip title="Primary version not in the list">
                  <Box display="flex" alignItems="center">
                    <Warning color="error" />
                    <Typography
                      variant="body1"
                      color="error"
                      style={{ marginLeft: '4px' }}
                    >
                      The previous Primary Version is no longer published
                    </Typography>
                  </Box>
                </Tooltip>
              )}
              {noQualifiedPrimaryVersion && (
              <Tooltip title="No published versions available!">
                <Box display="flex" alignItems="center">
                  <Warning color="error" />
                  <Typography
                    variant="body1"
                    color="error"
                    style={{ marginLeft: '4px' }}
                  >
                    No published versions available!
                  </Typography>
                </Box>
              </Tooltip>
            )}
              </FormControl>
                  <ThemeEditor gameInfo={gameInfo} onChange={handleThemeChange} />
                  <ThemePreview gameInfo={gameInfo} primaryVersion={primaryVersion} />

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    className={classes.inputfield}
                    onClick={submitNewGameInfo}
                    disabled={!isDirty}
                    startIcon={<Save />}
                  >
                    Save changes
                    {isDirty ? (
                      <Tooltip title="Unsaved changes">
                        <Box marginLeft={1}>
                          <ErrorIcon color="error" />
                        </Box>
                      </Tooltip>
                    ) : isUpdated ? (
                      <Tooltip title="Changes saved">
                        <Box marginLeft={1}>
                          <CheckCircle color="action" />
                        </Box>
                      </Tooltip>
                    ) : null}
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => router.push(`/play/${game.url}`)}
                    startIcon={<PlayArrow />}
                  >
                    Play
                  </Button>

                </div>

                <Box
                display="flex"
                justifyContent="center"
                marginTop={4}
                marginBottom={2}
                >
                <Button
                    variant="contained"
                    color="error"
                    onClick={handleDeleteVersion}
                >
                    Delete game
                </Button>
                </Box>
                <GameMenu 
                    url={game?.url} 
                    theme={defaultAppTheme}
                    allowEditOptions  
                    includePlayOption
                />
              </StandardContentArea>
            ))}
        <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        aria-labelledby="delete-version-dialog-title"
        aria-describedby="delete-version-dialog-description"
        >
        <DialogTitle id="delete-version-dialog-title">
            DELETE ENTIRE GAME
        </DialogTitle>
        <DialogContent>
            <DialogContentText id="delete-version-dialog-description">
            THIS WILL PERMINANTLY DELETE THE GAME AND ALL DATA AND CANNOT BE UNDONE. This is the big one!!
            </DialogContentText>
        </DialogContent>
        <DialogActions>
            <Button onClick={handleCancelDelete} color="primary">
            Cancel
            </Button>
            <Button onClick={handleConfirmDelete} color="error" autoFocus>
            Delete -- are you sure!?1?
            </Button>
        </DialogActions>
        </Dialog>
      </DefaultLayout>
    </RequireAuthentication> 
  );

}

export default memo(Home);


