import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { MessagesContainer } from './messagescontainer';
import { useConfig } from '@src/client/configprovider';
import { getMostRecentMessageOfType } from '@src/common/messages';
import { RawHTMLBox } from './standard/rawhtmlbox';
import { MultimediaInput } from './multimediainput';
import { AudioPlaybackControls } from './audioplaybackcontrols';
import { PlayControls } from './playcontrols';
import { MessagesDebugControls } from './messagesdebugcontrols';

function ChatBotView(props) {
  const { Constants } = useConfig();
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
    conversational,
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

  const paletteVars = useMemo(() => ({
    '--pd-messages-bg': theme?.colors?.messagesAreaBackgroundColor ?? '#0b1120',
    '--pd-input-bg': theme?.colors?.inputAreaBackgroundColor ?? '#0f172a',
    '--pd-input-surface': theme?.colors?.inputAreaTextEntryBackgroundColor ?? '#1f2937',
    '--pd-text-primary': theme?.colors?.inputTextEnabledColor ?? '#e2e8f0',
    '--pd-text-muted': theme?.colors?.inputTextDisabledColor ?? '#94a3b8',
    '--pd-info-text': theme?.colors?.inputAreaInformationTextColor ?? '#cbd5f5',
    '--pd-suggestion-bg': theme?.colors?.suggestionsButtonColor ?? '#1f2937',
    '--pd-suggestion-hover-bg': theme?.colors?.suggestionsButtonHoverColor ?? '#334155',
    '--pd-suggestion-text': theme?.colors?.suggestionsButtonTextColor ?? '#f8fafc',
    '--pd-suggestion-hover-text':
      theme?.colors?.suggestionsButtonHoverTextColor ?? '#0f172a',
    '--pd-highlight': theme?.colors?.sendMessageButtonActiveColor ?? '#38bdf8',
    '--pd-highlight-hover':
      theme?.colors?.sendMessageButtonActiveHoverColor ?? '#0ea5e9',
  }), [theme]);

  const [suggestions, setSuggestions] = useState(null);
  const [htmlForStatusBar, setHtmlForStatusBar] = useState('');
  const [messageAreaHeight, setMessageAreaHeight] = useState(0);
  const [suggestionsDrawerOpen, setSuggestionsDrawerOpen] = useState(true);
  const inputAreaRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const updateMessageAreaHeight = () => {
      if (inputAreaRef.current && containerRef.current) {
        const containerHeight = containerRef.current.offsetHeight;
        const inputAreaHeight = inputAreaRef.current.offsetHeight;
        const newMessageAreaHeight = Math.max(containerHeight - inputAreaHeight - 1, 0);
        if (messageAreaHeight !== newMessageAreaHeight) {
          setMessageAreaHeight(newMessageAreaHeight);
        }
      }
    };

    updateMessageAreaHeight();

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(updateMessageAreaHeight);
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateMessageAreaHeight);

    return () => {
      window.removeEventListener('resize', updateMessageAreaHeight);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [messageAreaHeight]);

  useEffect(() => {
    if (!messages) {
      return;
    }

    if (Constants?.debug?.logSuggestions) {
      console.log('SUGGESTIONS: messages: ', messages);
    }

    let startingMessageIndex = getMostRecentMessageOfType(messages, ['user'], -1);
    if (startingMessageIndex === -1) {
      startingMessageIndex = 0;
    } else {
      startingMessageIndex += 1;
    }

    let newSuggestions = null;
    for (let i = startingMessageIndex; i < messages.length; i++) {
      const message = messages[i];
      if (message.data?.suggestions?.length > 0) {
        newSuggestions = message.data.suggestions;
        break;
      }
    }

    setSuggestions(newSuggestions);

    const mostRecentAssistantIndex = getMostRecentMessageOfType(messages, ['assistant'], -1);
    if (mostRecentAssistantIndex >= 0) {
      const statusBarMarkup = messages[mostRecentAssistantIndex].statusBarMarkup;
      setHtmlForStatusBar(statusBarMarkup || '');
    }
  }, [messages, Constants?.debug?.logSuggestions]);

  const handleDrawerToggle = () => {
    setSuggestionsDrawerOpen((prev) => !prev);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full flex-col gap-6 overflow-hidden bg-[color:var(--pd-messages-bg)]/60 p-4 sm:p-6"
      style={{
        ...paletteVars,
        backgroundImage:
          'radial-gradient(circle at 16% 20%, rgba(255,255,255,0.06), transparent 55%), radial-gradient(circle at 84% 0%, rgba(255,255,255,0.04), transparent 45%)',
      }}
    >
      <div
        className="relative flex-1 overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--pd-messages-bg)]/90 shadow-soft backdrop-blur-sm"
        style={{ minHeight: messageAreaHeight || undefined }}
      >
        <MessagesContainer theme={theme} title={title} footer={versionString} editMode={editMode}>
          {children}
        </MessagesContainer>

        {editMode && (
          <MessagesDebugControls
            debugSettings={debugSettings}
            theme={theme}
            onDebugSingleStep={onDebugSingleStep}
            onToggleSingleStep={onToggleSingleStep}
          />
        )}
        <PlayControls
          isRunning={processingUnderway}
          onRequestStateChange={onRequestStateChange}
          sessionID={sessionID}
        />
      </div>

      <div
        ref={inputAreaRef}
        className="flex w-full flex-col gap-5 rounded-3xl border border-white/10 bg-[color:var(--pd-input-bg)]/85 p-6 shadow-glow backdrop-blur"
      >
        <RawHTMLBox
          className="max-h-32 w-full overflow-auto text-sm text-[color:var(--pd-text-muted)]"
          html={htmlForStatusBar}
        />

        {supportsSuggestions && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--pd-text-primary)]">
                <Sparkles className="h-4 w-4 text-[color:var(--pd-highlight)]" />
                Optional suggestions
              </div>
              <button
                type="button"
                onClick={handleDrawerToggle}
                className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--pd-text-muted)] transition hover:bg-white/10"
              >
                {suggestionsDrawerOpen ? 'Hide' : 'Show'}
                {suggestionsDrawerOpen ? (
                  <ChevronUp className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
                ) : (
                  <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                )}
              </button>
            </div>

            {suggestionsDrawerOpen && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {suggestions ? (
                  suggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion}-${index}`}
                      type="button"
                      onClick={() => onCardActionSelected('suggestion', { suggestion })}
                      className="group flex w-full items-start gap-3 rounded-xl border border-white/10 bg-[color:var(--pd-suggestion-bg)]/90 px-4 py-3 text-left text-sm font-medium text-[color:var(--pd-suggestion-text)] transition hover:border-[color:var(--pd-highlight)]/50 hover:bg-[color:var(--pd-suggestion-hover-bg)] hover:text-[color:var(--pd-suggestion-hover-text)]"
                    >
                      <span className="min-h-10 flex-1 leading-relaxed">{suggestion}</span>
                    </button>
                  ))
                ) : (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-white/15 px-4 py-8 text-sm text-[color:var(--pd-text-muted)]">
                    {waitingForInput ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Preparing suggestions
                      </span>
                    ) : (
                      'No suggestions provided for this turn.'
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
          handleSendMessage={onSendMessage}
          sendAudioOnSpeechEnd={conversational}
          debug={false}
        />
      </div>
    </div>
  );
}

export default ChatBotView;

