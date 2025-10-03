"use client";

import React, { useEffect, useRef, useState } from "react";
import AceEditor from "react-ace";
import { defaultAppTheme } from "@src/common/theme";
import { getCodeStartingLines, getCodeEndingLines, composeFullFunctionCode } from "@src/common/customcode";
import { useConfig } from "@src/client/configprovider";

export function CodeEditor({ code_UNSAFE, inputNodes, onChange, readOnly, rootObject, theme }) {
  const { Constants } = useConfig();
  const resolvedTheme = theme ?? defaultAppTheme;

  const [fullFunctionCodeToDisplay, setFullFunctionCodeToDisplay] = useState(null);
  const [startingCode, setStartingCode] = useState([""]);
  const [endingCode, setEndingCode] = useState([""]);
  const [, forceRefresh] = useState(0);

  const codeRef = useRef("");
  const fullFunctionCodeRef = useRef(null);

  useEffect(() => {
    if (codeRef.current !== code_UNSAFE) {
      codeRef.current = code_UNSAFE;
      refreshDisplayedFullFunctionCode(codeRef.current);
    }
  }, [code_UNSAFE]);

  useEffect(() => {
    const newStarting = getCodeStartingLines(inputNodes);
    const newEnding = getCodeEndingLines();
    fullFunctionCodeRef.current = composeFullFunctionCode(newStarting, codeRef.current, newEnding);

    setStartingCode(newStarting);
    setEndingCode(newEnding);
    setFullFunctionCodeToDisplay(fullFunctionCodeRef.current);

    if (Constants.debug.logCodeEditor) {
      console.log("CodeEditor starting code", newStarting);
      console.log("CodeEditor ending code", newEnding);
    }
  }, [inputNodes, Constants.debug.logCodeEditor]);

  const updateCustomCode = (next) => {
    if (codeRef.current !== next) {
      codeRef.current = next;
      onChange(next);
    }
  };

  const refreshDisplayedFullFunctionCode = (userCode) => {
    fullFunctionCodeRef.current = composeFullFunctionCode(startingCode, userCode, endingCode);
    if (fullFunctionCodeRef.current !== fullFunctionCodeToDisplay) {
      setFullFunctionCodeToDisplay(fullFunctionCodeRef.current);
    }
  };

  const extractChangedUserCode = (currentCode, change) => {
    let codeLines = Array.isArray(currentCode) ? [...currentCode] : String(currentCode).split("\n");

    if (codeLines.length < startingCode.length + endingCode.length) {
      throw new Error("Code length is shorter than protected regions");
    }

    const editableStart = startingCode.length;
    let editableCode = codeLines.slice(editableStart, endingCode.length ? -endingCode.length : undefined);
    if (editableCode.length === 0) {
      editableCode = ["    "];
    }

    if (Constants.debug.logCodeEditor) {
      console.log("Editable code", editableCode);
      console.log("Change", change);
    }

    const { start, end, lines } = change;
    const lineOffset = editableStart;
    const firstLine = start.row - lineOffset;
    const firstPos = start.column;
    const lastLine = end.row - lineOffset;
    const lastPos = end.column;

    if (change.action === "insert") {
      if (firstLine === lastLine) {
        const prefix = editableCode[firstLine]?.slice(0, firstPos) ?? "";
        const suffix = editableCode[firstLine]?.slice(firstPos) ?? "";
        editableCode[firstLine] = `${prefix}${lines.join("\n")}${suffix}`;
      } else {
        const prefix = editableCode[firstLine]?.slice(0, firstPos) ?? "";
        const suffix = editableCode[lastLine]?.slice(lastPos) ?? "";
        const middle = lines.join("\n");
        editableCode.splice(firstLine, lastLine - firstLine + 1, `${prefix}${middle}${suffix}`);
      }
    } else if (change.action === "remove") {
      if (firstLine === lastLine) {
        const line = editableCode[firstLine] ?? "";
        editableCode[firstLine] = `${line.slice(0, firstPos)}${line.slice(lastPos)}`;
        if (!editableCode[firstLine] && editableCode.length > 1) {
          editableCode.splice(firstLine, 1);
        }
      } else {
        const startLine = editableCode[firstLine] ?? "";
        const endLine = editableCode[lastLine] ?? "";
        const mergedLine = `${startLine.slice(0, firstPos)}${endLine.slice(lastPos)}` || "    ";
        editableCode.splice(firstLine, lastLine - firstLine + 1, mergedLine);
      }
    }

    return editableCode.join("\n");
  };

  const handleCodeChanged = (currentDisplayed, change) => {
    const newUserCode = extractChangedUserCode(fullFunctionCodeRef.current, change);

    if (newUserCode !== codeRef.current) {
      updateCustomCode(newUserCode);
      refreshDisplayedFullFunctionCode(newUserCode);
    } else {
      forceRefresh((value) => value + 1);
    }
  };

  if (fullFunctionCodeToDisplay == null) {
    return null;
  }

  const containerStyle = {
    backgroundColor: resolvedTheme?.colors?.messagesAreaBackgroundColor ?? "rgba(15,23,42,0.35)",
    borderColor: resolvedTheme?.colors?.borderColor ?? "rgba(148,163,184,0.35)",
  };

  return (
    <div
      className="rounded-3xl border p-6 shadow-soft backdrop-blur-xl"
      style={containerStyle}
    >
      <h3 className="text-lg font-semibold text-emphasis">Code to run each turn</h3>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border/40 bg-black/60">
        <AceEditor
          placeholder=""
          mode="javascript"
          theme="monokai"
          name="turnHandler"
          width="100%"
          onChange={handleCodeChanged}
          fontSize={14}
          showPrintMargin
          showGutter
          highlightActiveLine
          value={fullFunctionCodeRef.current}
          readOnly={readOnly}
          setOptions={{
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: false,
            enableSnippets: false,
            showLineNumbers: false,
            tabSize: 2,
            wrap: true,
          }}
        />
      </div>
    </div>
  );
}

export default CodeEditor;
