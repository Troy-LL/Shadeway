import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { UI_STYLES } from "../src/ui/styles.ts";
import { UI_STATE_FIXTURES, UI_STATE_IDS } from "../src/ui/state-fixtures.ts";
import { renderUiState } from "../src/ui/render.ts";

const outDir = process.argv[2] ?? join(process.cwd(), "scratch", "ui-states");

mkdirSync(outDir, { recursive: true });

const baseDoc = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Shadeway UI state</title>
  <style>${UI_STYLES}</style>
  <style>body { margin: 0; background: #dfe6ee; min-height: 100vh; }</style>
</head>
<body>
`;

for (const stateId of UI_STATE_IDS) {
  const window = new Window();
  const state = UI_STATE_FIXTURES[stateId];
  const previousDocument = globalThis.document;
  globalThis.document = window.document;
  const host = renderUiState(state);
  globalThis.document = previousDocument;
  window.document.body.append(host);
  const fragment = host.outerHTML;
  const html = `${baseDoc}${fragment}</body></html>`;
  writeFileSync(join(outDir, `${stateId}.html`), html, "utf8");
  window.close();
}

console.log(`Wrote ${UI_STATE_IDS.length} states to ${outDir}`);
