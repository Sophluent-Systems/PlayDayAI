import { indexOfPartialMatch } from '@src/common/strings';
import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from '@src/common/objects';


export class TextStreamParser {
    constructor(parserDefinition) {
        this.parserDefinition = parserDefinition;
        this.context = {};
        this.buffer = '';
    }

    reset() {
        this.context = {};
        this.buffer = '';
    }

    //
    // Pattern matching:
    //   1. Find the first starting string that matches
    //   2. Continue matching until either (1) the pattern breaks, or (2) we reach the end of the buffer
    //   3. If the pattern breaks, check the other patterns for the start string that matches earliest
    //      in the buffer
    //   4. At end-of-stream, if we have a match, return the match, otherwise return null
    //a

    findStartingStringMatch(patternToAttempt, buffer) {
        for (let enclosingPattern of patternToAttempt.enclosingPatterns) {
            
            let matchIndex = indexOfPartialMatch(buffer, enclosingPattern.start);

            if (matchIndex != -1) {
                return {
                    startStringMatchIndex : matchIndex,
                    pattern : patternToAttempt,
                    enclosingPattern : enclosingPattern,
                }
            }
        }

        return {
            startStringMatchIndex : -1,
            pattern : null,
            enclosingPattern : null,
            completeStartingMatch: false,
        };
    }

    findEndingStringMatchIndex(buffer, searchString) {
        // The entire string must match
        let startIndex = buffer.indexOf(searchString); 
        if (startIndex === -1) {
            return -1;
        }

        return startIndex + searchString.length;
    }

