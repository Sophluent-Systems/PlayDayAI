import { getMessageStyling } from "@src/client/themestyling";
import { Constants } from '@src/common/defaultconfig';

const defaultAudioState = {
    backgroundMusic: {
        playState: "none",
        recordID: null,
        source: null,
    },
    soundEffect: {
        playState: "none",
        recordID: null,
        source: null,
    },
    speech: {
        playState: "none",
        recordID: null,
        source: null,
    },
    theme: {},
  }

const AUTO_PLAY_DELAY = 30000;

export class AudioManager {
    constructor({onAudioStateChange}) {
        this.controller = null;
        this.messages = null;
        this.speechQueue = [];
        this.soundEffectQueue = [];
        this.mostRecentRecordProcessed = null;
        this.onAudioStateChange = onAudioStateChange;
        this.backgroundMusicRecordID = null;
        this.audioState = JSON.parse(JSON.stringify(defaultAudioState));
        this.pendingPlayback = {
            speech: null,
            soundEffect: null,
        }

        Constants.debug.logAudioPlayback && console.log("AudioManager: ^^^^^^^^^Created^^^^^^^^^");
    }

    initialized() {
        return this.controller != null;
    }   

    initialize({controller}) {
        this.controller = controller;

        // If we have messages, we can start playing audio
        if (this.messages) {
            this.updateMessageList(this.messages);
            this.messages = null;
        }

    }

    onAudioSessionStateChange(state) {
        Constants.debug.logAudioPlayback && console.log("AudioManager: onAudioSessionStateChange ", state);
        if (state == "interrupted") {
            Constants.debug.logAudioPlayback && console.log("AudioManager: Audio session interrupted -- pausing speech & sound effects");
            this.handleAudioStateChange("speech", "paused");
            this.handleAudioStateChange("soundEffect", "paused");
        } else if (state == "active") {
            Constants.debug.logAudioPlayback && console.log("AudioManager: Audio session active -- resuming speech & sound effects");
            this.updateAudioPlayqueues();
        }
    }

    updateBackgroundMusic(newMessages) {

        // We want to play the most recent background music 
        let bgMusicMessage = null;
        for (let i = newMessages.length-1; i >= 0; i--) {
            if (newMessages[i].content?.audio?.audioType == 'backgroundMusic') {
                bgMusicMessage = newMessages[i];
                break;
            }
        }

        // Is this background music playing?
        if (bgMusicMessage && bgMusicMessage.recordID != this.backgroundMusicRecordID) {
            this.backgroundMusicRecordID = bgMusicMessage.recordID;
            Constants.debug.logAudioPlayback && console.log("AudioManager: Playing background music: ", bgMusicMessage.content.audio);
            if (this.audioState?.backgroundMusic?.source?.recordID != bgMusicMessage.recordID) {
                // If not, start it
                this.requestAudioControl("play", "backgroundMusic", { recordID: bgMusicMessage.recordID, source: bgMusicMessage.content.audio});
            }
        }
    }

    shouldPlayASAP(message) {
        Constants.debug.logAudioPlayback && console.log("AudioManager: shouldPlayASAP:  autoplay=", message.content.audio.autoplay);
        const autoPlayMode = message.content.audio.autoplay || 'onlyFirstTime';

        if (autoPlayMode == 'always') {
            return true;
        }

        if (autoPlayMode == 'onlyFirstTime') {
            const now = new Date();
            const timeSinceCompletion = now - new Date(message.completionTime);
            const isLessThanAutoplayDelay = timeSinceCompletion < AUTO_PLAY_DELAY;
            const timeSinceCompletionInSeconds = timeSinceCompletion / 1000;
            Constants.debug.logAudioPlayback && console.log("AudioManager: isLessThanAutoplayDelay: ", isLessThanAutoplayDelay, `(${timeSinceCompletionInSeconds} seconds)`); 
            return isLessThanAutoplayDelay;
        }
        
        return false;
    }

