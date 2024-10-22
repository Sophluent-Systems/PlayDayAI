import { atom, selector } from 'recoil';
import { recoilPersist } from 'recoil-persist';
import { v4 as uuidv4 } from 'uuid';

// storage.js
const isServer = typeof window === 'undefined';

export const safeSessionStorage = {
  getItem: (key) => isServer ? null : sessionStorage.getItem(key),
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

const sessionPersist = recoilPersist({
    key: 'recoil-session-persist',
    storage: safeSessionStorage,
});

export const safeLocalStorage = {
    getItem: (key) => isServer ? null : localStorage.getItem(key),
    setItem: (key, value) => {
        if (!isServer) {
        localStorage.setItem(key, value);
        }
    }
};

const localPersist = recoilPersist({
    key: 'recoil-local-persist',
    storage: safeLocalStorage,
});

const vhState = atom({
    key: 'vhState',
    default: '100vh',
});

//
// Account includes auth and security -- needs to come from server
//
const account = atom({
    key: 'account',
    default: null,
    //effects_UNSTABLE: [sessionPersist.persistAtom],
});

const editModeState = atom({
    key: 'editMode',
    default: false,
    effects_UNSTABLE: [sessionPersist.persistAtom],
});

const gameState = atom({
    key: 'game',
    default: null,
    effects_UNSTABLE: [sessionPersist.persistAtom],
});

const versionListState = atom({
    key: 'versionList',
    default: [],
    effects_UNSTABLE: [sessionPersist.persistAtom],
});

const versionState = atom({
    key: 'version',
    default: null,
    effects_UNSTABLE: [sessionPersist.persistAtom],
});

const sessionState = atom({
    key: 'session',
    default: null,
    effects_UNSTABLE: [sessionPersist.persistAtom],
});

const globalTemporaryStateState = atom({
    key: 'globalTemporaryState',
    default: {},
    effects_UNSTABLE: [sessionPersist.persistAtom],
});

const browserSessionIDState = atom({
    key: 'browserSessionID',
    default: uuidv4(),
    effects_UNSTABLE: [sessionPersist.persistAtom],
});

const accessTokenState = atom({
    key: 'accessToken',
    default: null,
});

const dirtyEditorState = atom({
    key: 'dirtyEditor',
    default: false,
});

const editorSaveRequestState = atom({
    key: 'editorSaveRequest',
    default: null,
});

const collapsiblePanelSettingsState = atom({
    key: 'collapsiblePanelSettings',
    default: {},
    effects_UNSTABLE: [localPersist.persistAtom],
});

const audioPlaybackQueueState = atom({
    key: 'audioPlaybackQueue',
    default: [],
});

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
    audioPlaybackQueueState
};