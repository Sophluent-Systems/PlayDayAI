# Learnings

## Custom Component Editor
- ReactFlow reprojects boundary nodes on every viewport update; keep our synthetic input/output nodes tolerant to sub-pixel changes, otherwise `anchorBoundaryNodes` will loop via `setGraphNodes` and hit React's maximum update depth. A small epsilon check before repositioning prevents the cascade triggered by `fitView`/`onMove`.
- The `fitView` prop on `<ReactFlow>` will refit after every node update; when we also re-anchor boundary nodes to the viewport edges this causes an infinite update cycle. Use the manual one-shot `fitView` call instead of the prop.
- ReactFlow emits `onMove` continuously; add an epsilon guard before updating the stored viewport so we only react to meaningful movement and avoid re-triggering anchoring loops.
- Let the dedicated selection-sync effect update `node.selected`/`data.isSelected`; piping selection straight into the layout effect forces ReactFlow to thrash the viewport and risks max-depth loops when fit/anchor logic runs.
- Modifier-key clicks (shift/meta/ctrl) are how ReactFlow signals additive selection; node-level click handlers must early exit so we don't overwrite the selection array and accidentally block multi-select.
- Drag-rectangle selection needs `selectionOnDrag` (and `selectionKeyCode={null}` if we want it without Shift); enabling `selectNodesOnDrag` while our nodes are non-draggable suppresses ReactFlow’s `'select'` change events, so leave that prop off in the custom editor.
- The graph rebuild effect is intentionally singular; duplicating it competes with the selection-sync effect and missing the local `selectionSet` declaration will crash the editor. Keep one layout effect and let the lightweight selection updater manage highlights.

## Editor Stack Observations
- `VersionEditor` only tracks a single `componentEditorState` and blocks recursion via alerts at `packages/shared/src/client/components/versioneditor/versioneditor.js:1820` and `packages/shared/src/client/components/versioneditor/customcomponenteditor.js:1669`; moving to nested editors means replacing those guards with a reducer-backed stack.
- Selection fan-out currently happens twice (`handleNodesChange` and `handleSelectionChange` both emit) in `packages/shared/src/client/components/versioneditor/customcomponenteditor.js:1292` and `packages/shared/src/client/components/versioneditor/customcomponenteditor.js:1917`, which doubles render work and complicates future instrumentation.
- The node rebuild effect depends on `handleNodeClick` (`packages/shared/src/client/components/versioneditor/customcomponenteditor.js:785`), so every selection change rebuilds the entire node array; stabilizing the handler with functional state updates lets us limit ReactFlow churn when editors layer.
- When parent re-renders replace the child selection handler via ref storage (`selectionChangeRef.current`) so ReactFlow’s selection events don’t keep emitting identical updates; otherwise every node rebuild feeds back into the parent stack reducer and redials the infinite loop.
