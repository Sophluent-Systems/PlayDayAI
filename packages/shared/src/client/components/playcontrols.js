import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Play, Pause } from 'lucide-react';
import { useAtom } from 'jotai';
import { editorSaveRequestState, dirtyEditorState } from '@src/client/states';
import { nullUndefinedOrEmpty } from '@src/common/objects';

function resolveThemeTokens(theme) {
  const palette = theme?.palette || {};
  const colors = theme?.colors || {};
  const isDarkMode = (palette.mode || palette.type) === 'dark';

  const baseSurface =
    colors.playbackControlsBackgroundColor ||
    colors.debugControlsBackgroundColor ||
    colors.inputAreaTextEntryBackgroundColor ||
    (isDarkMode ? 'rgba(15,23,42,0.9)' : 'rgba(241,245,249,0.95)');

  const borderColor =
    colors.playbackControlsBorderColor ||
    colors.debugControlsBorderColor ||
    (isDarkMode ? 'rgba(148,163,184,0.35)' : 'rgba(15,23,42,0.12)');

  const textColor =
    colors.inputTextEnabledColor || (isDarkMode ? 'rgba(226,232,240,0.9)' : 'rgba(30,41,59,0.78)');

  const subtleTextColor =
    colors.inputTextDisabledColor || (isDarkMode ? 'rgba(203,213,225,0.75)' : 'rgba(71,85,105,0.75)');

  const neutralButtonBg =
    colors.playbackControlsNeutralButtonBackground ||
    (isDarkMode ? 'rgba(148,163,184,0.22)' : 'rgba(15,23,42,0.07)');

  const neutralButtonText = colors.playbackControlsNeutralButtonText || textColor;

  const modalSurface = colors.modalSurfaceColor || baseSurface;
  const modalBorder = colors.modalBorderColor || borderColor;

  return {
    baseSurface,
    borderColor,
    textColor,
    subtleTextColor,
    neutralButtonBg,
    neutralButtonText,
    modalSurface,
    modalBorder,
  };
}

