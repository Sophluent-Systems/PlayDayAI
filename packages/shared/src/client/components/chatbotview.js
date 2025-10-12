import React, { useEffect, useMemo, useState } from "react";
import { getMostRecentMessageOfType } from "@src/common/messages";
import { MultimediaInput } from "./multimediainput";
import { AudioPlaybackControls } from "./audioplaybackcontrols";
import { PlayControls } from "./playcontrols";
import { MessagesDebugControls } from "./messagesdebugcontrols";
import { Loader2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

function SuggestionsToggle({ open, onToggle, accentColor }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/60 transition hover:text-white"
    >
      {open ? <ChevronDown className="h-4 w-4" style={{ color: accentColor }} /> : <ChevronUp className="h-4 w-4" style={{ color: accentColor }} />}
      {open ? 'Hide' : 'Show'}
    </button>
  );
}

export default function ChatBotView(props) {
  const {
    theme,
    title,
    versionString,
    messages,
    inputLength,
    onCardActionSelected,
    editMode,
    supportsSuggestions,
    waitingForInput,
    onSendMessage,
    supportedMediaTypes,
    supportedInputModes,
    conversational,
    autoSendAudioOnSpeechEnd = true,
    audioState,
    onAudioStateChange,
    onGetAudioController,
    processingUnderway,
    onRequestStateChange,
    sessionID,
    debugSettings,
    onDebugSingleStep,
    onToggleSingleStep,
    children,
  } = props;

  const [suggestions, setSuggestions] = useState(null);
  const [htmlForStatusBar, setHtmlForStatusBar] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);

  const accentColor = theme?.colors?.sendMessageButtonActiveColor || theme?.palette?.accent || "#38BDF8";

  useEffect(() => {
    if (!messages) {
      return;
    }

    let startingMessageIndex = getMostRecentMessageOfType(messages, ['user'], -1);
    startingMessageIndex = startingMessageIndex === -1 ? 0 : startingMessageIndex + 1;

    let nextSuggestions = null;
    for (let i = startingMessageIndex; i < messages.length; i++) {
      const message = messages[i];
      if (message?.data?.suggestions?.length) {
        nextSuggestions = message.data.suggestions;
        break;
      }
    }

    setSuggestions(nextSuggestions);

    const assistantIndex = getMostRecentMessageOfType(messages, ['assistant'], -1);
    if (assistantIndex >= 0) {
      setHtmlForStatusBar(messages[assistantIndex].statusBarMarkup || "");
    } else {
      setHtmlForStatusBar("");
    }
  }, [messages]);

  const handleDrawerToggle = () => setSuggestionsOpen((prev) => !prev);

  const renderSuggestions = useMemo(() => {
    if (!supportsSuggestions) {
      return null;
    }

    return (
      <div className="rounded-3xl border border-white/10 bg-white/5/10 p-5 shadow-inner backdrop-blur-lg">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
            <Sparkles className="h-4 w-4" style={{ color: accentColor }} />
            Suggested moves
          </div>
          <SuggestionsToggle open={suggestionsOpen} onToggle={handleDrawerToggle} accentColor={accentColor} />
        </div>

        {suggestionsOpen && (
          <div className="mt-4 space-y-2">
            {suggestions?.length ? (
              suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion}-${index}`}
                  type="button"
                  onClick={() =>
                    onCardActionSelected?.('suggestion', {
                      suggestion,
                    })
                  }
                  className={`w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-left text-sm font-medium text-white/90 transition ${waitingForInput ? 'hover:border-white/30 hover:bg-white/15' : 'opacity-60 cursor-not-allowed'}`}
                  disabled={!waitingForInput}
                >
                  {suggestion}
                </button>
              ))
            ) : (
              <div className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/60">
                {waitingForInput ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="text-xs uppercase tracking-[0.35em]">No suggestions provided</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }, [supportsSuggestions, suggestionsOpen, suggestions, waitingForInput, accentColor, onCardActionSelected]);

  return (
    <div
      className="relative flex h-full min-h-screen w-full flex-col overflow-hidden"
      style={{ backgroundColor: theme?.colors?.messagesAreaBackgroundColor || '#050B1B' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_55%)]" />

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/5 via-transparent to-white/5 opacity-20" />

          <div className="relative flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-5xl flex-col items-stretch px-4 pb-24 pt-10 sm:px-6 lg:px-8">
              <div className="mb-8 flex flex-col items-center gap-2 text-center">
                {title && (
                  <div
                    className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60"
                    style={{ fontFamily: theme?.fonts?.titleFont }}
                  >
                    {title}
                  </div>
                )}
                {versionString && (
                  <div className="text-[10px] uppercase tracking-[0.35em] text-white/40">{versionString}</div>
                )}
              </div>

              <div className="flex flex-col gap-6">{children}</div>
            </div>
          </div>

        </div>

        <div className="sticky bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-black/60 backdrop-blur-xl" style={{ pointerEvents: 'auto' }}>
          <div className={`mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8${editMode ? " sm:pr-24" : ""}`}>
            {htmlForStatusBar && (
              <div
                className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/80 shadow-inner"
                dangerouslySetInnerHTML={{ __html: htmlForStatusBar }}
              />
            )}

            {renderSuggestions}

            <AudioPlaybackControls
              audioState={audioState}
              onAudioStateChange={onAudioStateChange}
              onGetAudioController={onGetAudioController}
              theme={theme}
            />

            <MultimediaInput
              theme={theme}
              inputLength={inputLength}
              waitingForInput={waitingForInput}
              supportedMediaTypes={supportedMediaTypes}
              supportedInputModes={supportedInputModes}
              handleSendMessage={onSendMessage}
              sendAudioOnSpeechEnd={conversational || autoSendAudioOnSpeechEnd}
              debug={false}
            />
          </div>
        </div>
      </div>

      {editMode ? (
        <div
          className="fixed right-0 z-40"
          style={{ bottom: 'calc(1.5rem + 3.5rem)' }}
        >
            <MessagesDebugControls
              theme={theme}
              variant="floating"
              onDebugSingleStep={onDebugSingleStep}
              onToggleSingleStep={onToggleSingleStep}
            />
        </div>
      ) : null}

      <div className="pointer-events-none fixed bottom-6 right-0 z-30 sm:pointer-events-auto">
        <PlayControls
          isRunning={processingUnderway}
          onRequestStateChange={onRequestStateChange}
          sessionID={sessionID}
          theme={theme}
        />
      </div>
    </div>
  );
}

