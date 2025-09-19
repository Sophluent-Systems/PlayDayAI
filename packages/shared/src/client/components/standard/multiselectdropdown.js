import React, { useState } from "react";
import { makeStyles } from 'tss-react/mui';
import {  
    Checkbox, 
    InputLabel,
    ListItemIcon,
    ListItemText,
    MenuItem,
    FormControl,
    Select
} from '@mui/material';
import { defaultAppTheme } from '@src/common/theme';


const useStyles = makeStyles()((theme, pageTheme) => {
    const {
        colors,
        fonts,
    } = pageTheme;
    return ({
    formControl: {
      margin: theme.spacing(1),
      width: 300
    },
    indeterminateColor: {
      color: "#f50057"
    },
    selectAllText: {
      fontWeight: 500
    },
    selectedAll: {
      backgroundColor: "rgba(0, 0, 0, 0.08)",
      "&:hover": {
        backgroundColor: "rgba(0, 0, 0, 0.08)"
      }
    }
})});


const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;

export function MultiSelectDropdown(props) {
  const { theme, label, options, selected, onChange, sx, key } = props;
  const classes = useStyles(theme ? theme : defaultAppTheme);
  const isAllSelected =
    options.length > 0 && selected.length === options.length;

  const handleChange = (event) => {
    const value = event.target.value;
    if (value[value.length - 1] === "all") {
      onChange(selected.length === options.length ? [] : options);
      return;
    }
    onChange(value);
  };

  return (
    <FormControl className={classes.formControl} sx={sx}>
      <InputLabel id="mutiple-select-label" sx={{paddingBottom:4}}>{label}</InputLabel>
      <Select
        labelId="mutiple-select-label"
        multiple
        value={selected}
        onChange={handleChange}
        renderValue={(selected) => selected.join(", ")}
      >
        <MenuItem
          value="all"
          classes={{
            root: isAllSelected ? classes.selectedAll : ""
          }}
        >
          <ListItemIcon>
            <Checkbox
              classes={{ indeterminate: classes.indeterminateColor }}
              checked={isAllSelected}
              indeterminate={
                selected.length > 0 && selected.length < options.length
              }
            />
          </ListItemIcon>
          <ListItemText
            classes={{ primary: classes.selectAllText }}
            primary="Select All"
          />
        </MenuItem>
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            <ListItemIcon>
              <Checkbox checked={selected.indexOf(option) > -1} />
            </ListItemIcon>
            <ListItemText primary={option} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
