import React, { useEffect, useState } from 'react';
import {
    Box, Typography
} from '@mui/material';
import { makeStyles } from '@mui/styles';


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
      backgroundColor: theme.palette.background.main , 
      marginTop: theme.spacing(4), 
      width: '100%',
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

  
  
export function ThemePreview(props) {
    const { gameInfo, versionInfo } = props;
    const [theme, setTheme] = useState(null);
    const { classes } = useStyles(theme ? theme : defaultAppTheme);
  
    useEffect(() => {
      if (gameInfo && gameInfo.theme) {
        setTheme(gameInfo.theme);
      }
    }, [gameInfo]);
  
    const themeToUse = theme ? theme : defaultAppTheme;
  
    async function handleCardActionSelected(props) {
       // does nothing
       return;
    }
  
    return (
      <div width="50%">
          <Box className={classes.themeEditorContainer}>
            <Typography variant="h6" className={classes.themeEditorTitle}>
              Preview
            </Typography>
              <ChatBotView   
                messages={previewMessages} 
                theme={themeToUse}
                title={gameInfo.title} 
                onCardActionSelected={handleCardActionSelected}
                responseFeedbackMode={{user: "readonly", admin: "edit"}}
                editMode={true}
              />
          </Box>
      </div>
    );
  }
  