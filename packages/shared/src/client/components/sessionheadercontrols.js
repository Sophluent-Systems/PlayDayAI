"use client";

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { ChevronDown, Check, Clock, Loader2, User } from "lucide-react";

import { stateManager } from "@src/client/statemanager";
import { VersionSelector } from "@src/client/components/versionselector";
import { callGetAllSessionsForGame } from "@src/client/editor";
import { PrettyDate } from "@src/common/date";

const MENU_WIDTH = 320;

function formatSessionDisplay(session) {
  if (!session) {
    return "Select session";
  }
  const accountName = session?.account?.email || session?.accountID || "Unknown player";
  return session?.assignedName?.trim() || accountName;
}

function SessionDropdown({
  sessions,
  selectedSessionID,
  onSelect,
  loading,
  disabled,
}) {
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const [pendingSelection, setPendingSelection] = useState(false);

  const selectedSession = useMemo(
    () => sessions.find((item) => item.sessionID === selectedSessionID) || null,
    [sessions, selectedSessionID]
  );

  const label = formatSessionDisplay(selectedSession);
  const totalSessions = sessions.length;

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) {
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const offset = 10;
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;

    const width = MENU_WIDTH;
    const maxLeft = Math.max(16, viewportWidth - width - 16);
    const left = Math.min(rect.left + rect.width - width, maxLeft);
    const top = Math.min(rect.bottom + offset, viewportHeight - 24);
    const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
    const scrollX = typeof window !== "undefined" ? window.scrollX : 0;

    setPosition({
      top: top + scrollY,
      left: Math.max(16, left) + scrollX,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    updateMenuPosition();

    function handlePointer(event) {
      if (
        menuRef.current?.contains(event.target) ||
        buttonRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    }

    function handleKey(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) {
      setPendingSelection(false);
    }
  }, [open]);

  const handleToggle = () => {
    if (disabled) {
      return;
    }
    setOpen((value) => !value);
  };

  const handleSelect = async (sessionID) => {
    if (!sessionID || pendingSelection) {
      return;
    }
    setPendingSelection(true);
    try {
      await onSelect(sessionID);
      setOpen(false);
    } finally {
      setPendingSelection(false);
    }
  };

  const menuContent = (
    <div
      ref={menuRef}
      className="fixed z-50 w-[320px] rounded-3xl border border-border/70 bg-surface/95 p-4 shadow-[0_28px_55px_-24px_rgba(15,23,42,0.65)] backdrop-blur-xl"
      style={position ?? { top: 0, left: 0 }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Sessions</p>
          {selectedSession ? (
            <p className="mt-1 text-sm font-semibold leading-tight text-emphasis">
              {formatSessionDisplay(selectedSession)}
            </p>
          ) : null}
        </div>
        <span className="rounded-full border border-border/60 bg-surface/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          {loading ? "--" : `${totalSessions} total`}
        </span>
      </div>

      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-surface/70 px-4 py-5 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading sessions
          </div>
        ) : null}

        {!loading && sessions.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-surface/70 px-4 py-5 text-sm text-muted">
            No sessions recorded for this version yet.
          </div>
        ) : null}

        {!loading
          ? sessions.map((session) => {
              const displayName = formatSessionDisplay(session);
              const lastUpdated = session?.latestUpdate || session?.updatedAt || session?.createdAt;
              const isActive = session.sessionID === selectedSessionID;

              return (
                <button
                  key={session.sessionID}
                  type="button"
                  onClick={() => handleSelect(session.sessionID)}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-150",
                    isActive
                      ? "border-primary/60 bg-primary/15 text-primary shadow-[0_18px_44px_-28px_rgba(79,70,229,0.65)]"
                      : "border-border/60 bg-surface/80 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border/60 bg-surface/90 text-muted">
                    <User className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold leading-tight text-emphasis">
                      {displayName}
                    </span>
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {lastUpdated ? `Updated ${PrettyDate(lastUpdated)}` : "No activity"}
                    </span>
                  </span>
                  {isActive ? (
                    <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })
          : null}
      </div>
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled || pendingSelection}
        className={clsx(
          "inline-flex h-11 items-center gap-2 rounded-full border border-border/60 bg-surface/90 px-4 text-sm font-semibold text-emphasis shadow-soft transition",
          disabled || pendingSelection
            ? "cursor-not-allowed opacity-60"
            : "hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary"
        )}
      >
        <span className="truncate max-w-[180px] sm:max-w-[220px]">{label}</span>
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && position && typeof document !== "undefined" ? createPortal(menuContent, document.body) : null}
    </div>
  );
}

export function SessionHeaderControls() {
  const pathname = usePathname();
  const {
    loading,
    editMode,
    game,
    version,
    session,
    switchSessionID,
  } = useContext(stateManager);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const isSessionRoute = useMemo(() => pathname?.includes("/sessionlist/") ?? false, [pathname]);
  const canRender = isSessionRoute && editMode && game?.gameID && !loading;

  const activeSessionID = session?.sessionID ?? null;

  const fetchSessions = useCallback(async () => {
    if (!game?.gameID || !version?.versionID) {
      setSessions([]);
      return;
    }
    setLoadingSessions(true);
    try {
      const response = await callGetAllSessionsForGame(game.gameID, version.versionID);
      setSessions(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Failed to load sessions for header controls", error);
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, [game?.gameID, version?.versionID]);

  useEffect(() => {
    if (!canRender || !version?.versionID) {
      setSessions([]);
      return;
    }
    fetchSessions();
  }, [canRender, version?.versionID, fetchSessions]);

  const handleSelectSession = useCallback(
    async (sessionID) => {
      if (!sessionID || sessionID === activeSessionID) {
        return;
      }
      try {
        await switchSessionID(sessionID, game?.gameID);
      } catch (error) {
        console.error("Failed to switch session from header controls", error);
      }
    },
    [activeSessionID, switchSessionID, game?.gameID]
  );

  if (!canRender) {
    return null;
  }

  return (
    <div className="pointer-events-auto inline-flex w-full max-w-xl flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
      <div className="w-full min-w-[220px] sm:w-[240px]">
        <VersionSelector dropdown chooseMostRecent />
      </div>
      <SessionDropdown
        sessions={sessions}
        selectedSessionID={activeSessionID}
        onSelect={handleSelectSession}
        loading={loadingSessions}
        disabled={!version?.versionID}
      />
    </div>
  );
}

export default SessionHeaderControls;
