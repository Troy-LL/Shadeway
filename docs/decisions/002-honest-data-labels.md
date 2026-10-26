# 002 Honest data labels

Status: Accepted

## Context

Manila shade is dominated by things OpenStreetMap misses or maps poorly: covered walkways, LRT and MRT viaducts, overpasses, and vendor tarps. Building footprints are often present but heights are sparse. Until tree canopy is in, the model sees only buildings. A confident route that is wrong on a hot afternoon costs the user real discomfort and costs the product its credibility.

## Decision

We will label what the model knows and gate every claim on measurement.

- Every route card shows the label "Building-only estimate, no trees" until canopy is shipped and scored. The label is exact text and lives in one constant.
- Each route has a confidence badge with three values: `Estimate` (building shadows only), `Estimate + canopy` (phase two), `Checked` (only when walked segments on that route were scored and matched). `Checked` is never set by default.
- Known shade that OpenStreetMap lacks goes in a hand-mapped overrides file for the pilot: covered walkways, viaducts, overpasses. Each override has a source note. Edges touched by an override report it in the pipeline report.
- We will ground-truth 20 walked segments in the pilot: sun or shade observed at a stated time, against the model's prediction for the same slot. The scorer reports the match rate and the miss list.
- We will publish no accuracy statement, and no wording that implies tree shade, until the scored match rate exists. The README then states the measured number, the segment count, and the date.

## Consequences

- Early users see a modest claim. That is intended.
- The walk is real work for the owner of the product, and a data file format for it must exist before the walk.
- `docs/eval.md` is created when the scorer exists and has a first scored run, not before.
- Copy changes that touch accuracy, trees, or shade quality need this file read first.
