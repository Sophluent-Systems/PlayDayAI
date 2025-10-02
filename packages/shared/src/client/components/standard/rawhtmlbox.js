import React from "react";

export function RawHTMLBox({ html, ...rest }) {
  return <div {...rest} dangerouslySetInnerHTML={{ __html: html }} />;
}