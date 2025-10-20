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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { PrettyDate, PrettyElapsedTime } from "@src/common/date";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { ImageWithFallback } from "./standard/imagewithfallback";
import { getMessageStyling } from "@src/client/themestyling";
import { buildAssetUrl } from "@src/client/utils/assetUrl";

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

const formatErrorMessage = (error) => {
  if (!error) {
    return '';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (Array.isArray(error)) {
    return error.map((item) => formatErrorMessage(item)).filter(Boolean).join('\n\n');
  }
  if (error instanceof Error) {
    return error.stack || error.message || `${error}`;
  }
  if (typeof error === 'object') {
    const { code, status, statusCode, message, error: nestedError, reason, description, detail } = error;
    const primaryMessage =
      message ||
      reason ||
      description ||
      detail ||
      (typeof nestedError === 'string' ? nestedError : undefined);

    if (primaryMessage) {
      const identifier = code || statusCode || status;
      return identifier ? `${identifier}: ${primaryMessage}` : primaryMessage;
    }

    if (nestedError) {
      return formatErrorMessage(nestedError);
    }

    try {
      return `\`\`\`json\n${JSON.stringify(error, null, 2)}\n\`\`\``;
    } catch (serializationError) {
      // fall through to string conversion below
    }
  }
  return String(error);
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
    depth = 0,
    isComponentRoot: isComponentRootOverride = false,
    hasChildren = false,
    collapsed = false,
    onToggleCollapsed,
    descendantCount = 0,
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
    isComponentRoot: messageIsComponentRoot = false,
    component: componentMeta,
  } = message;

  const effectiveIsComponentRoot = isComponentRootOverride || messageIsComponentRoot;
  const indentStyle = depth > 0 ? { marginLeft: depth * 24 } : undefined;
  const collapseToggleAvailable =
    effectiveIsComponentRoot && hasChildren && typeof onToggleCollapsed === "function";
  const componentStepsLabel = effectiveIsComponentRoot
    ? descendantCount > 0
      ? `${descendantCount} ${descendantCount === 1 ? "step" : "steps"}${collapsed ? " • Collapsed" : ""}`
      : collapsed
        ? "Collapsed"
        : null
    : null;

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
    if (effectiveIsComponentRoot && componentMeta?.name) return componentMeta.name;
    if (persona?.displayName) return persona.displayName;
    if (!nullUndefinedOrEmpty(instanceName)) return instanceName;
    if (!nullUndefinedOrEmpty(nodeType)) return nodeType;
    return recordID ? `Rec ${recordID}` : 'Assistant';
  }, [effectiveIsComponentRoot, componentMeta?.name, persona, instanceName, nodeType, recordID]);

  const PersonaGlyph = styling?.icon || Bot;

  const handleAudioToggle = (data) => {
    const audioType = data.audioType || 'speech';
    const activeState = playbackState?.[audioType];
    const playingThisMessage = activeState?.playState === 'playing' && activeState?.recordID === recordID;

    if (playingThisMessage) {
      onRequestAudioControl?.('pause', audioType);
    } else {
      // Transform generated audio URLs to use NEXT_PUBLIC_ASSET_BASE_URL
      const transformedData = { ...data };
      if (data.source === 'url' && typeof data.data === 'string' && data.data.startsWith('/gen/')) {
        transformedData.data = buildAssetUrl(data.data);
      }
      
      onRequestAudioControl?.('play', audioType, {
        recordID,
        source: transformedData,
        speakerName: persona?.displayName,
        styling,
        autoPlayOnLoad: false,
        preferImmediate: true,
      });
    }
  };

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

    const thumbsDownTint = ratingExists && ratingValue <= 0;
    const thumbsUpTint = ratingExists && ratingValue > 0;

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

