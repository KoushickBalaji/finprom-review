import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const appRoot = path.resolve(scriptDir, "../..");
export const corpusRoot = path.join(appRoot, "corpus");
export const defaultSnapshotId = "fca-demo-pack-2026-08-30";
export const fullSnapshotId = "fca-handbook-2026-08-30";
export const snapshotDir = (id = defaultSnapshotId) =>
  path.join(corpusRoot, "snapshots", id);
export const snapshotFile = (id = defaultSnapshotId) =>
  path.join(snapshotDir(id), "provisions.ndjson");
export const indexFile = (id = defaultSnapshotId) =>
  path.join(corpusRoot, "index", `${id}.sqlite`);
export const chunkDir = (id = fullSnapshotId) =>
  path.join(corpusRoot, "chunks", id);
export const chunkFile = (id = fullSnapshotId) =>
  path.join(chunkDir(id), "chunks.preview.ndjson");
export const chunkManifestFile = (id = fullSnapshotId) =>
  path.join(chunkDir(id), "manifest.json");

