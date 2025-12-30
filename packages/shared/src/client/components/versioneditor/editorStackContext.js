'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
} from 'react';

const EditorStackContext = createContext(null);

const initialState = {
  frames: [],
  activeId: null,
  counter: 0,
};

function normalizeFrame(frame, generatedId) {
  if (!frame) {
    throw new Error('EditorStack: frame payload is required');
  }
  const id =
    frame.id ||
    (frame.kind ? `${frame.kind}-${generatedId}` : `frame-${generatedId}`);
  const status =
    frame.status && frame.status !== 'active' ? frame.status : 'active';
  return {
    ...frame,
    id,
    status,
  };
}

function editorStackReducer(state, action) {
  switch (action.type) {
    case 'INITIALIZE': {
      const counter = state.counter + 1;
      const frame = normalizeFrame(action.frame, counter);
      return {
        frames: [{ ...frame, status: 'active' }],
        activeId: frame.id,
        counter,
      };
    }
    case 'PUSH': {
      const counter = state.counter + 1;
      const nextFrame = normalizeFrame(action.frame, counter);
      const demoted = state.frames.map((frame) =>
        frame.id === state.activeId && frame.status !== 'background'
          ? { ...frame, status: 'background' }
          : frame,
      );
      return {
        frames: [...demoted, nextFrame],
        activeId: nextFrame.id,
        counter,
      };
    }
    case 'POP': {
      if (state.frames.length === 0) {
        return state;
      }
      const targetId = action.id || state.frames[state.frames.length - 1].id;
      const filtered = state.frames.filter((frame) => frame.id !== targetId);
      if (filtered.length === state.frames.length) {
        return state;
      }
      const nextActive = filtered.length
        ? filtered[filtered.length - 1].id
        : null;
      const stabilized = filtered.map((frame, index) => ({
        ...frame,
        status: index === filtered.length - 1 ? 'active' : 'background',
      }));
      return {
        frames: stabilized,
        activeId: nextActive,
        counter: state.counter,
      };
    }
    case 'SET_ACTIVE': {
      if (!action.id || action.id === state.activeId) {
        return state;
      }
      const hasFrame = state.frames.some((frame) => frame.id === action.id);
      if (!hasFrame) {
        return state;
      }
      const updated = state.frames.map((frame) => {
        if (frame.id === action.id) {
          if (frame.status === 'active') {
            return frame;
          }
          return { ...frame, status: 'active' };
        }
        if (frame.status === 'background') {
          return frame;
        }
        return { ...frame, status: 'background' };
      });
      return {
        frames: updated,
        activeId: action.id,
        counter: state.counter,
      };
    }
    case 'UPDATE': {
      const { id, updater, patch } = action;
      if (!id) {
        return state;
      }
      let changed = false;
      const updated = state.frames.map((frame) => {
        if (frame.id !== id) {
          return frame;
        }
        let nextFrame = frame;
        if (typeof updater === 'function') {
          const result = updater(frame);
          if (result && result !== frame) {
            nextFrame = { ...frame, ...result };
            changed = true;
          }
        } else if (patch && typeof patch === 'object') {
          nextFrame = { ...frame, ...patch };
          changed = true;
        }
        return nextFrame;
      });
      if (!changed) {
        return state;
      }
      return {
        frames: updated,
        activeId: state.activeId,
        counter: state.counter,
      };
    }
    case 'REPLACE': {
      if (!action.frame || !action.id) {
        return state;
      }
      const hasTarget = state.frames.some((frame) => frame.id === action.id);
      if (!hasTarget) {
        return state;
      }
      const normalized = {
        ...action.frame,
        id: action.id,
        status: action.frame.status || (state.activeId === action.id ? 'active' : 'background'),
      };
      const replaced = state.frames.map((frame) =>
        frame.id === action.id ? normalized : frame,
      );
      return {
        frames: replaced,
        activeId: state.activeId,
        counter: state.counter,
      };
    }
    default:
      return state;
  }
}

export function EditorStackProvider({ initialFrame, children }) {
  const [state, dispatch] = useReducer(
    editorStackReducer,
    initialState,
    (baseState) => {
      if (!initialFrame) {
        return baseState;
      }
      const counter = baseState.counter + 1;
      const frame = normalizeFrame(initialFrame, counter);
      return {
        frames: [{ ...frame, status: 'active' }],
        activeId: frame.id,
        counter,
      };
    },
  );

  const pushFrame = useCallback(
    (frame) => {
      dispatch({ type: 'PUSH', frame });
    },
    [dispatch],
  );

  const popFrame = useCallback(
    (id) => {
      dispatch({ type: 'POP', id });
    },
    [dispatch],
  );

  const setActive = useCallback(
    (id) => {
      dispatch({ type: 'SET_ACTIVE', id });
    },
    [dispatch],
  );

  const updateFrame = useCallback(
    (id, updater) => {
      if (typeof updater === 'function') {
        dispatch({ type: 'UPDATE', id, updater });
      } else {
        dispatch({ type: 'UPDATE', id, patch: updater });
      }
    },
    [dispatch],
  );

  const replaceFrame = useCallback(
    (id, frame) => {
      dispatch({ type: 'REPLACE', id, frame });
    },
    [dispatch],
  );

  const getFrameById = useCallback(
    (id) => state.frames.find((frame) => frame.id === id) || null,
    [state.frames],
  );

  const value = useMemo(
    () => ({
      stack: state.frames,
      activeId: state.activeId,
      activeFrame:
        state.frames.find((frame) => frame.id === state.activeId) || null,
      pushFrame,
      popFrame,
      setActive,
      updateFrame,
      replaceFrame,
      getFrameById,
      isActive: (id) => state.activeId === id,
    }),
    [
      state.frames,
      state.activeId,
      pushFrame,
      popFrame,
      setActive,
      updateFrame,
      replaceFrame,
      getFrameById,
    ],
  );

  return (
    <EditorStackContext.Provider value={value}>
      {children}
    </EditorStackContext.Provider>
  );
}

export function useEditorStack() {
  const context = useContext(EditorStackContext);
  if (!context) {
    throw new Error('useEditorStack must be used within an EditorStackProvider');
  }
  return context;
}

export function useEditorFrameActivity(frameId) {
  const { activeId } = useEditorStack();
  return activeId === frameId;
}
