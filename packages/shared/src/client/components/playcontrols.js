import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Play, Pause } from 'lucide-react';
import { useAtom } from 'jotai';
import { editorSaveRequestState, dirtyEditorState } from '@src/client/states';
import { nullUndefinedOrEmpty } from '@src/common/objects';

export function PlayControls(props) {
  const { isRunning, onRequestStateChange, sessionID } = props;
  const [editorSaveRequest, setEditorSaveRequest] = useAtom(editorSaveRequestState);
  const [dirtyEditor] = useAtom(dirtyEditorState);
  const [waitingForPlay, setWaitingForPlay] = useState(false);
  const [waitingForPause, setWaitingForPause] = useState(false);
  const [waitingForRestart, setWaitingForRestart] = useState(false);
  const [openConfirmModal, setOpenConfirmModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const lastSessionRef = useRef(null);

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
  const tabRevealWidth = '6.5rem';
  const panelStyle = {
    transform:
      isHovered || openConfirmModal
        ? 'translateX(0)'
        : `translateX(calc(100% - ${tabRevealWidth}))`,
  };
  const statusVisible = isHovered || openConfirmModal;

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
          className={`flex h-10 items-center gap-3 overflow-hidden rounded-l-3xl rounded-r-none border border-white/20 border-r-0 bg-slate-950/95 pl-4 pr-5 shadow-2xl backdrop-blur transition-transform duration-200 ease-out ${
            waiting ? 'pointer-events-none opacity-60' : ''
          }`}
          style={panelStyle}
        >
          <div className="flex items-center gap-2">
            {showPlay ? (
              <button
                type="button"
                onClick={handlePlayButton}
                aria-label="Play"
                disabled={waiting}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40"
              >
                <Play className="h-4 w-4" strokeWidth={2.5} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePauseButton}
                aria-label="Pause"
                disabled={waiting}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-500/40"
              >
                <Pause className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setOpenConfirmModal(true)}
              aria-label="Restart session"
              disabled={waiting}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-100 transition hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>

          <span
            aria-hidden={!statusVisible}
            className={`ml-3 text-xs font-semibold uppercase tracking-[0.35em] text-white/85 transition-all duration-200 ${
              statusVisible ? 'opacity-100 translate-x-0' : 'pointer-events-none opacity-0 -translate-x-6'
            }`}
          >
            {isRunning ? 'Running' : 'Paused'}
          </span>
        </div>
      </div>

      {openConfirmModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-slate-950/90 p-6 text-white shadow-xl backdrop-blur">
            <h2 className="text-lg font-semibold">Delete Session</h2>
            <p className="mt-2 text-sm text-white/80">
              Are you sure you want to delete your session? There is no way to get it back.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setOpenConfirmModal(false);
                  setIsHovered(false);
                }}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
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