    async filterTextStream(tokens, endOfStream) {
        const { Constants } = Config;
        Constants.debug.logDataParsing && endOfStream && console.error(`  END OF STREAM: ${this.buffer}`);

        this.buffer += tokens; 

        let returnValue = {
            data: {},
            passThroughTokens: "",
            newMatch: false,
            processingMatch: false,
            processedBuffer: "",
        }
    
        //
        // If we have a context from last time -- is it still valid?
        //
        if (this.context.pattern && this.context.enclosingPattern) {
    
            if (endOfStream && !this.context.enclosingPattern.endOnEOS) {
                Constants.debug.logDataParsing && console.error("  END OF STREAM: but pattern doesn't allow it");
                // 
                // Special case -- if it's EOS, but this pattern doesn't allow EOS as an end state,
                // need to search for a different pattern
                //
                this.context.pattern = null;
                this.context.enclosingPattern = null;
            } else {
                //
                // Does the pattern still match now that we have more data?
                // Also -- this resets "startStringMatchIndex"
                this.context.startStringMatchIndex = indexOfPartialMatch(this.buffer, this.context.enclosingPattern.start);
    
                if (this.context.startStringMatchIndex === -1) {
                    Constants.debug.logDataParsing && console.error("  Buffer lo longer matches: ", this.buffer);
                    this.context.pattern = null;
                    this.context.enclosingPattern = null;
                } else {
                    Constants.debug.logDataParsing && console.error("  Buffer still matches: ", this.buffer);
                }
            }
        }
    
        //
        // If there is no pattern data - search
        //
        if (!this.context.pattern || !this.context.enclosingPattern) {
            Constants.debug.logDataParsing && console.error("LOOKING FOR START MATCH");
            let searchResult = this.findStartingStringMatch(this.parserDefinition, this.buffer);
            this.context = {...this.context, ...searchResult};
    
            if (this.context.pattern && this.context.enclosingPattern) {
                // Note that we just started a new match
                returnValue.newMatch = true;

                Constants.debug.logDataParsing && console.error(`START MATCH: field: ${this.context.pattern.field} pattern: ${this.context.enclosingPattern.start}: `, this.buffer);
            }
        } 
    
        //
        // If no matches:  pass through the entire this.buffer
        //
        if (!this.context.enclosingPattern) {
            Constants.debug.logDataParsing && console.error("NO MATCHES: ", this.buffer);
            returnValue.passThroughTokens = this.buffer;
            returnValue.data = null;
            returnValue.processingMatch = false;
            returnValue.processedBuffer = '';
            returnValue.newMatch = false;
            this.reset();
            return returnValue;
        }
    
        if ((this.context.startStringMatchIndex + this.buffer.length) >= this.context.enclosingPattern.start.length) {
            this.context.completeStartingMatch = true;
        }
    
        //
        // If our pattern starts after the first character in the buffer,
        // pass through the characters preceding the pattern
        //
        if (this.context.startStringMatchIndex > 0) {
            returnValue.passThroughTokens = this.buffer.substring(0, this.context.startStringMatchIndex);
            Constants.debug.logDataParsing && console.error("PARSE: Trimmed ", returnValue.passThroughTokens);
            this.buffer = this.buffer.substring(this.context.startStringMatchIndex);
        }
    
        //
        // Great we have a starting string -- do we have an end string?
        //
        if (this.context.completeStartingMatch) {

            this.context.endingMatchIndex = this.findEndingStringMatchIndex(this.buffer, this.context.enclosingPattern.end);
            if (this.context.endingMatchIndex < 0 && endOfStream) {
                // By this point, we will have confirmed that the pattern allows EOS as an end state
                this.context.endingMatchIndex = this.buffer.length-1;
            } 
        } else {
            if (endOfStream) {
                Constants.debug.logDataParsing && console.error("EOS BUT INCOMPLETE START - NO MATCH");
            }
            this.context.endingMatchIndex = -1;
        }
    
        //
        // If we have a valid end index, parse the buffer
        //
    
        
        
        if (this.context.endingMatchIndex  != -1) {
            //
            // WE ARE DONE WITH THIS MATCH
            //
    
           let potentialMatchBuffer = this.buffer.substring(0, this.context.endingMatchIndex+1);
        
           Constants.debug.logDataParsing && console.error(`END MATCH: EOS: ${endOfStream} pattern: ${this.context.enclosingPattern.end}: `, potentialMatchBuffer);
    
           let processedData = this.parserDefinition.parse(this.context.enclosingPattern, potentialMatchBuffer);
    
            if (processedData) {

                returnValue.data = {...returnValue.data, ...processedData};
                returnValue.processedBuffer = potentialMatchBuffer;
            } else {
                // 
                // If we didn't match, then we need to return the entire buffer to the client
                //    TODO: Should we go back and search for a different pattern !?!?!?
                //
                returnValue.passThroughTokens = this.buffer;
            }

            // Mark that we're done processing this match
            returnValue.processingMatch = false;

            this.reset();
            
        } else if (endOfStream) {
            // 
            // HAVE A MATCH, BUT END OF STREAM -- we don't have a complete match so back off
            //
            Constants.debug.logDataParsing && console.error("EOS ON MATCH couldn't parse --> pass to client");
            returnValue.passThroughTokens = this.buffer;

            // Done with this buffer
            returnValue.processingMatch = false;

            this.reset();
    
        } else {
            // VERBOSE!! Print all matches
            //Constants.debug.logDataParsing && console.error(`+    ${this.buffer}`);

            // We're still processing this match
            returnValue.processingMatch = true;
        }
    
        if (endOfStream) {
            Constants.debug.logDataParsing && console.error("END OF STREAM RESULT: ", JSON.stringify(returnValue));
        }
    
        return returnValue;
      } 
    
  }

export class TextStreamFilterManager {
    constructor(resultsCallback, callerContext) {
        this.resultsCallback = resultsCallback;
        this.callerContext = callerContext;
        this.activeFilter = null;
        this.parsers = [];
        this.buffer = '';
        this.passThroughOnMatch = '';
        this.callbackInfoThisFrame = null;
        this.rawResponse = '';
    }

    addParser(parser) {
        this.parsers.push(new TextStreamParser(parser));
    }

    trimStringFromStartOfBuffer(stringToTrim) {
        let index = this.buffer.indexOf(stringToTrim);
        if (index === 0) {
            this.buffer = this.buffer.substring(index + stringToTrim.length);
        } else if (index === -1) {
            throw new Error(`trimStringFromStartOfBuffer: stringToTrim ${stringToTrim} not found in buffer ${this.buffer}`);
        } else if (index > 0) {
            throw new Error(`trimStringFromStartOfBuffer: stringToTrim ${stringToTrim} found at index ${index} in buffer ${this.buffer} but not at start of buffer`);
        }
    }

