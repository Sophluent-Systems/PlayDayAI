


export function removeNonUTF8Characters(str) {
    return str.replace(/[^\x20-\x7E]/g, ' ');
}

export function replaceLineBreaksWithBR(str) {
    let newstr = str.replace(/\\n/g, '<br />');
    return newstr.replace(/\n/g, '<br />');
}

export function indexOfPartialMatch(mainString, substring) {
  if (substring.length === 0) {
       throw new Error("Cannot find index of empty string");
  }

  let idx = mainString.indexOf(substring);

  // If a full match is found or substring is not found at all, return the result
  if (idx !== -1) {
    return idx;
  }

  // If not, iterate through the substring from the end to the beginning
  // Iterate through the substring from the end to the beginning
  for (let i = substring.length; i > 0; i--) {
    let partialSubstring = substring.substring(0, i);

    // Compare partialSubstring to the last part of mainString
    if (partialSubstring === mainString.slice(-i)) {
        return mainString.length - i;
    }
  }

  return -1;  // If no match at all, return -1
}

export function containsEscapedChars(str) {
  const escapedCharPattern = /(\\[ntrbf"\\'])/;
  return escapedCharPattern.test(str);
}

export function unescapeChars(str) {
  const replacements = {
      '\\n': '\n',
      '\\t': '\t',
      '\\r': '\r',
      '\\b': '\b',
      '\\f': '\f',
      '\\"': '"',
      '\\\'': '\'',
      '\\\\': '\\'
  };

  return str.replace(/\\[ntrbf"\\']/g, match => replacements[match]);
}
