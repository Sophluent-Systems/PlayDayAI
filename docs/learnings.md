# Learnings

## Custom Component Editor
- ReactFlow reprojects boundary nodes on every viewport update; keep our synthetic input/output nodes tolerant to sub-pixel changes, otherwise `anchorBoundaryNodes` will loop via `setGraphNodes` and hit React's maximum update depth. A small epsilon check before repositioning prevents the cascade triggered by `fitView`/`onMove`.
- The `fitView` prop on `<ReactFlow>` will refit after every node update; when we also re-anchor boundary nodes to the viewport edges this causes an infinite update cycle. Use the manual one-shot `fitView` call instead of the prop.
- ReactFlow emits `onMove` continuously; add an epsilon guard before updating the stored viewport so we only react to meaningful movement and avoid re-triggering anchoring loops.
