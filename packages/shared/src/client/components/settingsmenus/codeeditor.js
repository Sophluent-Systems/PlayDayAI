import React, { useState, useEffect, useRef } from 'react';
import { defaultAppTheme } from '@src/common/theme';
import { makeStyles } from 'tss-react/mui';
import AceEditor from "react-ace";
import {
  Box,
  Typography,
} from '@mui/material';
import {  getCodeStartingLines, getCodeEndingLines, composeFullFunctionCode } from '@src/common/customcode';
import { useConfig } from '@src/client/configprovider';


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



export function CodeEditor(props) {
  const { Constants } = useConfig();
  const { classes } = useStyles(defaultAppTheme);
  const { code_UNSAFE, inputNodes, onChange, readOnly, rootObject } = props;
  const [fullFunctionCodeToDisplay, setFullFunctionCodeToDisplay] = useState(null);
  const [startingCode, setStartingCode] = useState(['']);
  const [endingCode, setEndingCode] = useState(['']);
  const [key, setKey] = useState(0); // Force a re-render when we get new props
  const code_UNSAFERef = useRef('');
  const fullFunctionCodeToDisplayRef = useRef(null);

  useEffect(() => {
    if (code_UNSAFERef.current != code_UNSAFE) {
      code_UNSAFERef.current = code_UNSAFE;
      refreshDisplayedFullFunctionCode(code_UNSAFERef.current);
    }
  }, [code_UNSAFE]);

  useEffect(() => {
      Constants.debug.logCodeEditor && console.log("  USE EFFECT inputNodes!!")
      const newStartingCode = getCodeStartingLines(inputNodes);
      const newEndingCode = getCodeEndingLines();
      fullFunctionCodeToDisplayRef.current = composeFullFunctionCode(newStartingCode, code_UNSAFERef.current, newEndingCode);
      setStartingCode(newStartingCode);
      setEndingCode(newEndingCode);
      setFullFunctionCodeToDisplay(fullFunctionCodeToDisplayRef.current);
      Constants.debug.logCodeEditor && console.log("  USE EFFECT inputNodes!! newStartingCode=", newStartingCode)
      Constants.debug.logCodeEditor && console.log("  USE EFFECT inputNodes!! newEndingCode=", newEndingCode)
      Constants.debug.logCodeEditor && console.log("  USE EFFECT inputNodes!! newFullFunctionCode=", JSON.stringify(fullFunctionCodeToDisplayRef.current))
  }, [inputNodes]);

  function updateCustomCode(newCustomCode) {
    if (code_UNSAFERef.current != newCustomCode) {
      code_UNSAFERef.current = newCustomCode;
      onChange(newCustomCode);
    }
  }

  function refreshDisplayedFullFunctionCode(userCodeToUse) {
    fullFunctionCodeToDisplayRef.current = composeFullFunctionCode(startingCode, userCodeToUse, endingCode);
    if (fullFunctionCodeToDisplayRef.current !== fullFunctionCodeToDisplay) {
      Constants.debug.logCodeEditor && console.log("refreshDisplayedFullFunctionCode newFullFunctionCode=", JSON.stringify(fullFunctionCodeToDisplayRef.current))
      setFullFunctionCodeToDisplay(fullFunctionCodeToDisplayRef.current);
    }
  }

  function extractChangedUserCode(currentCode, change) {

    // Convert currentCode into an array of lines if it's a single string
    let codeLines = [...currentCode];
    if (typeof currentCode === 'string') {
        codeLines =  currentCode.split('\n');
  }

  for (let i = 0; i < codeLines.length; i++) {
    Constants.debug.logCodeEditor && console.log(`  codelines[${i}]: ${JSON.stringify(codeLines[i])}`);
  }

    // Validate that the code is long enough to safely ignore specified lines
    if (codeLines.length < (startingCode.length + endingCode.length)) {
        throw new Error("Code length is less than the sum of startingLineCount and endingLineCount");
    }

    // Calculate the region where changes can be applied
    const editableRegionStart = startingCode.length;

    // Extract the region that can be modified
    let editableCode = codeLines.slice(startingCode.length, -endingCode.length);
    if (editableCode.length === 0) {
      // ensure there's always at least one editable line
      Constants.debug.logCodeEditor && console.log("  editableCode is empty - adding a line")
      editableCode = ['    '];
    }

    Constants.debug.logCodeEditor && console.log("extractChangedUserCode currentCode=", JSON.stringify(currentCode));
    Constants.debug.logCodeEditor && console.log("extractChangedUserCode change=", change);
    Constants.debug.logCodeEditor && console.log("extractChangedUserCode startingLineCount=", startingCode.length);
    Constants.debug.logCodeEditor && console.log("extractChangedUserCode endingLineCount=", endingCode.length);
    Constants.debug.logCodeEditor && console.log("extractChangedUserCode editableRegionStart=", editableRegionStart);
    Constants.debug.logCodeEditor && console.log("extractChangedUserCode editableCode=", editableCode);

    // Apply the change
    const { start, end, action, lines } = change;

    if (action === 'insert') {
      let stringToInsert = lines.join('\n');
      let lineToInsertIn = start.row - editableRegionStart;
      let positionToInsert = start.column;
      if (lineToInsertIn < 0) {
          lineToInsertIn = 0;
          positionToInsert = 0;
      }

      Constants.debug.logCodeEditor && console.log(" Inserting string: ", JSON.stringify(stringToInsert), " at line ", lineToInsertIn, " position ", positionToInsert);

      if (lineToInsertIn >= editableCode.length) {
          // We will add whatever we need to add -- probably newlines -- at the very end of the current code
          lineToInsertIn = editableCode.length - 1;
          positionToInsert = editableCode[lineToInsertIn].length;
      }
      // insert the string at the line specified
      const lineBefore = editableCode[lineToInsertIn].slice(0, positionToInsert);
      const lineAfter = editableCode[lineToInsertIn].slice(positionToInsert);
      Constants.debug.logCodeEditor && console.log(`  lineBefore=${JSON.stringify(lineBefore)} stringToInsert=${JSON.stringify(stringToInsert)} lineAfter=${JSON.stringify(lineAfter)}`);
      editableCode[lineToInsertIn] = lineBefore + stringToInsert + lineAfter;
      Constants.debug.logCodeEditor && console.log("  updated full line=", JSON.stringify(editableCode[lineToInsertIn]));

    } else if (action === 'remove') {
      let lineToStartRemovingFrom = start.row - editableRegionStart;
      let firstPositionToRemove = start.column;
      let lastLineToRemove = end.row - editableRegionStart;
      let lastPositionToRemove = end.column;

      Constants.debug.logCodeEditor && console.log(" INITIAL REMOVE VALUES: lineToStartRemovingFrom=", lineToStartRemovingFrom, " firstPositionToRemove=", firstPositionToRemove, " lastLineToRemove=", lastLineToRemove, " lastPositionToRemove=", lastPositionToRemove);

      if (lineToStartRemovingFrom < 0) {
          lineToStartRemovingFrom = 0;
          firstPositionToRemove = 0;
      }
      if (lastLineToRemove < 0) {
          lastLineToRemove = 0;
          lastPositionToRemove = 0;
      }
      if (lastLineToRemove >= editableCode.length) {
          lastLineToRemove = editableCode.length - 1;
          lastPositionToRemove = editableCode[lastLineToRemove].length;
      }

      Constants.debug.logCodeEditor && console.log(" FINAL REMOVE VALUES: lineToStartRemovingFrom=", lineToStartRemovingFrom, " firstPositionToRemove=", firstPositionToRemove, " lastLineToRemove=", lastLineToRemove, " lastPositionToRemove=", lastPositionToRemove);

      if (lineToStartRemovingFrom < 0) {
        lineToStartRemovingFrom = 0;
        firstPositionToRemove = 0;
      }

      if (lineToStartRemovingFrom >= editableCode.length) {
          // nothing to do
          Constants.debug.logCodeEditor && console.log("REMOVE - nothing to do")
      } else if (lastLineToRemove < lineToStartRemovingFrom) {
          // remove all lines
          editableCode = ['    '];
          Constants.debug.logCodeEditor && console.log("REMOVE - clear all")
      } else {
             
        Constants.debug.logCodeEditor && console.log(" editableCode=", editableCode);
        Constants.debug.logCodeEditor && console.log(" Removing from line ", lineToStartRemovingFrom, " position ", firstPositionToRemove, " to line ", lastLineToRemove, " position ", lastPositionToRemove);

        if (lineToStartRemovingFrom == lastLineToRemove) {
            // Remove a section of a single line
            // If the section removed would leave a length of 0, remove the line, unless it's the only line
            // in which case leave an empty line
            if (firstPositionToRemove == 0 && lastPositionToRemove == editableCode[lineToStartRemovingFrom].length) {
                if (editableCode.length > 1) {
                    Constants.debug.logCodeEditor && console.log("  Removing a single line - ", lineToStartRemovingFrom);
                    editableCode.splice(lineToStartRemovingFrom, 1);
                } else {
                    Constants.debug.logCodeEditor && console.log("  Removing a single line - ", lineToStartRemovingFrom, " but leaving an empty line");
                    editableCode[lineToStartRemovingFrom] = '';
                }
            } else {
              Constants.debug.logCodeEditor && console.log("  Removing a section of a single line - ", firstPositionToRemove, "-", lastPositionToRemove);
              editableCode[lineToStartRemovingFrom] = editableCode[lineToStartRemovingFrom].substring(0, firstPositionToRemove) + editableCode[lineToStartRemovingFrom].substring(lastPositionToRemove);
            }
        } else if (lineToStartRemovingFrom <= lastLineToRemove) {

          // Remove the section of the first line

          let newLine = '    ';
          let removeFirstLine = false;
          let removeLastLine = false;
          if (editableCode[lineToStartRemovingFrom].length == 0){
            removeFirstLine = true;
          } else {
            newLine = editableCode[lineToStartRemovingFrom].slice(0, firstPositionToRemove);
          }
          if (editableCode[lastLineToRemove].length == 0){
            removeLastLine = true;
          } else {
            newLine += editableCode[lastLineToRemove].slice(lastPositionToRemove);
          }

          if (lastLineToRemove > lineToStartRemovingFrom) {
            Constants.debug.logCodeEditor && console.log( "  Removing lines from ", lineToStartRemovingFrom + 1, " and removing ", lastLineToRemove - lineToStartRemovingFrom, " lines")
            const firstLineIndex = lineToStartRemovingFrom + (removeFirstLine ? 0 : 1);
            const lastLineIndex = lastLineToRemove - lineToStartRemovingFrom;
            editableCode.splice(firstLineIndex, lastLineIndex);
          }
          editableCode[lineToStartRemovingFrom] = newLine;
        }
      }
    }


    // Reassemble the code
    let newUserCode = editableCode.join('\n'); // Join the lines back together

    Constants.debug.logCodeEditor && console.log("Final editableCode array=", editableCode)
    Constants.debug.logCodeEditor && console.log("Final newUserCode=", JSON.stringify(newUserCode));

    return newUserCode;
 }


  const handleCodeChanged = (currentDisplayedCode, change) => {
    let newUserCode = extractChangedUserCode(fullFunctionCodeToDisplayRef.current, change);

    if (newUserCode !== code_UNSAFERef.current) {
      updateCustomCode(newUserCode);
      refreshDisplayedFullFunctionCode(newUserCode);
    } else {
      // An attempt was made to change read-only parts of the code
      // unfortunately this will cause the cursor to diappear :()
      setKey((prev) => prev + 1);
    }
  }

  if (fullFunctionCodeToDisplay == null) {
    return null;
  }

  return (
    <Box className={classes.themeEditorContainer}>
      
      {/*
      <Typography variant="h6">Sample code (copy and paste)</Typography>
      <ReadOnlyCodeBlock id="sample code" code={sampleCode} />
      */}

      <Typography variant="h6">Code to run each turn</Typography>

      <Box 
          sx={{
            flex: 1, 
            flexDirection: 'column', 
            width: '100%',
            alignContent: 'flex-start', 
            justifyContent: 'flex-start',
            backgroundColor: 'darkgray'
          }}
        >
            <AceEditor
              placeholder=""
              mode="javascript"
              theme="monokai"
              name="turnHandler"
              width='100%'
              onChange={handleCodeChanged}
              fontSize={14}
              showPrintMargin={true}
              showGutter={true}
              highlightActiveLine={true}
              value={fullFunctionCodeToDisplayRef.current}
              readOnly={readOnly}
              setOptions={{
              enableBasicAutocompletion: true,
              enableLiveAutocompletion: false,
              enableSnippets: false,
              showLineNumbers: false,
              tabSize: 2,
              wrap: true,
            }}/>
        </Box>
    </Box>
  );
}

