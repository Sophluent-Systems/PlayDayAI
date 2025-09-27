import React, { useEffect, useMemo, useState, memo } from 'react';
import clsx from 'clsx';
import {
  Play,
  Pause,
  ThumbsUp,
  ThumbsDown,
  ClipboardList,
  Bot,
  TerminalSquare,
  RefreshCcw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { PrettyDate, PrettyElapsedTime } from '@src/common/date';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { ImageWithFallback } from './standard/imagewithfallback';
import { getMessageStyling } from '@src/client/themestyling';

function ChatBotTypingIndicator({ color }) {
  const [ellipsis, setEllipsis] = useState('.');

  useEffect(() => {
    const timer = setInterval(() => {
      setEllipsis((prev) => (prev.length < 4 ? prev + '.' : '.'));
    }, 300);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="text-sm font-semibold tracking-[0.3em]" style={{ color }}>
      {ellipsis}
    </span>
  );
}

function Spinner({ color }) {
  return (
    <div className="flex h-20 w-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color }} />
    </div>
  );
}

export const ChatCard = memo((props) => {
  const {
    message,
    deleteAllowed,
    editMode,
    waitingForProcessingToComplete,
    onDelete,
    onCardActionSelected,
    theme,
    responseFeedbackMode,
    sessionID,
    onRequestAudioControl,
    playbackState,
  } = props;

  const {
    content,
    recordID,
    nodeAttributes,
    executionTime,
    persona,
    ratings,
    processing,
    state,
    completionTime,
    error,
    instanceName,
    nodeType,
    codeLogs,
    hideOutput,
  } = message;

  const mediaTypes = nodeAttributes?.mediaTypes || [];
  const hidden = hideOutput || persona?.hideFromEndUsers;
  const isAIResponse = nodeAttributes?.isAIResponse;
  const codeExecutionResult = nodeAttributes?.codeExecutionResult;
  const canRateResponse = Boolean(isAIResponse);
  const canDebugRecord = canRateResponse || Boolean(codeExecutionResult);

  const [styling, setStyling] = useState(null);
  const [PersonaIcon, setPersonaIcon] = useState(null);

  useEffect(() => {
    if (!theme) {
      return;
    }
    const personaForStyling = persona ?? {
      displayName: 'System',
      theme: {
        colors: theme.colors || {},
        fonts: theme.fonts || {},
        icon: theme.icon || { iconID: 'Person', color: theme.colors?.chatbotMessageTextColor },
      },
    };
    const nextStyling = getMessageStyling(mediaTypes, personaForStyling);
    setStyling(nextStyling);
    setPersonaIcon(nextStyling.icon || null);
  }, [persona, theme, mediaTypes]);

  const palette = useMemo(() => {
    const baseColors = theme?.colors ?? {};
    return {
      border: 'rgba(148, 163, 184, 0.25)',
      shadow: '0 30px 60px -35px rgba(15, 23, 42, 0.65)',
      text: styling?.color ?? baseColors.chatbotMessageTextColor ?? '#e2e8f0',
      background:
        styling?.backgroundColor ?? baseColors.chatbotMessageBackgroundColor ?? 'rgba(15, 23, 42, 0.75)',
      accent: styling?.buttonColor ?? baseColors.sendMessageButtonActiveColor ?? '#38bdf8',
    };
  }, [styling, theme]);

  const personaLabel = useMemo(() => {
    if (persona?.displayName) {
      return persona.displayName;
    }
    if (!nullUndefinedOrEmpty(instanceName)) {
      return instanceName;
    }
    if (!nullUndefinedOrEmpty(nodeType)) {
      return nodeType;
    }
    return recordID ? 'Rec ' + recordID : 'Assistant';
  }, [persona, instanceName, nodeType, recordID]);

  const renderResponseRatings = (isPlayerRating) => {
    let mode =
      canRateResponse && isPlayerRating ? responseFeedbackMode?.user : responseFeedbackMode?.admin;
    let textHint = isPlayerRating ? null : 'Admin rating';

    if (editMode && canRateResponse) {
      if (isPlayerRating) {
        mode = null;
      } else {
        mode = 'edit';
        textHint = 'Admin rating';
      }
    }

    if (!mode) {
      return null;
    }

    const isReadOnly = mode === 'readonly';
    const ratingValue = isPlayerRating ? ratings?.playerRating : ratings?.adminRating;
    const ratingExists = typeof ratingValue !== 'undefined';

    const thumbsUpTint = ratingExists && ratingValue > 0 ? 'bg-emerald-500/60 text-emerald-950' : 'bg-white/10 text-white';
    const thumbsDownTint = ratingExists && ratingValue <= 0 ? 'bg-rose-500/60 text-rose-950' : 'bg-white/10 text-white';

    return (
      <div className="flex items-center gap-2">
        {textHint && <span className="text-[10px] uppercase tracking-[0.35em] text-white/60">{textHint}</span>}
        <button
          type="button"
          disabled={isReadOnly}
          onClick={() =>
            onCardActionSelected?.('responseFeedback', {
              recordID,
              isPlayerRating,
              rating: -1,
            })
          }
          className={clsx(
            'flex h-8 w-8 items-center justify-center rounded-full border border-white/15 transition',
            thumbsDownTint,
            !isReadOnly && 'hover:border-white/40 hover:bg-white/20 hover:text-white',
            isReadOnly && 'opacity-60'
          )}
        >
          <ThumbsDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={isReadOnly}
          onClick={() =>
            onCardActionSelected?.('responseFeedback', {
              recordID,
              isPlayerRating,
              rating: 1,
            })
          }
          className={clsx(
            'flex h-8 w-8 items-center justify-center rounded-full border border-white/15 transition',
            thumbsUpTint,
            !isReadOnly && 'hover:border-white/40 hover:bg-white/20 hover:text-white',
            isReadOnly && 'opacity-60'
          )}
        >
          <ThumbsUp className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const renderMarkup = (key, markupText) => (
    <div
      key={key}
      className="space-y-2 text-sm leading-relaxed"
      style={{ fontFamily: styling?.fontFamily, color: palette.text }}
    >
      <ReactMarkdown>{markupText}</ReactMarkdown>
    </div>
  );

  const renderText = (key, text) => (
    <p
      key={key}
      className="whitespace-pre-wrap text-sm"
      style={{ fontFamily: styling?.fontFamily, color: palette.text }}
    >
      {text}
    </p>
  );

  const renderSpinner = (key) => <Spinner key={key} color={palette.text} />;
  const renderTyping = (key) => <ChatBotTypingIndicator key={key} color={palette.text} />;

  const handleAudioToggle = (data) => {
    const audioType = data.audioType || 'speech';
    const activeState = playbackState?.[audioType];

    const playingThisMessage =
      activeState?.playState === 'playing' && activeState?.recordID === recordID;

    if (playingThisMessage) {
      onRequestAudioControl?.('pause', audioType);
    } else {
      onRequestAudioControl?.('play', audioType, {
        recordID,
        source: data,
        speakerName: persona?.displayName,
        styling,
      });
    }
  };

  const renderMessage = () => {
    const result = [];

    if (state === 'failed' && error) {
      const errorText = **: **\n\n;
      result.push(renderMarkup('error', errorText));
      return result;
    }

    if (processing && nullUndefinedOrEmpty(content)) {
      if (Array.isArray(mediaTypes)) {
        mediaTypes.forEach((type, index) => {
          if (type === 'image' || type === 'audio') {
            result.push(renderSpinner(${type}-));
          } else if (type === 'text') {
            result.push(renderTyping(${type}-));
          }
        });
      }
      return result;
    }

    if (!nullUndefinedOrEmpty(content)) {
      Object.entries(content).forEach(([mediaType, data], index) => {
        if (mediaType === 'image') {
          if (nullUndefinedOrEmpty(data) && processing) {
            result.push(renderSpinner(image-));
          } else {
            result.push(
              <ImageWithFallback
                key={image-}
                primary={data}
                fallback={https://playday.ai}
                alt="Generated image"
                className="max-h-[600px] w-full max-w-3xl rounded-2xl object-contain shadow-soft"
              />,
            );
          }
        } else if (mediaType === 'audio') {
          if (nullUndefinedOrEmpty(data) && processing) {
            result.push(renderSpinner(udio-));
          } else {
            const audioType = data.audioType || 'speech';
            const activeState = playbackState?.[audioType];
            const playingThisMessage =
              activeState?.playState === 'playing' && activeState?.recordID === recordID;

            result.push(
              <button
                key={udio-}
                type="button"
                onClick={() => handleAudioToggle(data)}
                className={clsx(
                  'group flex h-12 w-12 items-center justify-center rounded-full border border-white/20 transition',
                  playingThisMessage
                    ? 'bg-white text-slate-900'
                    : 'bg-white/10 text-white hover:bg-white/20'
                )}
                aria-label={playingThisMessage ? 'Pause audio' : 'Play audio'}
              >
                {playingThisMessage ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>,
            );
          }
        } else if (mediaType === 'text') {
          if (nullUndefinedOrEmpty(data) && processing) {
            result.push(renderTyping(	ext-));
          } else {
            result.push(renderMarkup(	ext-, data));
          }
        } else if (mediaType === 'data') {
          if (nullUndefinedOrEmpty(data) && processing) {
            result.push(renderSpinner(data-));
          } else {
            result.push(renderText(data-, JSON.stringify(data, null, 2)));
          }
        } else {
          if (nullUndefinedOrEmpty(data) && processing) {
            result.push(renderSpinner(misc-));
          } else {
            result.push(renderText(misc-, JSON.stringify(data ?? 'null')));
          }
        }
      });

      return result;
    }

    result.push(renderText('empty', 'The server response was empty'));
    return result;
  };

  if (!styling || state === 'waitingForExternalInput') {
    return null;
  }

  if (hidden && !editMode) {
    return null;
  }

  const PersonaGlyph = PersonaIcon;
  const showAdminActions = editMode && canDebugRecord && !processing && onCardActionSelected;

  return (
    <div className="flex w-full justify-center px-2 py-2">
      <div
        className="w-full max-w-4xl rounded-3xl border bg-black/20 p-6 shadow-xl backdrop-blur"
        style={{
          backgroundColor: palette.background,
          borderColor: palette.border,
          boxShadow: palette.shadow,
        }}
      >
        <header className="flex flex-col gap-3 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                {PersonaGlyph ? (
                  <PersonaGlyph className="h-6 w-6" style={{ color: styling.iconColor }} />
                ) : (
                  <Bot className="h-6 w-6" />
                )}
              </div>
              <div className="leading-tight">
                <div className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                  {personaLabel}
                </div>
                <div className="text-[11px] uppercase tracking-[0.3em] text-white/40">{PrettyDate(completionTime)}</div>
              </div>
            </div>

            {showAdminActions && (
              <div className="flex items-center gap-2">
                {executionTime && (
                  <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/60">
                    Exec {PrettyElapsedTime(executionTime)}
                  </span>
                )}
                {codeLogs && (
                  <button
                    type="button"
                    onClick={() =>
                      onCardActionSelected?.('codeLogs', {
                        recordID,
                      })
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:border-white/40 hover:bg-white/20"
                    aria-label="View code logs"
                  >
                    <TerminalSquare className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    onCardActionSelected?.('showRecordResultFields', {
                      recordID,
                      label: isAIResponse ? 'RAW PROMPT' : 'CONSOLE LOGS',
                      fields: isAIResponse ? 'context.prompt' : 'context.consoleLogs',
                    })
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:border-white/40 hover:bg-white/20"
                  aria-label="View record context"
                >
                  <ClipboardList className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onCardActionSelected?.('showRecordResultFields', {
                      recordID,
                      label: 'OUTPUT',
                      fields: isAIResponse ? 'context.rawResponse' : 'output',
                    })
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:border-white/40 hover:bg-white/20"
                  aria-label="View output JSON"
                >
                  <Bot className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {editMode && !nullUndefinedOrEmpty(instanceName) && (
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/40">
              {nodeType ? ${nodeType} ·  : instanceName}
            </div>
          )}
        </header>

        <div className="flex flex-col gap-4">
          {renderMessage()}
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 text-white/70">
          {canRateResponse ? (
            <div className="flex flex-1 flex-wrap items-center gap-3">
              {renderResponseRatings(true)}
              {renderResponseRatings(false)}
            </div>
          ) : (
            <span className="text-[10px] uppercase tracking-[0.35em]">Session {sessionID}</span>
          )}

          {(state === 'failed' || editMode) && (
            <button
              type="button"
              disabled={waitingForProcessingToComplete || !deleteAllowed}
              onClick={onDelete}
              className={clsx(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] transition',
                state === 'failed'
                  ? 'border-rose-500/60 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30'
                  : 'border-white/10 bg-white/10 text-white hover:border-white/30 hover:bg-white/20',
                (waitingForProcessingToComplete || !deleteAllowed) && 'cursor-not-allowed opacity-50'
              )}
            >
              {state === 'failed' ? <AlertTriangle className="h-4 w-4" /> : <RefreshCcw className="h-4 w-4" />}
              {state === 'failed' ? 'Retry' : 'Restart'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
});




