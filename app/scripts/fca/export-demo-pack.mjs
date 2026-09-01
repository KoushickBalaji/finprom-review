import fs from "node:fs/promises";
import { RULES, SNAPSHOT } from "../../lib/regulatory-pack.js";
import { snapshotDir, snapshotFile } from "./corpus-paths.mjs";

const directory = snapshotDir(SNAPSHOT.id);
await fs.mkdir(directory, { recursive: true });

const records = RULES.map((rule) => ({
  id: rule.id,
  sourcebook: rule.sourcebook,
  module: null,
  chapter: rule.id.match(/^[A-Z]+\s+(\d+)/)?.[1] ?? null,
  section: rule.id.match(/^[A-Z]+\s+\d+\.(\d+)/)?.[1] ?? null,
  provisionType: rule.provisionType,
  heading: rule.heading,
  text: rule.quote,
  effectiveDate: rule.effectiveDate,
  url: rule.url,
  parentId: null,
  crossReferences: [],
  metadata: { concepts: rule.concepts, source: "demo-pack" },
}));

await fs.writeFile(
  snapshotFile(SNAPSHOT.id),
  `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
  "utf8",
);
await fs.writeFile(
  `${directory}/manifest.json`,
  `${JSON.stringify({ ...SNAPSHOT, itemCount: records.length }, null, 2)}\n`,
  "utf8",
);

console.log(`Exported ${records.length} provisions to ${snapshotFile(SNAPSHOT.id)}`);


