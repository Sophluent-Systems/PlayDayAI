import React, { useEffect, useMemo, useState, memo } from "react";
import clsx from "clsx";
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
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { PrettyDate, PrettyElapsedTime } from "@src/common/date";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { ImageWithFallback } from "./standard/imagewithfallback";
import { getMessageStyling } from "@src/client/themestyling";

function ChatBotTypingIndicator({ color }) {
  const [ellipsis, setEllipsis] = useState(".");

  useEffect(() => {
    const timer = setInterval(() => {
      setEllipsis((prev) => (prev.length < 4 ? `${prev}.` : "."));
    }, 320);
    return () => clearInterval(timer);
  }, []);

  return (
    <span
      className="text-xs font-semibold tracking-[0.4em] text-white/80"
      style={{ color }}
    >
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

const markdownComponents = {
  p: ({ children }) => <p className="leading-relaxed text-sm text-white/90">{children}</p>,
  ul: ({ children }) => (
    <ul className="ml-5 list-disc space-y-1 text-sm leading-relaxed text-white/80">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="ml-5 list-decimal space-y-1 text-sm leading-relaxed text-white/80">{children}</ol>
  ),
  code: ({ inline, children }) => (
    inline ? (
      <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px] text-white/90">{children}</code>
    ) : (
      <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-xs text-white/90 shadow-inner">
        <code>{children}</code>
      </pre>
    )
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-sky-300 underline decoration-sky-500/60 underline-offset-4"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
};

const extractColorToken = (value) => {
  if (!value) {
    return null;
  }
  const match = `${value}`.match(/(rgba?\([^)]*\)|#(?:[0-9a-fA-F]{3}){1,2})/g);
  if (match && match.length) {
    return match[match.length - 1];
  }
  return value;
};

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

  // DEBUG: Log text content when it changes
  useEffect(() => {
    if (content && content.text) {
      console.log('[ChatCard DEBUG] Text content changed for recordID:', recordID);
      console.log('[ChatCard DEBUG] Text length:', content.text?.length);
      console.log('[ChatCard DEBUG] Text value:', JSON.stringify(content.text));
      console.log('[ChatCard DEBUG] Text preview (first 200 chars):', content.text.substring(0, 200));
      console.log('[ChatCard DEBUG] Processing status:', processing);
    }
  }, [content, recordID, processing]);

  // DEBUG: Log ratings when they change
  useEffect(() => {
    console.log('[ChatCard DEBUG] Ratings changed for recordID:', recordID);
    console.log('[ChatCard DEBUG] Ratings value:', JSON.stringify(ratings));
  }, [ratings, recordID]);

  const mediaTypes = nodeAttributes?.mediaTypes || [];
  const hidden = hideOutput || persona?.hideFromEndUsers;
  const isAIResponse = nodeAttributes?.isAIResponse;
  const canRateResponse = Boolean(isAIResponse);
  const canDebugRecord = canRateResponse || Boolean(nodeAttributes?.codeExecutionResult);
  const borderToken = extractColorToken(theme?.tokens?.border?.subtle);

  const personaForStyling = useMemo(() => {
    if (persona) {
      return persona;
    }
    const fallbackColors = theme?.colors || {};
    return {
      displayName: "System",
      hideFromEndUsers: false,
      theme: {
        colors: {
          messageBackgroundColor: fallbackColors.chatbotMessageBackgroundColor || "rgba(15,23,42,0.75)",
          messageTextColor: fallbackColors.chatbotMessageTextColor || "#E2E8F0",
          buttonColor: fallbackColors.sendMessageButtonActiveColor || "#38BDF8",
          audioVisualizationColor: fallbackColors.sendMessageButtonActiveColor || "#38BDF8",
          borderColor: borderToken || "rgba(148,163,184,0.35)",
        },
        fonts: {
          fontFamily: theme?.fonts?.fontFamily || '"Inter", sans-serif',
        },
        icon: {
          iconID: "Person",
          color: fallbackColors.sendMessageButtonActiveColor || "#38BDF8",
        },
      },
    };
  }, [persona, theme, borderToken]);

  const styling = useMemo(
    () => getMessageStyling(mediaTypes, personaForStyling),
    [mediaTypes, personaForStyling],
  );

  const palette = useMemo(() => {
    const fallback = theme?.colors || {};
    const borderColor = styling?.borderColor || borderToken || 'rgba(148,163,184,0.25)';
    return {
      border: borderColor,
      text: styling?.color || fallback.chatbotMessageTextColor || '#E2E8F0',
      background: styling?.backgroundColor || fallback.chatbotMessageBackgroundColor || 'rgba(15,23,42,0.75)',
      accent: styling?.accent || fallback.sendMessageButtonActiveColor || '#38BDF8',
      overlay: styling?.overlayTint || 'rgba(15,23,42,0.55)',
      glow: styling?.glowColor || theme?.effects?.accentGlow || 'rgba(56,189,248,0.45)',
      shadow: theme?.effects?.cardShadow || '0 30px 60px -35px rgba(15,23,42,0.65)',
    };
  }, [styling, theme, borderToken]);

  const personaLabel = useMemo(() => {
    if (persona?.displayName) return persona.displayName;
    if (!nullUndefinedOrEmpty(instanceName)) return instanceName;
    if (!nullUndefinedOrEmpty(nodeType)) return nodeType;
    return recordID ? `Rec ${recordID}` : 'Assistant';
  }, [persona, instanceName, nodeType, recordID]);

  const PersonaGlyph = styling?.icon || Bot;

  const handleAudioToggle = (data) => {
    const audioType = data.audioType || 'speech';
    const activeState = playbackState?.[audioType];
    const playingThisMessage = activeState?.playState === 'playing' && activeState?.recordID === recordID;

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

  const renderResponseRatings = (isPlayerRating) => {
    let mode =
      canRateResponse && isPlayerRating ? responseFeedbackMode?.user : responseFeedbackMode?.admin;
    let textHint = isPlayerRating ? null : 'Admin rating';

    console.log('[renderResponseRatings DEBUG] Initial mode:', mode, 'editMode:', editMode, 'canRateResponse:', canRateResponse);

    if (editMode && canRateResponse) {
      if (isPlayerRating) {
        mode = null;
      } else {
        mode = 'edit';
        textHint = 'Admin rating';
      }
    }

    console.log('[renderResponseRatings DEBUG] Final mode:', mode);

    if (!mode) {
      return null;
    }

    const isReadOnly = mode === 'readonly';
    const ratingValue = isPlayerRating ? ratings?.playerRating : ratings?.adminRating;
    const ratingExists = typeof ratingValue !== 'undefined';

    const thumbsDownTint = ratingExists && ratingValue <= 0;
    const thumbsUpTint = ratingExists && ratingValue > 0;

    // DEBUG: Log rating button state
    console.log('[renderResponseRatings DEBUG] isPlayerRating:', isPlayerRating, 'recordID:', recordID);
    console.log('[renderResponseRatings DEBUG] ratings object:', JSON.stringify(ratings));
    console.log('[renderResponseRatings DEBUG] ratingValue:', ratingValue, 'ratingExists:', ratingExists);
    console.log('[renderResponseRatings DEBUG] thumbsDownTint:', thumbsDownTint, 'thumbsUpTint:', thumbsUpTint);

    return (
      <div className="flex items-center gap-2">
        {textHint && (
          <span className="text-[10px] uppercase tracking-[0.35em] text-white/60">{textHint}</span>
        )}
        <button
          type="button"
          disabled={isReadOnly}
          onClick={() =>
            onCardActionSelected?.('responseFeedback', {
              message,
              recordID,
              isPlayerRating,
              rating: -1,
            })
          }
          className={clsx(
            'flex h-8 w-8 items-center justify-center rounded-full border transition',
            !thumbsDownTint && 'border-white/15 bg-white/5 text-white/80 hover:border-white/40 hover:bg-white/15 hover:text-white',
            thumbsDownTint && 'border-rose-400/60 bg-rose-500/70 text-rose-950 hover:bg-rose-600/80',
            isReadOnly && 'cursor-not-allowed opacity-60',
          )}
          aria-label="Rate response thumbs down"
        >
          <ThumbsDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={isReadOnly}
          onClick={() =>
            onCardActionSelected?.('responseFeedback', {
              message,
              recordID,
              isPlayerRating,
              rating: 1,
            })
          }
          className={clsx(
            'flex h-8 w-8 items-center justify-center rounded-full border transition',
            !thumbsUpTint && 'border-white/15 bg-white/5 text-white/80 hover:border-white/40 hover:bg-white/15 hover:text-white',
            thumbsUpTint && 'border-emerald-400/70 bg-emerald-500/70 text-emerald-950 hover:bg-emerald-600/80',
            isReadOnly && 'cursor-not-allowed opacity-60',
          )}
          aria-label="Rate response thumbs up"
        >
          <ThumbsUp className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const renderMarkup = (key, markupText) => (
    <div
      key={key}
      className="space-y-3 text-sm leading-relaxed"
      style={{ fontFamily: styling?.fontFamily, color: palette.text }}
    >
      <ReactMarkdown components={markdownComponents}>{markupText}</ReactMarkdown>
    </div>
  );

  const renderText = (key, text) => (
    <p
      key={key}
      className="whitespace-pre-wrap text-sm leading-relaxed"
      style={{ fontFamily: styling?.fontFamily, color: palette.text }}
    >
      {text}
    </p>
  );

  const renderSpinner = (key) => <Spinner key={key} color={palette.text} />;
  const renderTyping = (key) => <ChatBotTypingIndicator key={key} color={palette.text} />;

  const renderMessage = () => {
    const result = [];

    if (state === 'failed' && error) {
      result.push(
        <div
          key="error"
          className="rounded-2xl border border-rose-500/50 bg-rose-500/10 p-5 text-sm text-rose-100 shadow-inner"
        >
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-rose-200/80">
            <AlertTriangle className="h-4 w-4" /> Execution error
          </div>
          <ReactMarkdown components={markdownComponents}>{`${error}`}</ReactMarkdown>
        </div>,
      );
      return result;
    }

    if (processing && nullUndefinedOrEmpty(content)) {
      if (Array.isArray(mediaTypes) && mediaTypes.length) {
        mediaTypes.forEach((type, index) => {
          if (type === 'image' || type === 'audio') {
            result.push(renderSpinner(`${type}-${index}`));
          } else if (type === 'text') {
            result.push(renderTyping(`${type}-${index}`));
          } else {
            result.push(renderSpinner(`${type}-${index}`));
          }
        });
      } else {
        result.push(renderTyping('typing-default'));
      }
      return result;
    }

    if (!nullUndefinedOrEmpty(content)) {
      Object.entries(content).forEach(([mediaType, data], index) => {
        const key = `${mediaType}-${index}`;
        if (mediaType === 'image') {
          if (nullUndefinedOrEmpty(data) && processing) {
            result.push(renderSpinner(`${key}-spinner`));
          } else if (!nullUndefinedOrEmpty(data)) {
            result.push(
              <div key={key} className="flex w-full justify-center">
                <ImageWithFallback
                  primary={data}
                  fallback="https://playday.ai"
                  alt="Generated image"
                  className="max-h-[580px] w-full max-w-3xl rounded-3xl border border-white/10 object-contain shadow-[var(--image-shadow,0_25px_90px_-45px_rgba(15,23,42,0.65))]"
                />
              </div>,
            );
          }
        } else if (mediaType === 'audio') {
          if (nullUndefinedOrEmpty(data) && processing) {
            result.push(renderSpinner(`${key}-spinner`));
          } else if (data) {
            const audioType = data.audioType || 'speech';
            const activeState = playbackState?.[audioType];
            const playingThisMessage =
              activeState?.playState === 'playing' && activeState?.recordID === recordID;

            result.push(
              <button
                key={key}
                type="button"
                onClick={() => handleAudioToggle(data)}
                className={clsx(
                  'group flex h-12 w-12 items-center justify-center rounded-full border transition',
                  playingThisMessage
                    ? 'border-transparent bg-white text-slate-900'
                    : 'border-white/25 bg-white/10 text-white hover:border-white/40 hover:bg-white/20',
                )}
                aria-label={playingThisMessage ? 'Pause audio' : 'Play audio'}
              >
                {playingThisMessage ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>,
            );
          }
        } else if (mediaType === 'text') {
          if (nullUndefinedOrEmpty(data) && processing) {
            result.push(renderTyping(`${key}-typing`));
          } else {
            result.push(renderMarkup(key, data));
          }
        } else if (mediaType === 'data') {
          if (nullUndefinedOrEmpty(data) && processing) {
            result.push(renderSpinner(`${key}-spinner`));
          } else {
            result.push(renderText(key, JSON.stringify(data, null, 2)));
          }
        } else {
          if (nullUndefinedOrEmpty(data) && processing) {
            result.push(renderSpinner(`${key}-spinner`));
          } else {
            result.push(renderText(key, JSON.stringify(data ?? 'null')));
          }
        }
      });

      return result;
    }

    result.push(renderText('empty', 'The server response was empty'));
    return result;
  };

  if (hidden && !editMode) {
    return null;
  }

  if (state === 'waitingForExternalInput') {
    return null;
  }

  return (
    <div className="flex w-full justify-center px-3 py-4">
      <article
        className="relative w-full max-w-4xl overflow-hidden rounded-[30px] border bg-black/30 p-6 shadow-xl backdrop-blur-xl"
        style={{
          backgroundColor: palette.background,
          borderColor: palette.border,
          boxShadow: palette.shadow,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{ backgroundImage: theme?.gradients?.card }}
        />

        <header className="flex flex-col gap-4 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white shadow-inner">
                {PersonaGlyph ? (
                  <PersonaGlyph className="h-6 w-6" style={{ color: styling?.iconColor || palette.accent }} />
                ) : (
                  <Bot className="h-6 w-6" />
                )}
              </div>
              <div className="leading-tight">
                <div className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                  {personaLabel}
                </div>
                <div className="text-[11px] uppercase tracking-[0.3em] text-white/40">
                  {PrettyDate(completionTime)}
                </div>
              </div>
            </div>

            {editMode && canDebugRecord && !processing && onCardActionSelected && (
              <div className="flex items-center gap-2">
                {executionTime && (
                  <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/60">
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
                    className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:border-white/40 hover:bg-white/20"
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
                  className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:border-white/40 hover:bg-white/20"
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
                  className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:border-white/40 hover:bg-white/20"
                  aria-label="View output JSON"
                >
                  <Bot className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {editMode && !nullUndefinedOrEmpty(instanceName) && (
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/40">
              {nodeType ? `${nodeType} - ${instanceName}` : instanceName}
            </div>
          )}
        </header>

        <div className="flex flex-col gap-4" style={{ color: palette.text }}>
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
                'inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition',
                state === 'failed'
                  ? 'border-rose-500/60 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30'
                  : 'border-white/15 bg-white/10 text-white hover:border-white/30 hover:bg-white/20',
                (waitingForProcessingToComplete || !deleteAllowed) && 'cursor-not-allowed opacity-50',
              )}
              aria-label={state === 'failed' ? 'Retry message' : 'Run message again'}
            >
              {state === 'failed' ? <AlertTriangle className="h-4 w-4" /> : <RefreshCcw className="h-4 w-4" />}
              {state === 'failed' && 'Retry'}
            </button>
          )}
        </footer>
      </article>
    </div>
  );
});