const renderSpinner = (key, label) => (
  <div key={key} className="flex w-full flex-col items-center gap-2">
    <Spinner color={palette.text} />
    {label ? (
      <span className="text-[10px] uppercase tracking-[0.35em] text-white/50">{label}</span>
    ) : null}
  </div>
);
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
          <ReactMarkdown components={markdownComponents}>
            {formatErrorMessage(error) || 'Unknown error'}
          </ReactMarkdown>
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
          } else if (type === 'video') {
            result.push(renderSpinner(`${type}-${index}`, 'Rendering video...'));
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
            const imageUrl = data.startsWith('/gen/') ? buildAssetUrl(data) : data;
            result.push(
              <div key={key} className="flex w-full justify-center">
                <ImageWithFallback
                  primary={imageUrl}
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
        } else if (mediaType === 'video') {
          const extractVideoSource = (value) => {
            if (!value) {
              return { src: null, poster: null, metadata: null };
            }

            if (typeof value === 'string') {
              const trimmed = value.trim();
              const looksLikeJson =
                (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                (trimmed.startsWith('[') && trimmed.endsWith(']'));

              if (looksLikeJson) {
                try {
                  const parsed = JSON.parse(trimmed);
                  if (parsed && typeof parsed === 'object') {
                    value = parsed;
                  } else {
                    return { src: value, poster: null, metadata: null };
                  }
                } catch (error) {
                  return { src: value, poster: null, metadata: null };
                }
              } else {
                return { src: value, poster: null, metadata: null };
              }
            }

            if (typeof value === 'object') {
              const src =
                typeof value.url === 'string'
                  ? value.url
                  : typeof value.path === 'string'
                  ? value.path
                  : typeof value.video === 'string'
                  ? value.video
                  : typeof value.contentUrl === 'string'
                  ? value.contentUrl
                  : null;
              const poster =
                typeof value.thumbnail === 'string'
                  ? value.thumbnail
                  : typeof value.poster === 'string'
                  ? value.poster
                  : null;
              const metadata =
                value.executionMetadata ||
                value.metadata ||
                value.job ||
                null;

              return { src, poster, metadata };
            }

            return { src: null, poster: null, metadata: null };
          };

          if (nullUndefinedOrEmpty(data) && processing) {
            result.push(renderSpinner(`${key}-spinner`, 'Rendering video...'));
          } else if (data) {
            const { src, poster, metadata } = extractVideoSource(data);
            const resolvedVideoUrl =
              src && src.startsWith('/gen/') ? buildAssetUrl(src) : src;
            const resolvedPoster =
              poster && poster.startsWith('/gen/') ? buildAssetUrl(poster) : poster;

            if (!resolvedVideoUrl && processing) {
              result.push(renderSpinner(`${key}-spinner`, 'Rendering video...'));
            } else if (typeof data === 'object' && !resolvedVideoUrl) {
              if (editMode) {
                const cardLabel = key.replace(/-/g, ' ').toUpperCase();
                result.push(
                  <div
                    key={`${key}-metadata`}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-white/70"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/40">
                      {cardLabel}
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-white/70">
                      {JSON.stringify(data, null, 2)}
                    </pre>
                  </div>,
                );
              }
            } else if (resolvedVideoUrl) {
              result.push(
                <div key={key} className="flex w-full justify-center">
                  <video
                    className="w-full max-w-3xl rounded-3xl border border-white/10 bg-black object-contain shadow-[var(--video-shadow,0_25px_90px_-45px_rgba(15,23,42,0.65))]"
                    src={resolvedVideoUrl}
                    controls
                    playsInline
                    poster={resolvedPoster ?? undefined}
                  />
                </div>,
              );

              if (editMode) {
                const detailEntries = [];
                if (metadata && typeof metadata === 'object') {
                  if (metadata.status) {
                    detailEntries.push({
                      label: 'Status',
                      value: String(metadata.status),
                    });
                  }
                  if (metadata.progress != null) {
                    const rawProgress = `${metadata.progress}`;
                    const normalizedProgress = rawProgress.includes('%')
                      ? rawProgress
                      : `${rawProgress}%`;
                    detailEntries.push({
                      label: 'Progress',
                      value: normalizedProgress,
                    });
                  }
                  if (metadata.seconds) {
                    const rawSeconds = `${metadata.seconds}`;
                    const normalizedSeconds = rawSeconds.endsWith('s')
                      ? rawSeconds
                      : `${rawSeconds}s`;
                    detailEntries.push({
                      label: 'Duration',
                      value: normalizedSeconds,
                    });
                  }
                  if (metadata.size) {
                    detailEntries.push({
                      label: 'Size',
                      value: metadata.size,
                    });
                  }
                }

                if (detailEntries.length > 0) {
                  result.push(
                    <div
                      key={`${key}-metadata`}
                      className="mx-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70"
                    >
                      <ul className="flex flex-wrap gap-x-6 gap-y-1">
                        {detailEntries.map(({ label, value }) => (
                          <li
                            key={label}
                            className="flex items-center gap-2 uppercase tracking-[0.25em]"
                          >
                            <span className="text-white/40">{label}:</span>
                            <span className="font-semibold text-white/80 tracking-normal normal-case">
                              {value}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>,
                  );
                }
              }
            } else {
              result.push(renderText(key, JSON.stringify(data ?? 'null')));
            }
          }
        } else if (mediaType === 'metadata') {
          if (editMode && data) {
            result.push(
              <div
                key={key}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-white/70"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/40">
                  METADATA
                </div>
                <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-white/70">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>,
            );
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
    <div className="flex w-full justify-center px-3 py-4" style={indentStyle}>
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
              {collapseToggleAvailable ? (
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  className={clsx(
                    "inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition",
                    "hover:border-white/40 hover:bg-white/20",
                  )}
                  aria-label={collapsed ? "Expand component" : "Collapse component"}
                  aria-expanded={!collapsed}
                >
                  {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              ) : depth > 0 ? (
                <span className="inline-block h-8 w-px rounded bg-white/10" />
              ) : null}
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
                {componentStepsLabel && (
                  <div className="text-[10px] uppercase tracking-[0.35em] text-white/40">
                    {componentStepsLabel}
                  </div>
                )}
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
