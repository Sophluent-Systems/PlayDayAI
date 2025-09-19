import { containsEscapedChars, unescapeChars } from '@src/common/strings';
import { attemptToParseJSON_UNSAFE } from '@src/common/objects';


export const jsonBlockParser = {
    enclosingPatterns: [
    {
        start: "{",
        end: "}",
        caseInsensitive: true,
        endOnEOS: false,
    },
    ],
    parseRegexs: [
    {
        // { ... }
        match: /^{.*?}$/gm,
        parse: /{(.*?)}/gm, 
    },
    ],
    replacementText: '',
    parse(matchingPattern, potentialMatchBuffer) {
        let finalBuffer = potentialMatchBuffer;
        if (containsEscapedChars(finalBuffer)) {
            finalBuffer = unescapeChars(finalBuffer);

            console.log("jsonBlockParser: ");
            console.log("    Escaped : ", potentialMatchBuffer);
            console.log("    Unescaped: ", finalBuffer);
        }

        try { 
            let data = JSON.parse(finalBuffer);
            return data;
        } catch (error) {
            let data = attemptToParseJSON_UNSAFE(finalBuffer);
            if (data) {
                return data;
            }
            console.log("Thought we had a JSON block match but failed to parse: ", potentialMatchBuffer );
            console.log("Failure: ", error);
            return null;
        }
    }
};
