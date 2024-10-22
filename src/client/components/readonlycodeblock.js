import React from 'react';
import AceEditor from "react-ace";

import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/theme-monokai';

export function ReadOnlyCodeBlock({ code, id }) {
  return (
    <AceEditor
      mode="javascript"
      theme="monokai"
      value={code}
      readOnly={true}
      name={id}  // It should be a unique id across your application
      editorProps={{ $blockScrolling: true }}
      setOptions={{
        useWorker: false,
        highlightActiveLine: false,
        showGutter: true,
        showPrintMargin: false,
        showLineNumbers: false,
      }}
      fontSize={14}
      width="100%"
    />
  );
}
