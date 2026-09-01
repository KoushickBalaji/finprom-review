import {
  chunkFile,
  chunkManifestFile,
  fullSnapshotId,
  indexFile,
  snapshotFile,
} from "./corpus-paths.mjs";
import { buildFullIndex } from "./full-index-lib.mjs";

const snapshotId = process.argv[2] || fullSnapshotId;
const result = await buildFullIndex({
  snapshotId,
  chunkFile: chunkFile(snapshotId),
  chunkManifestFile: chunkManifestFile(snapshotId),
  canonicalFile: snapshotFile(snapshotId),
  outputFile: indexFile(snapshotId),
});

console.log(JSON.stringify(result, null, 2));

