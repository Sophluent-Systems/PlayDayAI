
import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import { v4 as uuidv4 } from 'uuid';

const isServer = typeof window === 'undefined';

export const safeSessionStorage = {
  getItem: (key) => (isServer ? null : sessionStorage.getItem(key)),
  setItem: (key, value) => {
    if (!isServer) {
      sessionStorage.setItem(key, value);
    }
  },
  removeItem: (key) => {
    if (!isServer) {
      sessionStorage.removeItem(key);
    }
  },
};

export const safeLocalStorage = {
  getItem: (key) => (isServer ? null : localStorage.getItem(key)),
  setItem: (key, value) => {
    if (!isServer) {
      localStorage.setItem(key, value);
    }
  },
  removeItem: (key) => {
    if (!isServer) {
      localStorage.removeItem(key);
    }
  },
};

const sessionStorageJSON = createJSONStorage(() => safeSessionStorage);
const localStorageJSON = createJSONStorage(() => safeLocalStorage);

const vhState = atom('100vh');

const account = atom(null);

const editModeState = atomWithStorage('editMode', false, sessionStorageJSON);
const gameState = atomWithStorage('game', null, sessionStorageJSON);
const versionListState = atomWithStorage('versionList', [], sessionStorageJSON);
const versionState = atomWithStorage('version', null, sessionStorageJSON);
const sessionState = atomWithStorage('session', null, sessionStorageJSON);
const globalTemporaryStateState = atomWithStorage('globalTemporaryState', {}, sessionStorageJSON);
const browserSessionIDState = atomWithStorage('browserSessionID', uuidv4(), sessionStorageJSON);

const accessTokenState = atom(null);
const dirtyEditorState = atom(false);
const editorSaveRequestState = atom(null);
const collapsiblePanelSettingsState = atomWithStorage('collapsiblePanelSettings', {}, localStorageJSON);
const audioPlaybackQueueState = atom([]);

export {
  vhState,
  account,
  editModeState,
  gameState,
  versionListState,
  versionState,
  sessionState,
  globalTemporaryStateState,
  accessTokenState,
  collapsiblePanelSettingsState,
  browserSessionIDState,
  dirtyEditorState,
  editorSaveRequestState,
  audioPlaybackQueueState,
};
