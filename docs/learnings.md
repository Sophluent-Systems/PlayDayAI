# Learnings

## Custom Component Editor
- ReactFlow reprojects boundary nodes on every viewport update; keep our synthetic input/output nodes tolerant to sub-pixel changes, otherwise `anchorBoundaryNodes` will loop via `setGraphNodes` and hit React's maximum update depth. A small epsilon check before repositioning prevents the cascade triggered by `fitView`/`onMove`.
- The `fitView` prop on `<ReactFlow>` will refit after every node update; when we also re-anchor boundary nodes to the viewport edges this causes an infinite update cycle. Use the manual one-shot `fitView` call instead of the prop.
- ReactFlow emits `onMove` continuously; add an epsilon guard before updating the stored viewport so we only react to meaningful movement and avoid re-triggering anchoring loops.
- Let the dedicated selection-sync effect update `node.selected`/`data.isSelected`; piping selection straight into the layout effect forces ReactFlow to thrash the viewport and risks max-depth loops when fit/anchor logic runs.
- Modifier-key clicks (shift/meta/ctrl) are how ReactFlow signals additive selection; node-level click handlers must early exit so we don't overwrite the selection array and accidentally block multi-select.
- Drag-rectangle selection needs `selectionOnDrag` (and `selectionKeyCode={null}` if we want it without Shift); enabling `selectNodesOnDrag` while our nodes are non-draggable suppresses ReactFlow’s `'select'` change events, so leave that prop off in the custom editor.
