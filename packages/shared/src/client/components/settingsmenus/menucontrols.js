import React, { useState, useEffect, useRef } from 'react';
import { defaultAppTheme } from '@src/common/theme';
import {
  TextField,
  FormControlLabel,
  Checkbox,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  RadioGroup, 
  Radio,
  FormLabel,
  Box,
  Autocomplete, 
  Paper,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { CodeEditor } from './codeeditor';
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

  
  export function MenuTextField(params) {
    const [currentValue, setCurrentValue] = useState(typeof params.value == 'string' ? params.value : '');
    const [backgroundColor, setBackgroundColor] = useState('');
    const field = params.field;
  
    useEffect(() => {
      if (params.value != currentValue) {
        setCurrentValue(params.value);
      }
  }, [params.value]);
  
    useEffect(() => {
      if (currentValue && currentValue.length >= field.maxChar) {
        setBackgroundColor('lightcoral'); // color when the character limit has been reached
      } else {
        setBackgroundColor(''); // color when the character limit has not been reached
      }
    }, [currentValue]);
  
    function setNewValue(path, newValue) {
      setCurrentValue(newValue);
      params.onChange(params.rootObject, path, newValue);
    }

    if (nullUndefinedOrEmpty(currentValue, true)) {
      return null;
    }
  
    return (
            <Tooltip title={field.tooltip}>
            <TextField
              name={field.path}
              multiline={field.multiline}
              label={field.label}
              rows={field.lines}
              value={currentValue}
              onChange={(e) => {
                e.stopPropagation();
                setNewValue(field.path, e.target.value);
              }}
              sx={{
                backgroundColor: backgroundColor,
              }}
              fullWidth
              inputProps={{ maxLength: field.maxChar }}
              disabled={params.readOnly}
            />
            </Tooltip>
    );
  };
  
  
  export function MenuDecimalField(params) {
    const { classes } = useStyles(defaultAppTheme);
    const [currentValue, setCurrentValue] = useState(nullUndefinedOrEmpty(params.value) ? '' : params.value);
    const timeoutId = useRef(null);
    const field = params.field;

    useEffect(() => {
      if (params.value !== currentValue) {
        setCurrentValue(nullUndefinedOrEmpty(params.value) ? '' : params.value);
      }
  }, [params.value]);
  
    function setNewValue(path, range, inputValue) {
  
      // If there's an existing timeout, clear it
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
        timeoutId.current=null;
      }
  
      const newValue = nullUndefinedOrEmpty(inputValue) ? '' : inputValue;
      setCurrentValue(newValue);
  
      // Set the value immediately as the user types
      let numericalValue = undefined;
      try {
        numericalValue = parseFloat(newValue, 10);
      } catch (error) {
        // do nothing
      }
      
      // check whether newValue is a number within the range
      if (typeof numericalValue === 'number'
          && numericalValue == Math.floor(numericalValue) // it's an int
          && numericalValue >= range[0]
          && numericalValue <= range[1]) {
  
        // Update the value again, but this time after enforcing the range check
        params.onChange(params.rootObject, path, numericalValue);
  
      } else {
        
        // Start a new timeout
        timeoutId.current = setTimeout(() => {
          let valToUse = !nullUndefinedOrEmpty(newValue) ? newValue : currentValue;
          
          if (typeof valToUse !== 'number') {
            try {
              valToUse = parseFloat(valToUse, 10);
            } catch (error) {
              valToUse = 0;
            }
          } 
          if (isNaN(valToUse)) {
            valToUse = 0;
          }
  
          valToUse = Math.floor(valToUse);
  
          if (valToUse < range[0]) {
            valToUse = range[0];
          } else if (valToUse > range[1]) {
            valToUse = range[1];
          }
          
  
          // Update the value again, but this time after enforcing the range check
          setCurrentValue(valToUse);
          params.onChange(params.rootObject, path, valToUse);
        }, 2000); // delay
      }
    }
  
      return (
        <Tooltip title={field.tooltip}>
          <TextField
          label={field.label}
          name={field.path+"name"}
          type="number"
          step="1.0"
          inputProps={{ min: 0, step: 1 }}
          value={currentValue}
          onChange={(e) => {
            e.stopPropagation();
            setNewValue(field.path, field.range, e.target.value);
          }}
          className={classes.inputfield}
          fullWidth
          disabled={params.readOnly}
        />
      </Tooltip>);
  };
  
  export function MenuFloatField(params) {
    const { classes } = useStyles(defaultAppTheme);
    const [currentValue, setCurrentValue] = useState(nullUndefinedOrEmpty(params.value) ? '' : params.value);
    const timeoutId = useRef(null);
    const field = params.field;
  
    useEffect(() => {
      if (params.value !== currentValue) {
        setCurrentValue(nullUndefinedOrEmpty(params.value) ? '' : params.value);
      }
    }, [params.value]);
  
    function setNewValue(path, range, inputValue) {
  
      // If there's an existing timeout, clear it
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
        timeoutId.current=null;
      }
    
      const newValue = nullUndefinedOrEmpty(inputValue) ? '' : inputValue;
      setCurrentValue(newValue);
  
      // Set the value immediately as the user types
      let numericalValue = undefined;
      try {
        numericalValue = parseFloat(newValue, 10);
      } catch (error) {
        // do nothing
      }
      
      // check whether newValue is a number within the range
      if (typeof numericalValue === 'number'
          && numericalValue >= range[0]
          && numericalValue <= range[1]) {
  
        // Update the value again, but this time after enforcing the range check
        params.onChange(params.rootObject, path, numericalValue);
        
      } else {
        // Start a new timeout
        timeoutId.current = setTimeout(() => {
          let valToUse = !nullUndefinedOrEmpty(newValue) ? newValue : currentValue;
          
          if (typeof valToUse !== 'number') {
            try {
              valToUse = parseFloat(valToUse, 10);
            } catch (error) {
              valToUse = 0;
            }
          } 
          if (isNaN(valToUse)) {
            valToUse = 0;
          }
  
          if (valToUse < range[0]) {
            valToUse = range[0];
          } else if (valToUse > range[1]) {
            valToUse = range[1];
          }
      
          // Update the value again, but this time after enforcing the range check
          setCurrentValue(valToUse);
          params.onChange(params.rootObject, path, valToUse);
        }, 2000); // delay
      }
    }
  
    return (
    
      <Tooltip title={field.tooltip}>
        <TextField
        label={field.label}
        name={field.path}
        type="number"
        step="0.1"
        inputProps={{ min: 0, step: 1 }}
        value={currentValue}
        onChange={(e) => {
          e.stopPropagation();
          setNewValue(field.path, field.range, e.target.value);
        }}
        className={classes.inputfield}
        fullWidth
        disabled={params.readOnly}
      />
      </Tooltip>);
  };
  

  export function MenuRadioField(params) {
    const { classes } = useStyles(defaultAppTheme);
    const { readOnly } = params;
    const [currentValue, setCurrentValue] = useState(params?.value);
    const field = params.field;
  
    function setNewValue(path, newValue) {
      setCurrentValue(newValue);
      params.onChange(params.rootObject, path, newValue);
    }
  
    useEffect(() => {
      if (!nullUndefinedOrEmpty(params.value)) {
        setCurrentValue(params.value);
      }
    }, [params.value]);
  

    if (nullUndefinedOrEmpty(currentValue)) {
      return <React.Fragment />;
    }

    return ( 
    <FormControl component="fieldset" sx={{marginTop:2}} disabled={readOnly}>
      <FormLabel component="legend">{field.label}</FormLabel>
        <Box sx={{marginLeft: 4}}>
          <RadioGroup
              aria-label="history-options"
              name={field.path}
              value={currentValue}
              onChange={(e) => {
                e.stopPropagation();
                setNewValue(field.path, e.target.value)
              }}
          >
              {field.options ? field.options.map((option, index) => (

                <FormControlLabel value={option.value} key={option.value} control={<Radio />} label={option.label} />

              )) : null}
          </RadioGroup>
          </Box>
      </FormControl>
      );
  };
  


  export function MenuMultiselectField(params) {
    const { field, onChange, rootObject, readOnly, value } = params; // Destructured for clarity
    const [selectedOptions, setSelectedOptions] = useState(null);
    const [checked, setChecked] = useState(null);
    const options = field.options;

    useEffect(() => {
      if (!nullUndefinedOrEmpty(params.value)) {
        const newSelectedOptions = options.filter((option) => params.value.includes(option.value));
        setSelectedOptions(newSelectedOptions);

        let newChecked = {};
        for (let i = 0; i < options.length; i++) {
          const option = options[i];
          newChecked[option.value] = params.value.includes(option.value);
        }
        setChecked(newChecked);
      } else {
        setSelectedOptions([]);
        setChecked({});
      }
    }, [params.value]);


    const setNewValue = (event, newValues) => {
      event.stopPropagation();

      let newChecked = {};
      for (let i = 0; i < newValues.length; i++) {
        const option = newValues[i];
        newChecked[option.value] = newValues.includes(option.value);
      }
      setChecked(newChecked);

      setSelectedOptions(newValues);

      const newValueArray = newValues.map((option) => option.value);
      // trying to debug a rare issue
      if (typeof field.path != 'string') {
        throw new Error('field.path is not a string: ' + field.path);
      }



      console.log("MenuMultiselectField: rootObject: ", rootObject, " field.path: ", field.path, " newValueArray: ", newValueArray)
      onChange(rootObject, field.path, newValueArray);
    };

  
  
    if (!selectedOptions || !checked || !options ) {
      return null;
    } 

    return ( 
      <FormControl component="fieldset" sx={{marginTop:2, width: '100%'}} disabled={readOnly}>
        <FormLabel component="legend">{field.label}</FormLabel>
          <Box sx={{marginLeft: 4}}>
            <Autocomplete
              multiple
              id="checkboxes-tags-demo"
              options={options}
              disableCloseOnSelect
              getOptionLabel={(option) => option.label}
              value={selectedOptions}
              isOptionEqualToValue={(option, value) => option.value === value.value} // Compare based on id property
              PaperComponent={({ children }) => (
                <Paper style={{ maxHeight: 200, overflow: 'auto' }}>{children}</Paper>
              )}
              renderOption={(props, option) => {
                return <li key={`${option.value}-${option.label}`} {...props} >
                        <Checkbox
                          checked={checked[option.value]}
                        />
                        {option.label}
                      </li>;
              }}
              style={{ width: '100%' }}
              renderInput={(params) => (
                <TextField {...params} />
              )}
              
              onChange={(event, newValues) => setNewValue(event, newValues)}
              disabled={readOnly}
            />
        </Box>
    </FormControl>
      );
  };

  export function MenuCheckboxField(params) {
    const { classes } = useStyles(defaultAppTheme);
    const [currentValue, setCurrentValue] = useState((typeof params.value != 'undefined' && params.value != null) ? !!params.value : false);
    const field = params.field;
  
    function setNewValue(path, newValue) {
      setCurrentValue(newValue);
      params.onChange(params.rootObject, path, newValue);
    }
  
    useEffect(() => {
      if (!nullUndefinedOrEmpty(params.value) && params.value != currentValue) {
        setCurrentValue(params.value);
      }
    }, [params.value]);

    if (nullUndefinedOrEmpty(currentValue)) {
      return <React.Fragment  />;
    }

    return (
    <FormControlLabel
      sx={{ width: '95%' }}
      control={
        <Checkbox
          checked={currentValue}
          onChange={(e) => {
            e.stopPropagation();
            setNewValue(field.path, e.target.checked);
          }}
          name={field.path}
        />
      }
      label={field.label}
      disabled={params.readOnly}
    />);
  };
  
  export function MenuSelectDropdown(params) {
    const { classes } = useStyles(defaultAppTheme);
    const [currentValue, setCurrentValue] = useState(params?.value);
    const [options, setOptions] = useState(params?.options ? params.options : []);
    const field = params.field;
  
    useEffect(() => {
      if (Array.isArray(params?.options)) {
        setOptions(params.options);
        if (nullUndefinedOrEmpty(currentValue) && params.options.length > 0) {
          setCurrentValue(params.options[0].value);
        }
      }
  }, [params.options]);

    useEffect(() => {
      if (params.value != currentValue && !nullUndefinedOrEmpty(params.value)) {
        setCurrentValue(params.value);
      }
  }, [params.value]);
  
    function setNewValue(path, newValue) {
      setCurrentValue(newValue);
      params.onChange(params.rootObject, path, newValue);
    }

    if (!options || options.length == 0 || (typeof currentValue == 'undefined') || currentValue == null) {
      return <React.Fragment  />;
    }

   return (
    <Tooltip title={field.tooltip}>
    <FormControl 
      className={classes.inputfield} 
      fullWidth 
    >
      <InputLabel >{field.label}</InputLabel>
      <Select
        value={currentValue}
        label={field.label}
        onChange={(e) => {
          e.stopPropagation();
          setNewValue(field.path, e.target.value);
        }}
        disabled={params.readOnly}
      >
        {options && options.map((option, index) => {
          return <MenuItem value={option.value} key={option.value}>{option.label}</MenuItem>;
        })}
      </Select>
    </FormControl>
    </Tooltip>);
  };
  
  
  export function MenuCodeEditor(params) {
    const { field, value, onChange, rootObject, readOnly } = params; // Destructured for clarity
    const [currentValue, setCurrentValue] = useState(typeof value != 'undefined' ? value : null);

    useEffect(() => {
      if (value != currentValue) {
        setCurrentValue(value);
      }
  }, [value]);
  
    const setNewValue = (newValue) => {
      setCurrentValue(newValue);
      onChange?.(rootObject, field.path, newValue);
    }
  
    return (
      <CodeEditor 
          code_UNSAFE={currentValue} 
          onChange={setNewValue}
          disabled={readOnly} />
    );
  };
  
  
    
  