    updateSpeechAndsoundEffectQueues(newMessages) {
        
        if (!newMessages || newMessages.length == 0) {
            console.log("AudioManager: No messages to process")
            return;
        }

        //
        // Ensure all enqueued messages are still valid
        //
        for (let i = this.speechQueue.length-1; i >= 0; i--) {
            const message = this.speechQueue[i].message;
            const found = newMessages.find((newMessage) => newMessage.recordID == message.recordID);
            if (!found) {
                this.speechQueue.splice(i, 1);
            }
        }

        for (let i = this.soundEffectQueue.length-1; i >= 0; i--) {
            const message = this.soundEffectQueue[i].message;
            const found = newMessages.find((newMessage) => newMessage.recordID == message.recordID);
            if (!found) {
                this.soundEffectQueue.splice(i, 1);
            }
        }

        //
        // Find any new audio messages that need to be played
        //

        let newAudios = [];
        let newMostRecent = this.mostRecentRecordProcessed;
        const now = new Date();
        
        for (let i = newMessages.length-1; i >= 0; i--) {
            const message = newMessages[i];
            if (message.recordID == this.mostRecentRecordProcessed) {
                break;
            }

            if (message.content?.audio?.audioType == 'speech' || message.content?.audio?.audioType == 'soundEffect') {
                Constants.debug.logAudioPlayback && console.log("AudioManager: Found new audio message", message);
                if (this.shouldPlayASAP(message)) {
                    newAudios.push({
                        state: 'unplayed',
                        message: message
                    });
                }

                // avoids us tripping over incomplete messages
                newMostRecent = message.recordID;
            }
        }

        this.mostRecentRecordProcessed = newMostRecent;

        if (newAudios.length == 0) {
            return;
        } else {
            Constants.debug.logAudioPlayback && console.log("AudioManager: Found new audio messages: ", newAudios);
        }

        // We now have a list of new audio messages to process in reverse chronlogoical 
        // order. We want to play the most recent audios first. It's OK for SFX and speech
        // to play at the same time, so we can process them together.

        for (let i = newAudios.length-1; i >= 0; i--) {
            if (newAudios[i].message.content.audio.audioType == 'speech') {
                this.speechQueue.push(newAudios[i]);
            } else if (newAudios[i].message.content.audio.audioType == 'soundEffect') {
                this.soundEffectQueue.push(newAudios[i]);
            }
        }
    }

    updateAudioPlayqueues() {

        //
        // Background music is controlled separately, so this is where we
        // handle speech and sound effects, playing the most recent unplayed
        // audio when the previous audio has finished.
        //

        const queues = [
            { type: 'speech', queue: this.speechQueue },
            { type: 'soundEffect', queue: this.soundEffectQueue },
          ];
        
          queues.forEach(({ type, queue }) => {
            if (queue.length > 0 && queue[queue.length - 1].state === 'unplayed') {
              if (this.pendingPlayback[type] === null && (this.audioState[type].playState === 'none' || this.audioState[type].playState === 'stopped' || this.audioState[type].playState === 'paused')) {
                const audio = queue.find((item) => item.state === 'unplayed');
                if (audio) {
                  const mediaTypes = audio.message.nodeAttributes?.["mediaTypes"] || [];
                  const styling = getMessageStyling(mediaTypes, audio.message.persona);
                  const speakerName = audio.message.persona?.displayName;
                  Constants.debug.logAudioPlayback && console.log(`AudioManager: Triggering ${type} to play: `, audio.message.content.audio);
                  this.requestAudioControl("play", type, {
                    recordID: audio.message.recordID,
                    source: audio.message.content.audio,
                    styling,
                    speakerName,
                  });
                  this.pendingPlayback[type] = audio.message.content.audio;
                }
              }
            }
          });
    }

    updateMessageList(newMessages) {

        if (!this.initialized()) {
            this.messages = newMessages;
            return;
        }

        //
        // Ensure the right audio is playing
        //

        this.updateBackgroundMusic(newMessages);

        this.updateSpeechAndsoundEffectQueues(newMessages);

        this.updateAudioPlayqueues();
    }

    handleAudioStateChange(audioType, newState) {
        Constants.debug.logAudioPlayback && console.log("AudioManager: handleAudioStateChange ", audioType, newState);
        let newAudioState = {...this.audioState};
        let audioTypeState = newAudioState[audioType];
        audioTypeState.playState = newState;
        this.audioState = newAudioState;

        this.onAudioStateChange(newAudioState);

        if ((audioType == "speech" || audioType == "soundEffect") && newState == "playing") {
            // mark the current audio as played
            let queue = audioType == "speech" ? this.speechQueue : this.soundEffectQueue;
            for (let i = 0; i < queue.length; i++) {
                if (queue[i].state == 'unplayed' && this.pendingPlayback[audioType] === queue[i].message.content.audio) {
                Constants.debug.logAudioPlayback && console.log("AudioManager: Marked ", audioType, " played");
                this.pendingPlayback[audioType] = null;
                queue[i].state = 'played';
                break;
                }
            }
        }
        
        if ((audioType == "speech" || audioType == "soundEffect") && newState == "paused") {
            // reset pending playback when audio is paused
            this.pendingPlayback[audioType] = null;
        }

        this.updateAudioPlayqueues();
    }
 
    requestAudioControl(action, playerInstance, params) {
        Constants.debug.logAudioPlayback && console.log("requestAudioControl ", action, playerInstance, params )

        let newAudioState = {...this.audioState}; 

        if (action == "play") {
          const { recordID, source, speakerName, styling } = params;
          const sameSource = this.audioState[playerInstance].source == source;
          const sameRecord = this.audioState[playerInstance].recordID == recordID;
            
          if (!sameRecord) {

            newAudioState[playerInstance].source = source;
            newAudioState[playerInstance].recordID = recordID;

            if (playerInstance == "speech") {
                newAudioState[playerInstance].speakerName = speakerName;
                newAudioState[playerInstance].styling = styling;
            }
          }

          if (sameSource) {
        
                this.controller(playerInstance, "play");            
          }
        }
      
        if (action == "pause") {
            this.controller(playerInstance, "pause");
        }
      
        this.audioState = newAudioState;
        this.onAudioStateChange(newAudioState);
    }
}