    async processSingleFilter(filter, tokens, endOfStream) {

        if (!this.callbackInfoThisFrame) {
            console.error("processSingleFilter: no callbackInfoThisFrame STACK:" + new Error().stack);
            throw new Error("processSingleFilter: no callbackInfoThisFrame");
        }

        let result = await filter.filterTextStream(tokens, endOfStream);


        // If we processed buffer then we have structured data to pass
        if (!nullUndefinedOrEmpty(result.processedBuffer)) {

            //
            // NO NESTED PATTERNS -- We pass the data straight through once 
            // one filter engages. This is sure to cause bugs if we ever have
            // multiple filters in sequence. 
            // 
            this.callbackInfoThisFrame.tokens += this.passThroughOnMatch + result.passThroughTokens;
            this.trimStringFromStartOfBuffer(this.callbackInfoThisFrame.tokens);
            this.passThroughOnMatch = '';
        
            this.trimStringFromStartOfBuffer(result.processedBuffer);

            if (!this.callbackInfoThisFrame.data) {
                this.callbackInfoThisFrame.data = {};
            }

            this.callbackInfoThisFrame.data = {...this.callbackInfoThisFrame.data, ...result.data};
        }

        if (result.processingMatch) {
            this.activeFilter = filter;
            this.passThroughOnMatch += result.passThroughTokens;
        } else {
            this.activeFilter = null;
            this.passThroughOnMatch = '';
        }
        
        return result;
    }

    clearActiveFilter() {
        if (this.activeFilter) {
            this.activeFilter.reset();
            this.activeFilter = null;
        }
        this.passThroughOnMatch = '';
    }

    async filterTextStream(state, data) {
        
        let endOfStream = false;
        let tokens = '';
        this.callbackInfoThisFrame = {
            tokens: '',
            data: {},
            error: null,
            endOfStream: endOfStream,
        };

        switch (state) {
            case 'data':
                tokens = data ? data : '';
                break;
            case 'cancelled':
                this.callbackInfoThisFrame.error = new Error("Cancelled");
                await this.resultsCallback(this.callbackInfoThisFrame, this.callerContext);
                this.callbackInfoThisFrame = null;
                return false;
            case 'done':
                tokens = data ? data : '';
                endOfStream = true;
                this.callbackInfoThisFrame.endOfStream = endOfStream;
                break;
            case 'error':
                console.error("TextStreamFilterManager.filterTextStream received error: ", data);
                this.callbackInfoThisFrame.error = data;
                await this.resultsCallback(this.callbackInfoThisFrame, this.callerContext);
                this.callbackInfoThisFrame = null;
                return false;
            default:
                throw new Error("filterTextStream: unknown state: " + state);
        }
        
        this.rawResponse += tokens;
        this.buffer += tokens;
        
        try {
            //
            // If there's an active filter from last time, continue with that one
            //
            if (this.activeFilter) {
                let processingResult = await this.processSingleFilter(this.activeFilter, tokens, endOfStream);
                if (processingResult.newMatch) {
                    // We were processing a match, but the filter didn't match. We're
                    // starting over. We need to go back to the filter order in case
                    // this wouldn't  Reset the active filter.
                    this.clearActiveFilter();
                }
            }

            //
            // If there's no active filter, keep going as long as there's unprocessed
            // buffer and we're maaking progress
            //
            while (!this.activeFilter && this.buffer.length > 0) {

                //
                // No active filters - through all the filters in order looking for a match
                //

                let startingBufferLength = this.buffer.length;
                for (let filter of this.parsers) {
                    await this.processSingleFilter(filter, this.buffer, endOfStream);
                    if (this.activeFilter) {
                        break;
                    }
                }

                if (!this.activeFilter && (this.buffer.length == startingBufferLength)) {
                    break;
                }
            }
            
            if (!this.activeFilter) {
                // 
                // Nothing matched, nothing processed -- pass through the entire buffer
                //
                this.callbackInfoThisFrame.tokens += this.buffer;
                this.buffer = '';
            }


        } catch (error) {
            console.error("TextStreamFilterManager.filterTextStream caught error: ", error);
            this.callbackInfoThisFrame.error = error;
            this.callbackInfoThisFrame.tokens = this.buffer;

            //
            // Attempt to recover - reset all state
            //

            this.buffer = '';
            this.clearActiveFilter();
        }
        
        const continueProcessing = await this.resultsCallback(this.callbackInfoThisFrame, this.callerContext);
        this.callbackInfoThisFrame = null;

        return continueProcessing;
    };
    
    getRawResponse() {
        return this.rawResponse;
    }
  }
  