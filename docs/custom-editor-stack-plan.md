# Custom Editor Stack Stabilization Plan

## Objectives
- Eliminate the React `Maximum update depth exceeded` loop in the custom component editor.
- Support nested version and custom component editors without keeping redundant ReactFlow trees active.
- Reduce data-loading and render overhead by pausing inactive editor instances.
- Capture and spread institutional knowledge through updated documentation and learnings.

## Phase 1 – Discovery (In Progress)
1. Trace the state/data flow from `app/(main)/editgameversions/[gameUrl]/page.jsx` through `VersionEditor` into `CustomComponentEditor`.
2. Identify `useEffect`/`useLayoutEffect` hooks that mutate `nodes`, `edges`, or viewport state within ReactFlow and catalog the dependencies that can re-trigger.
3. Map how editor stack navigation is orchestrated (provider trees, contexts, global stores) and where data fetching happens.
4. Add temporary instrumentation (guarded `console.debug`, profiling notes) around editor mount/unmount and graph derivation to pinpoint infinite loop triggers.

### Current Findings
- `VersionEditor` owns a single `componentEditorState` object and blocks recursion with alerts in both `handleComponentNodeStructureChange` and the context menu action, so we cannot open a second custom component editor without replacing the first.
- `CustomComponentEditor` rebuilds the entire `graphNodes` array whenever `handleNodeClick` changes; that callback depends on `selectedNodeIDs`, so every selection update forces a fresh ReactFlow node tree and rebinds all node-level handlers.
- Boundary anchoring (`scheduleAnchorBoundary`/`anchorBoundaryNodes`) uses `requestAnimationFrame` to reposition special input/output nodes by calling `setGraphNodes`; the epsilon guards prevent jitter, but the logic still fires after most viewport and wrapper-size changes, which can cascade when ReactFlow also emits `onMove`.
- Edge derivation runs in two identical `useEffect` hooks keyed by `draft`, so the editor performs redundant `setEdges` state updates even when the draft is unchanged.
- Selection state flows from ReactFlow → `handleNodesChange` → `onSelectionChange` → `VersionEditor` `setComponentEditorState` → prop `draft.selectedNodeIDs` → local `useEffect` that reopens the inspector; the round-trip happens on every node toggle, contributing to render churn.
- Both `handleNodesChange` and `handleSelectionChange` fire on selection events and each pushes updates into `setSelectedNodeIDs` and the parent callback, so a single click generates two notifications and re-renders, amplifying the feedback loop when nested editors forward the same events.

## Phase 2 – Stabilization
1. Constrain ReactFlow usage to a single, side-effect-free surface per editor by:
   - Removing cyclic `setState` flows (e.g., guard viewport adjustments with epsilon checks).
   - Switching from `fitView` prop to imperative one-shot calls.
   - Consolidating selection synchronization into a single reducer-based effect.
2. Introduce an `EditorInstanceContext` that tracks the active editor stack level and exposes `isActive` toggles to downstream hooks/components.
3. Gate expensive hooks (graph derivation, audio preview loaders, AI integrations) behind `isActive` checks and memoize derived graph structures.

### Stabilization Design
- Refactor `handleNodeClick` in `customcomponenteditor.js` to use functional `setSelectedNodeIDs` updates so the callback no longer depends on the current selection array; this keeps the handler stable and lets the graph layout effect drop `handleNodeClick` from its dependency list.
- Collapse selection handling onto `onSelectionChange` by trimming the duplicate logic in `handleNodesChange` (only process geometry/alignment updates there); ensure the parent callback receives a single, deduped update per user action.
- Replace the twin `useEffect` blocks that call `setEdges([...internalEdges, ...exposureEdges])` with a single memoized computation keyed by the draft, and store exposures in a ref so ReactFlow only sees diffs.
- Move the ReactFlow node rebuild into a `useMemo` that derives node props from `(draft.nodes, selectedNodeIDs, isActive)` and push the array into state via `useEffect` when it actually changes; this lets us pause updates while inactive.
- Gate `scheduleAnchorBoundary` and related `requestAnimationFrame` work on the `isActive` flag and ensure the guard cancels outstanding frames when an editor background-queues.
- Introduce an `useEditorLifecycle` hook that returns `{ isActive, pause(), resume() }` for downstream hooks to check before performing stateful work (viewport persistence, inspector sync, etc.).

## Phase 3 – Architectural Cleanup
1. Refactor shared utilities (`customcode.js`, `recordgraph.js`, `nodeMetadata.js`) so they remain pure and return immutable data snapshots.
2. Extract a headless store (reducer or Zustand) to centralize graph mutations and provide selector-based subscriptions for React components.
3. Build a stack-aware editor controller that lazily mounts nested editors and handles navigation history, ensuring off-screen editors suspend.

### Architectural Design Notes
- Represent the editor stack as an array of `{ kind: 'version' | 'custom', draft, parentInstanceId, status }` managed by a reducer; expose helper actions (`pushDraft`, `pop`, `replaceDraft`) so both `VersionEditor` and nested editors can navigate without reimplementing stack logic.
- Wrap `VersionEditor` with a new `EditorStackProvider` that surfaces the reducer and the currently focused editor ID; `NodeGraphDisplay` and `CustomComponentEditor` can consume this to decide whether they should hydrate heavy data or stay in a suspended shell.
- Persist draft snapshots for background editors as lightweight POJOs stored in the stack reducer; when an editor suspends we drop derived ReactFlow state and inspector UI, keeping only the serialized draft and viewport metadata.
- Split graph mutation helpers (currently inside `versioneditor.js`) into a shared `editorGraphStore.ts` module that exports pure transformers; this makes it possible to share the same mutation logic between main and nested editors and to unit test without React.
- Define a navigation API (`openCustomComponent(instanceIDs, options)`) that pushes a new stack frame and returns a promise for commit/cancel, enabling parent editors to await results rather than juggling local state.

## Phase 4 – Validation & Documentation
1. Create component/integration tests covering nested editor navigation and ensuring only active editors update ReactFlow state.
2. Run React Profiler sessions to confirm render frequency and memory use stay bounded with deep editor stacks.
3. Update `docs/` with architecture diagrams and debugging notes; append distilled insights to `docs/learnings.md`.
4. Remove temporary instrumentation and finalize code comments prior to commit.

## Implementation Checklist
- [x] Build `EditorStackProvider` + reducer (`packages/shared/src/client/components/versioneditor/editorStackContext.tsx`) and migrate `VersionEditor` to consume it.
- [x] Convert `VersionEditor` `componentEditorState` into stack usage and update action handlers (`startCustomComponent`, `commit`, `cancel`) to push/pop frames.
- [x] Update `CustomComponentEditor` to read `isActive`/`suspend` from context, drop duplicate selection handlers, and memoize node/edge derivation.
- [x] Rework boundary anchoring to respect `isActive` and cancel frames on unmount; remove duplicate edge effects and stale console diagnostics.
- [ ] Extract graph mutation helpers into a pure module and update both editor surfaces to use the shared functions.
- [ ] Implement regression tests for selection loop, nested editor navigation, and boundary anchoring guard.
- [ ] Refresh `docs/learnings.md` with new insights and add architecture notes for the nested editor stack.
## Deliverables
- Code fixes in editor components and shared utilities that break the render loop.
- Context provider or store abstractions supporting nested editors.
- Regression test coverage for editor stack transitions.
- Updated documentation (plan file, architecture notes, learnings).