export function PlayControls(props) {
  const { isRunning, onRequestStateChange, sessionID, theme, connectionReady = true, connectionStatusMessage } = props;
  const [editorSaveRequest, setEditorSaveRequest] = useAtom(editorSaveRequestState);
  const [dirtyEditor] = useAtom(dirtyEditorState);
  const [waitingForPlay, setWaitingForPlay] = useState(false);
  const [waitingForPause, setWaitingForPause] = useState(false);
  const [waitingForRestart, setWaitingForRestart] = useState(false);
  const [openConfirmModal, setOpenConfirmModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const lastSessionRef = useRef(null);

  const themeTokens = resolveThemeTokens(theme);
  const connectionDisabled = !connectionReady;
  const disableTitle = connectionDisabled ? (connectionStatusMessage || 'Connection unavailable. Reconnecting...') : undefined;

  useEffect(() => {
    if (editorSaveRequest === 'saved') {
      setEditorSaveRequest(null);

      if (!dirtyEditor) {
        onRequestStateChange('play');
      }
    }
  }, [editorSaveRequest, dirtyEditor, onRequestStateChange, setEditorSaveRequest]);

  useEffect(() => {
    if (waitingForPlay && isRunning) {
      setWaitingForPlay(false);
    }
    if (waitingForPause && !isRunning) {
      setWaitingForPause(false);
    }
  }, [isRunning, waitingForPause, waitingForPlay]);

  useEffect(() => {
    if (waitingForRestart && sessionID !== lastSessionRef.current && !nullUndefinedOrEmpty(sessionID)) {
      setWaitingForRestart(false);
    }
  }, [sessionID, waitingForRestart]);

  useEffect(() => {
    if (openConfirmModal) {
      setIsHovered(true);
    }
  }, [openConfirmModal]);

  const handlePlayButton = () => {
    if (dirtyEditor) {
      setEditorSaveRequest('save');
    } else {
      onRequestStateChange('play');
      setWaitingForPlay(true);
    }
  };

  const handlePauseButton = () => {
    onRequestStateChange('pause');
    setWaitingForPause(true);
  };

  const handleRestart = () => {
    setOpenConfirmModal(false);
    lastSessionRef.current = sessionID;
    onRequestStateChange('restart');
    setWaitingForRestart(true);
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    if (!openConfirmModal) {
      setIsHovered(false);
    }
  };

  const handleFocus = () => setIsHovered(true);
  const handleBlur = (event) => {
    if (!openConfirmModal && !event.currentTarget.contains(event.relatedTarget)) {
      setIsHovered(false);
    }
  };

  const showPlay = !isRunning || dirtyEditor;
  const waiting = waitingForPlay || waitingForPause || waitingForRestart;
  const interactionsDisabled = waiting || connectionDisabled;
  const tabRevealWidth = '5.5rem';
  const panelStyle = {
    transform:
      isHovered || openConfirmModal || connectionDisabled
        ? 'translateX(0)'
        : `translateX(calc(100% - ${tabRevealWidth}))`,
    backgroundColor: themeTokens.baseSurface,
    borderColor: themeTokens.borderColor,
  };
  const statusVisible = isHovered || openConfirmModal || connectionDisabled;
  const statusLabel = connectionDisabled
    ? (disableTitle || 'Reconnecting...')
    : isRunning
      ? 'Running'
      : 'Paused';

  const neutralButtonStyle = {
    backgroundColor: themeTokens.neutralButtonBg,
    color: themeTokens.neutralButtonText,
  };

  return (
    <>
      <div
        className="pointer-events-auto"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocusCapture={handleFocus}
        onBlurCapture={handleBlur}
      >
        <div
          className={`flex h-10 items-center gap-3 overflow-hidden rounded-l-3xl rounded-r-none border border-r-0 pl-4 pr-5 shadow-2xl backdrop-blur transition-transform duration-200 ease-out ${
            waiting ? 'pointer-events-none opacity-60' : connectionDisabled ? 'opacity-60' : ''
          }`}
          style={panelStyle}
        >
          <div className="flex items-center gap-2">
            {showPlay ? (
              <button
                type="button"
                onClick={handlePlayButton}
                aria-label="Play"
                disabled={interactionsDisabled}
                title={disableTitle}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white transition-transform duration-150 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Play className="h-4 w-4" strokeWidth={2.5} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePauseButton}
                aria-label="Pause"
                disabled={interactionsDisabled}
                title={disableTitle}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white transition-transform duration-150 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Pause className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setOpenConfirmModal(true)}
              aria-label="Restart session"
              disabled={interactionsDisabled}
              title={disableTitle}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-150 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              style={neutralButtonStyle}
            >
              <RotateCcw className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>

          <span
            aria-hidden={!statusVisible}
            className={`ml-3 text-xs font-semibold uppercase tracking-[0.35em] transition-all duration-200 ${
              statusVisible ? 'opacity-100 translate-x-0' : 'pointer-events-none opacity-0 -translate-x-6'
            }`}
            style={{ color: themeTokens.subtleTextColor }}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {openConfirmModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        >
          <div
            className="w-full max-w-sm rounded-2xl border p-6 shadow-xl backdrop-blur"
            style={{ backgroundColor: themeTokens.modalSurface, borderColor: themeTokens.modalBorder, color: themeTokens.textColor }}
          >
            <h2 className="text-lg font-semibold">Delete Session</h2>
            <p className="mt-2 text-sm" style={{ color: themeTokens.subtleTextColor }}>
              Are you sure you want to delete your session? There is no way to get it back.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setOpenConfirmModal(false);
                  setIsHovered(false);
                }}
                className="rounded-full border px-4 py-2 text-sm font-semibold transition-transform duration-150 hover:-translate-y-0.5"
                style={{ borderColor: themeTokens.borderColor, color: themeTokens.textColor }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition-transform duration-150 hover:-translate-y-0.5"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
