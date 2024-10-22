
import { Config } from "@src/backend/config";

export const stringArrayParser = (variableName) => { return {
    field: variableName,
    enclosingPatterns: [
    {
        start: `\n${variableName.toUpperCase()}`,
        end: "\n\n",
        caseInsensitive: true,
        endOnEOS: true,
    },
    {
        start: "[\"",
        end: "\"]",
        caseInsensitive: true,
        endOnEOS: false,
    },
    {
        start: "\n1.",
        end: "\n\n",
        caseInsensitive: true,
        endOnEOS: true,
    },
    {
        start: "\n1)",
        end: "\n\n",
        caseInsensitive: true,
        endOnEOS: true,
    },
    {
        start: "\nA.",
        end: "\n\n",
        caseInsensitive: true,
        endOnEOS: true,
    },
    {
        start: "\nA)",
        end: "\n\n",
        caseInsensitive: true,
        endOnEOS: true,
    },
    {
        start: "\n-",
        end: "\n\n",
        caseInsensitive: true,
        endOnEOS: true,
    },
    {
        start: "\n -",
        end: "\n\n",
        caseInsensitive: true,
        endOnEOS: true,
    },
    ],
    parseRegexs: [
    {
        // 1. <string> 
        // 2. <string>
        match: /\d+\..*(?:\n|$)/g,
        parse: /(?:^|\s*)\d+\.\s*(.*?)(?:\n|$)/g, 
    },
    {
        // 1) <string> 
        // 2) <string>
        match: /\d+\).*(?:\n|$)/g,
        parse: /(?:^|\s*)\d+\)\s*(.*?)(?:\n|$)/g, 
    },
    {
        // A. <string> 
        // B. <string>
        match: /[A-Z]\..*(?:\n|$)/g,
        parse: /(?:^|\s*)[A-Z]\.\s*(.*?)(?:\n|$)/g, 
    },
    {
        // A) <string> 
        // B) <string>
        match: /[A-Z]\).*(?:\n|$)/g,
        parse: /(?:^|\s*)[A-Z]\)\s*(.*?)(?:\n|$)/g, 
    },
    {
        // ["<string>","<string>"]"
        match: /^\[\s*".*?"\s*(,\s*".*?"\s*)*\]$/gm,
        parse: /\"(.*?)\"/gm, 
    },
    {
        // -string
        // -string
        match: /^\s*-.*$/g,
        parse: /^\s*-\s*(.*?)(?:\n|$)/g
    }
    ],
    replacementText: '',
    parse(matchingPattern, potentialMatchBuffer) {
        const { Constants } = Config;

        let bestPairMatch = null;
        let longestLength = 0;
        for (let regexPair of this.parseRegexs) {
            //
            // Multiple regexes might match. Let's iterate on the regexes to find the 
            // best match
            //
            let regex = regexPair.match;
            regex.lastIndex = 0;
            let totalMatchLen = 0;
            let match;
            while ((match = regex.exec(potentialMatchBuffer)) !== null) {
                Constants.debug.logDataParsing && console.error("regex.exec match: ", JSON.stringify(match))
                totalMatchLen += match[0].length;
            }
            if (totalMatchLen > 0 &&
                totalMatchLen > longestLength) {
                Constants.debug.logDataParsing && console.error(`PARSE: Matched ${regexPair.match}: length=${totalMatchLen}`);
                bestPairMatch = regexPair;
                longestLength = totalMatchLen;
            }
        }
    
        if (bestPairMatch) {
            Constants.debug.logDataParsing && console.error(`PARSE: Matched ${bestPairMatch.match}: `, potentialMatchBuffer);
            try {
                // Try parsing the buffer
                let results = {};
                results[this.field] = [...potentialMatchBuffer.matchAll(bestPairMatch.parse)].map(match => match[1]);
    
                Constants.debug.logDataParsing && console.error("Successfully parsed: \n   BUFFER: ", potentialMatchBuffer, 
                        "\n   REGEX : ", bestPairMatch.parse,
                        "\n   RESULT: ", JSON.stringify(results));
    
                return results;
            } catch (error) {
                console.error(`FAILED PARSE: Pattern ${bestPairMatch.parse} error=`, error);
            }
        }
        
        // If endOfStream and no parseRegex matches or parsing fails
        Constants.debug.logDataParsing && console.error("PARSE: NO MATCHES for buffer: ", potentialMatchBuffer);
        return null;
    }
}};
