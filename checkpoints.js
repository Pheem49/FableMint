/* ═══════════════════════════════════════════════════════════════════════════
   FableCut checkpoints — automatic project.json snapshots so an agent's bad
   edit is never unrecoverable.

   Every write made through the MCP write tools (fablecut_patch_project,
   fablecut_set_project, fablecut_auto_caption) snapshots the document as it
   stood immediately BEFORE that write, keyed by its revision number. Revert
   restores one of those snapshots as a new (higher) revision — reverting is
   itself checkpointed, so it can be undone the same way.

   Use as a module: const { saveCheckpoint, listCheckpoints, loadCheckpoint } = require("./checkpoints");
   ═══════════════════════════════════════════════════════════════════════════ */
"use strict";
const fs = require("fs");
const path = require("path");
const { CHECKPOINTS_DIR } = require("./paths");

const LIMIT = 50; // oldest checkpoints are pruned past this count

function indexFile() { return path.join(CHECKPOINTS_DIR, "index.json"); }
function readIndex() {
  try { return JSON.parse(fs.readFileSync(indexFile(), "utf8")); } catch { return []; }
}
function writeIndex(list) {
  fs.mkdirSync(CHECKPOINTS_DIR, { recursive: true });
  const tmp = indexFile() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, indexFile());
}

/** Snapshot `doc` — the document as it stood right before being superseded —
 * so it can be restored later. `reason` is a short human-readable label
 * (e.g. the tool name that's about to overwrite it). */
function saveCheckpoint(doc, reason) {
  fs.mkdirSync(CHECKPOINTS_DIR, { recursive: true });
  const revision = doc.revision || 0;
  const file = `${revision}.json`;
  fs.writeFileSync(path.join(CHECKPOINTS_DIR, file), JSON.stringify(doc, null, 2));
  let list = readIndex().filter((e) => e.revision !== revision); // replace, don't duplicate
  list.push({
    revision, file, savedAt: new Date().toISOString(), reason,
    clips: (doc.clips || []).length, media: (doc.media || []).length,
  });
  list.sort((a, b) => a.revision - b.revision);
  while (list.length > LIMIT) {
    const old = list.shift();
    try { fs.unlinkSync(path.join(CHECKPOINTS_DIR, old.file)); } catch { }
  }
  writeIndex(list);
}

/** Newest-first list of checkpoint metadata (no project content). */
function listCheckpoints(limit) {
  const list = readIndex().slice().sort((a, b) => b.revision - a.revision);
  return limit ? list.slice(0, limit) : list;
}

/** Loads one checkpoint's full document. Omit `revision` for the most recent
 * one. Returns null if there isn't a matching checkpoint. */
function loadCheckpoint(revision) {
  const list = readIndex();
  const entry = revision != null
    ? list.find((e) => e.revision === revision)
    : list.slice().sort((a, b) => b.revision - a.revision)[0];
  if (!entry) return null;
  const doc = JSON.parse(fs.readFileSync(path.join(CHECKPOINTS_DIR, entry.file), "utf8"));
  return { entry, doc };
}

module.exports = { saveCheckpoint, listCheckpoints, loadCheckpoint };
