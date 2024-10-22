import React, { useState, useEffect, useRef } from 'react';
import { defaultAppTheme } from '@src/common/theme';
import { makeStyles } from 'tss-react/mui';
import { Delete } from '@mui/icons-material';
import { Edit } from '@mui/icons-material';
import { Add } from '@mui/icons-material';
import {
  TextField,
  Button,
  Box,
  Paper, 
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Grid,
} from '@mui/material';
import { Save } from '@mui/icons-material';

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


export function ScenarioEditor(props) {
  const { classes } = useStyles(defaultAppTheme);
  const { rootObject,field, value, onChange, readOnly } = props;
  const [editingScenarioIndex, setEditingScenarioIndex] = useState(null);
  const [localCatalog, setLocalCatalog] = useState(null);
  const localCatalogRef = useRef(null);

  useEffect(() => {
    if (Array.isArray(value)) {
      localCatalogRef.current = JSON.parse(JSON.stringify(value));
      setLocalCatalog(localCatalogRef.current);
    }
  }, [value]);

  const handleAddScenario = () => {
    localCatalogRef.current = [...localCatalogRef.current, 
      {
        name: `Scenario ${localCatalogRef.current.length+1}`,
        text: "",
        firstEligibleTurn: 3,
        lastEligibleTurn: 999,
      }
    ];
    setLocalCatalog(localCatalogRef.current);
    setEditingScenarioIndex(localCatalogRef.current.length - 1);
  };
  
  const handleEditScenario = (index) => {
    setEditingScenarioIndex(index);
  };
  
  const handleScenarioChange = (index, e) => {
    const { name, value } = e.target;
    localCatalogRef.current = [...localCatalogRef.current];
    let editScenario = {...localCatalogRef.current[index]}
    editScenario[name] = value;
    localCatalogRef.current[index] = editScenario;
    setLocalCatalog(localCatalogRef.current);
  };

  const handleDeleteScenario = (index) => {
    localCatalogRef.current = [...localCatalogRef.current];
    localCatalogRef.current.splice(index, 1);
    setLocalCatalog(localCatalogRef.current);
    onChange(rootObject, field.path, localCatalogRef.current);
  };
  
  const handleDoneEditing = () => {
    onChange(rootObject, field.path, localCatalogRef.current);
    setEditingScenarioIndex(null);
  };
  

  return (
    <Box className={classes.themeEditorContainer}>
      <Typography variant="h6" className={classes.themeEditorTitle}>
        Scenarios
      </Typography>
      <List>
        {(localCatalog && localCatalog.length > 0) ? localCatalog.map((scenario, index) => (
        <Paper key={index} className={classes.scenarioStyle}>
          <ListItem key={index}>
            {editingScenarioIndex === index ? (
              <Grid container alignItems="flex-start">
                <Grid item xs={12} margin={1}>
                  <TextField fullWidth label="Name (to keep track of this scenario)" value={scenario.name} name="name" onChange={(e) => handleScenarioChange(index, e)} disabled={readOnly} />
                </Grid>
                <Grid item xs={12} margin={1}>
                  <TextField fullWidth label="Text" value={scenario.text} name="text" onChange={(e) => handleScenarioChange(index, e)}  multiline rows={4} disabled={readOnly} />
                </Grid>
                <Grid item xs={3} margin={1}>
                  <TextField fullWidth type="number" label="First Eligible Turn" value={scenario.firstEligibleTurn} name="firstEligibleTurn" onChange={(e) => handleScenarioChange(index, e)}  inputProps={{ min: 1, max: 999 }} disabled={readOnly} />
                </Grid>
                <Grid item xs={3} margin={1}>
                  <TextField fullWidth type="number" label="Last Eligible Turn" value={scenario.lastEligibleTurn} name="lastEligibleTurn" onChange={(e) => handleScenarioChange(index, e)}  inputProps={{ min: 1, max: 999 }} disabled={readOnly} />
                </Grid>
                <Grid item xs={1}>
                  <IconButton onClick={() => handleDoneEditing()}  disabled={readOnly} >
                    <Save />
                  </IconButton>
                </Grid>
              </Grid>
            ) : (
              <React.Fragment>
              <Grid container alignItems="center">
                <Grid item xs={10}>
                  <ListItemText primary={scenario.name} secondary={scenario.name}  />
                </Grid>
                <Grid item xs={1}>
                  <IconButton edge="end" onClick={() => handleEditScenario(index)}  disabled={readOnly} >
                    <Edit />
                  </IconButton>
                </Grid>
                <Grid item xs={1}>
                  <IconButton edge="end" onClick={() => handleDeleteScenario(index)}  disabled={readOnly} >
                    <Delete />
                  </IconButton>
                </Grid>
              </Grid>
              </React.Fragment>
            )}
          </ListItem>
          </Paper>
        )) : null}
      </List>
      <Button
        variant="contained"
        color="primary"
        onClick={handleAddScenario}
        startIcon={<Add />}
      >
        Add scenario
      </Button>
    </Box>
  );
}
