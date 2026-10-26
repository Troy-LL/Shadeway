/**
 * Walked-segment log, version 1. Track 7 fills one file and runs the scorer.
 * A segment is one place at one Asia/Manila local time.
 * `predicted` is `shade` when the model's sun fraction for that slot is below 0.5, and `sun` otherwise.
 * A null model fraction is not a segment.
 * The scorer prints the match rate. It does not read tiles.
 */
export type WalkObservation = "sun" | "shade";

export type WalkedSegment = {
  id: string;
  date: string;
  minutes: number;
  observed: WalkObservation;
  predicted: WalkObservation;
  edgeId?: number;
};

export type WalkLog = {
  version: 1;
  segments: WalkedSegment[];
};

export function predictionForFraction(fraction: number | null): WalkObservation | null {
  if (fraction === null) return null;
  if (!(fraction >= 0 && fraction <= 1)) throw new RangeError(`sun fraction out of range: ${fraction}`);
  return fraction < 0.5 ? "shade" : "sun";
}

export function scoreLog(value: unknown): string {
  const log = parseWalkLog(value);
  if (log.segments.length === 0) return "match_rate=none\nsegments=0\nmatches=0";
  const misses: string[] = [];
  let matches = 0;
  for (const segment of log.segments) {
    if (segment.observed === segment.predicted) {
      matches += 1;
      continue;
    }
    misses.push(`miss ${segment.id} observed=${segment.observed} predicted=${segment.predicted}`);
  }
  const rate = matches / log.segments.length;
  return [
    `match_rate=${rate}`,
    `segments=${log.segments.length}`,
    `matches=${matches}`,
    ...misses,
  ].join("\n");
}

export function parseWalkLog(value: unknown): WalkLog {
  if (!isRecord(value)) throw new Error("walk log is not an object");
  if (value.version !== 1) throw new Error("walk log version is not 1");
  if (!Array.isArray(value.segments)) throw new Error("walk log segments is not an array");
  return { version: 1, segments: value.segments.map(parseSegment) };
}

function parseSegment(value: unknown): WalkedSegment {
  if (!isRecord(value)) throw new Error("walk segment is not an object");
  const id = value.id;
  if (typeof id !== "string" || id.trim() === "") throw new Error("walk segment is missing an id");
  const date = value.date;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`walk segment ${id} has a bad date`);
  }
  const minutes = value.minutes;
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 0 || minutes >= 1440) {
    throw new Error(`walk segment ${id} has bad minutes`);
  }
  const segment: WalkedSegment = {
    id,
    date,
    minutes,
    observed: observation(value.observed, id, "observed"),
    predicted: observation(value.predicted, id, "predicted"),
  };
  if (value.edgeId !== undefined) {
    if (typeof value.edgeId !== "number" || !Number.isInteger(value.edgeId)) {
      throw new Error(`walk segment ${id} has a bad edgeId`);
    }
    segment.edgeId = value.edgeId;
  }
  return segment;
}

function observation(value: unknown, id: string, field: string): WalkObservation {
  if (value !== "sun" && value !== "shade") throw new Error(`walk segment ${id} field ${field} is not sun or shade`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
