import React, { useState, useEffect, useRef } from 'react';
import { defaultAppTheme } from '@src/common/theme';
import { makeStyles } from 'tss-react/mui';
import { Delete } from '@mui/icons-material';
import { Edit } from '@mui/icons-material';
import { Add } from '@mui/icons-material';
import { Save } from '@mui/icons-material';
import {
  TextField,
  Button,
  Box,
  Paper, 
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  FormControlLabel,
  Checkbox,
} from '@mui/material';


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
  outputDataFieldsStyle: {
    padding: '8px',
    marginBottom: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: colors.inputAreaTextEntryBackgroundColor, 
  },
})});


export function OutputDataFieldsEditor(props) {
  const { classes } = useStyles(defaultAppTheme);
  const { readOnly, rootObject, relativePath } = props;
  const [editingDataFieldIndex, setEditingDataFieldIndex] = useState(null);
  const [outputDataFieldsState, setOutputDataFieldsState] = useState(props.outputDataFields);


  useEffect(() => {
    props.onChange(rootObject, relativePath, outputDataFieldsState);
  }, [outputDataFieldsState]);

  const handleAddDataField = () => {
    const newDataField = { variableName: "", dataType: "string", instructions: "", required: false };
    const newIndex = outputDataFieldsState.length;
    setOutputDataFieldsState((prevState) => [...prevState, newDataField]);
    setEditingDataFieldIndex(newIndex);
  };
  
  const handleEditDataField = (index) => {
    setEditingDataFieldIndex(index);
  };

  const handleDeleteDataField = (index) => {
    setOutputDataFieldsState((prevState) => {
      let newState = [...prevState];
      newState.splice(index, 1);
      return newState;
    });
  };
  
  const handleValueChange = (index, field, value) => {
    setOutputDataFieldsState((prevState) => {
      let newState = [...prevState];
      newState[index][field] = value;
      return newState;
    });
  };

  const handleFinishEditing = () => {
    setEditingDataFieldIndex(null);
  };
  

  return (
    <Box className={classes.themeEditorContainer}>
      <Typography variant="h6" className={classes.themeEditorTitle}>
        Data Fields
      </Typography>
      <List>
      {outputDataFieldsState ? outputDataFieldsState.map((dataField, index) => (
        <Paper key={index} className={classes.outputDataFieldsStyle}>
          <ListItem key={index}>
            {editingDataFieldIndex === index ? (
              
              <Grid container alignItems="flex-start">
                <Grid item xs={12} margin={1}>
                  <TextField
                    fullWidth
                    style={{ width: '100%', verticalAlign: 'top', margin: 1 }}
                    value={dataField.variableName}
                    placeholder="Enter variable name"
                    onChange={(e) => handleValueChange(index, "variableName", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key == "Escape") {
                        handleFinishEditing();
                      } 
                    }}
                    disabled={readOnly}
                  />
                </Grid>
                <Grid item xs={12} margin={1}>
                  <FormControl style={{ width: '100%', verticalAlign: 'top', margin: 1 }} variant="filled" fullWidth>
                    <InputLabel id="variableType">Datatype</InputLabel>
                    <Select
                      labelId="datatypeselect"
                      value={dataField.dataType ? dataField.dataType : "string"}
                      onChange={(e) => handleValueChange(index, "dataType", e.target.value)}
                      disabled={readOnly}
                    >
                        <MenuItem value={"string"} key={"string"}>String</MenuItem>
                        <MenuItem value={"number"} key={"number"}>Number</MenuItem>
                        <MenuItem value={"array"} key={"array"}>Array</MenuItem>
                        <MenuItem value={"boolean"} key={"boolean"}>Boolean</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} margin={1}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4} // adjust based on your needs
                    style={{ width: '70%' }} // assuming you want the rest to be 70%
                    value={dataField.instructions}
                    placeholder="Enter instructions"
                    onChange={(e) => handleValueChange(index, "instructions", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key == "Escape") {
                        handleFinishEditing();
                      } 
                    }}
                    disabled={readOnly}
                  />
                </Grid>
                <Grid item xs={10} margin={1}>
                <FormControlLabel
                  key={"requiredCheckbox"}
                  sx={{ width: '95%' }}
                  control={
                    <Checkbox
                      checked={dataField.required}
                      onChange={(e) => handleValueChange(index, "required", !!e.target.checked)}
                      name={"required"}
                    />
                  }
                  label={"Required"}
                  disabled={readOnly}
                />
                </Grid>
                <Grid item xs={1}>
                  <IconButton onClick={() => handleFinishEditing()} disabled={readOnly} >
                    <Save />
                  </IconButton>
                </Grid>
              </Grid>
            ) : (
              <React.Fragment>
                <ListItemText 
                  primary={dataField.variableName} 
                  secondary={dataField.instructions} 
                  onClick={() => handleEditDataField(index)}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" onClick={() => handleEditDataField(index)} disabled={readOnly} >
                    <Edit />
                  </IconButton>
                  <IconButton edge="end" onClick={() => handleDeleteDataField(index)} disabled={readOnly} >
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </React.Fragment>
            )}
          </ListItem>
        </Paper>
      )) : null}
      </List>
      <Button
        variant="contained"
        color="primary"
        onClick={handleAddDataField}
        startIcon={<Add />}
      >
        Add Output Field
      </Button>
    </Box>
  );
}
