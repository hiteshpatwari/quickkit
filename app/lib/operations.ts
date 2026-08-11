export type JsonStats = {
  objects: number;
  arrays: number;
  keys: number;
  maxDepth: number;
  bytes: number;
};

export type JsonResult = {
  output: string;
  stats: JsonStats;
};

export type JsonDiffEntry = {
  path: string;
  kind: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
};

export type DiffLine = {
  kind: "same" | "added" | "removed";
  value: string;
  oldLine?: number;
  newLine?: number;
};

export type CsvResult = {
  delimiter: string;
  headers: string[];
  rows: string[][];
  malformed: boolean;
};

const encoder = new TextEncoder();

export function parseJson(input: string) {
  try {
    return JSON.parse(input) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    const positionMatch = message.match(/position\s+(\d+)/i);
    if (!positionMatch) throw new Error(message);

    const position = Number(positionMatch[1]);
    const before = input.slice(0, position);
    const line = before.split("\n").length;
    const column = position - before.lastIndexOf("\n");
    throw new Error(`${message} (line ${line}, column ${column})`);
  }
}

function collectJsonStats(value: unknown, depth = 0, stats?: JsonStats): JsonStats {
  const result = stats ?? { objects: 0, arrays: 0, keys: 0, maxDepth: 0, bytes: 0 };
  result.maxDepth = Math.max(result.maxDepth, depth);

  if (Array.isArray(value)) {
    result.arrays += 1;
    value.forEach((item) => collectJsonStats(item, depth + 1, result));
  } else if (value !== null && typeof value === "object") {
    result.objects += 1;
    const entries = Object.entries(value as Record<string, unknown>);
    result.keys += entries.length;
    entries.forEach(([, child]) => collectJsonStats(child, depth + 1, result));
  }

  return result;
}

export function formatJson(input: string, mode: "format" | "minify", indent = 2): JsonResult {
  const value = parseJson(input);
  const output = JSON.stringify(value, null, mode === "format" ? indent : 0);
  const stats = collectJsonStats(value);
  stats.bytes = encoder.encode(input).byteLength;
  return { output, stats };
}

export function diffJson(leftInput: string, rightInput: string): JsonDiffEntry[] {
  const left = parseJson(leftInput);
  const right = parseJson(rightInput);
  const entries: JsonDiffEntry[] = [];

  function walk(before: unknown, after: unknown, path: string) {
    if (Object.is(before, after)) return;

    if (Array.isArray(before) && Array.isArray(after)) {
      const length = Math.max(before.length, after.length);
      for (let index = 0; index < length; index += 1) {
        const nextPath = `${path}[${index}]`;
        if (index >= before.length) entries.push({ path: nextPath, kind: "added", after: after[index] });
        else if (index >= after.length) entries.push({ path: nextPath, kind: "removed", before: before[index] });
        else walk(before[index], after[index], nextPath);
      }
      return;
    }

    if (
      before !== null &&
      after !== null &&
      typeof before === "object" &&
      typeof after === "object" &&
      !Array.isArray(before) &&
      !Array.isArray(after)
    ) {
      const beforeRecord = before as Record<string, unknown>;
      const afterRecord = after as Record<string, unknown>;
      const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
      for (const key of [...keys].sort()) {
        const nextPath = path ? `${path}.${key}` : key;
        if (!(key in beforeRecord)) entries.push({ path: nextPath, kind: "added", after: afterRecord[key] });
        else if (!(key in afterRecord)) entries.push({ path: nextPath, kind: "removed", before: beforeRecord[key] });
        else walk(beforeRecord[key], afterRecord[key], nextPath);
      }
      return;
    }

    entries.push({ path: path || "root", kind: "changed", before, after });
  }

  walk(left, right, "");
  return entries;
}

function pascalCase(value: string) {
  const result = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return result || "Value";
}

function singularize(value: string) {
  if (/ies$/i.test(value)) return `${value.slice(0, -3)}y`;
  if (/ses$/i.test(value)) return value.slice(0, -2);
  if (/s$/i.test(value) && !/ss$/i.test(value)) return value.slice(0, -1);
  return value;
}

export function jsonToTypescript(
  input: string,
  options: { rootName?: string; readonly?: boolean; semicolons?: boolean; mode?: "interface" | "type" } = {},
) {
  const value = parseJson(input);
  const rootName = pascalCase(options.rootName || "Root");
  const declarations: string[] = [];
  const usedNames = new Map<string, number>();
  const punctuation = options.semicolons === false ? "" : ";";
  const readonly = options.readonly ? "readonly " : "";
  const mode = options.mode ?? "interface";

  function uniqueName(base: string) {
    const clean = pascalCase(base);
    const count = usedNames.get(clean) ?? 0;
    usedNames.set(clean, count + 1);
    return count === 0 ? clean : `${clean}${count + 1}`;
  }

  function infer(item: unknown, suggestedName: string): string {
    if (item === null) return "null";
    if (Array.isArray(item)) {
      if (item.length === 0) return "unknown[]";
      const itemName = singularize(suggestedName);
      const types = [...new Set(item.slice(0, 50).map((child) => infer(child, itemName)))];
      const union = types.join(" | ");
      return types.length > 1 ? `(${union})[]` : `${union}[]`;
    }
    if (typeof item !== "object") return typeof item;

    const name = uniqueName(suggestedName);
    const fields = Object.entries(item as Record<string, unknown>).map(([key, child]) => {
      const safeKey = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
      return `  ${readonly}${safeKey}: ${infer(child, key)}${punctuation}`;
    });
    const body = fields.length ? `\n${fields.join("\n")}\n` : "";
    declarations.push(
      mode === "interface"
        ? `export interface ${name} {${body}}`
        : `export type ${name} = {${body}}${punctuation}`,
    );
    return name;
  }

  const resolvedRoot = infer(value, rootName);
  if (resolvedRoot !== rootName && (typeof value !== "object" || value === null || Array.isArray(value))) {
    declarations.push(`export type ${rootName} = ${resolvedRoot}${punctuation}`);
  }
  return declarations.reverse().join("\n\n");
}

export function diffText(left: string, right: string, ignoreWhitespace = false): DiffLine[] {
  const a = left.split("\n");
  const b = right.split("\n");
  const normalize = (line: string) => (ignoreWhitespace ? line.replace(/\s+/g, " ").trim() : line);

  if (a.length * b.length > 1_000_000) {
    const max = Math.max(a.length, b.length);
    const result: DiffLine[] = [];
    for (let index = 0; index < max; index += 1) {
      if (index >= a.length) result.push({ kind: "added", value: b[index], newLine: index + 1 });
      else if (index >= b.length) result.push({ kind: "removed", value: a[index], oldLine: index + 1 });
      else if (normalize(a[index]) === normalize(b[index])) result.push({ kind: "same", value: a[index], oldLine: index + 1, newLine: index + 1 });
      else {
        result.push({ kind: "removed", value: a[index], oldLine: index + 1 });
        result.push({ kind: "added", value: b[index], newLine: index + 1 });
      }
    }
    return result;
  }

  const matrix = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      matrix[i][j] = normalize(a[i]) === normalize(b[j])
        ? matrix[i + 1][j + 1] + 1
        : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (normalize(a[i]) === normalize(b[j])) {
      result.push({ kind: "same", value: a[i], oldLine: i + 1, newLine: j + 1 });
      i += 1;
      j += 1;
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
      result.push({ kind: "removed", value: a[i], oldLine: i + 1 });
      i += 1;
    } else {
      result.push({ kind: "added", value: b[j], newLine: j + 1 });
      j += 1;
    }
  }
  while (i < a.length) result.push({ kind: "removed", value: a[i], oldLine: ++i });
  while (j < b.length) result.push({ kind: "added", value: b[j], newLine: ++j });
  return result;
}

function detectDelimiter(input: string) {
  const firstRecord = input.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t"];
  return candidates.sort((a, b) => firstRecord.split(b).length - firstRecord.split(a).length)[0];
}

export function parseCsv(input: string): CsvResult {
  const delimiter = detectDelimiter(input);
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let malformed = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || (char === "\r" && next === "\n")) && !quoted) {
      row.push(cell);
      records.push(row);
      row = [];
      cell = "";
      if (char === "\r") index += 1;
    } else {
      cell += char;
    }
  }
  if (quoted) malformed = true;
  if (cell.length || row.length) {
    row.push(cell);
    records.push(row);
  }

  const headers = records.shift() ?? [];
  if (records.some((record) => record.length !== headers.length)) malformed = true;
  return { delimiter, headers, rows: records, malformed };
}

export function decodeJwt(input: string) {
  const parts = input.trim().split(".");
  if (parts.length !== 3) throw new Error("Expected a JWT with three dot-separated sections.");
  const decode = (segment: string) => {
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  };
  return { header: decode(parts[0]), payload: decode(parts[1]), signature: parts[2] };
}

export function textStats(input: string) {
  const trimmed = input.trim();
  const words = trimmed ? trimmed.split(/\s+/u).length : 0;
  return {
    characters: input.length,
    charactersNoSpaces: input.replace(/\s/g, "").length,
    words,
    lines: input ? input.split(/\r?\n/).length : 0,
    paragraphs: trimmed ? trimmed.split(/\n\s*\n/).length : 0,
    sentences: trimmed ? (trimmed.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? []).length : 0,
    readingTime: Math.max(words ? 1 : 0, Math.ceil(words / 225)),
    bytes: encoder.encode(input).byteLength,
  };
}

function wordsForCase(input: string) {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function convertCase(input: string, mode: string) {
  const words = wordsForCase(input);
  const lower = words.map((word) => word.toLocaleLowerCase());
  const cap = (word: string) => word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase();
  switch (mode) {
    case "upper": return input.toLocaleUpperCase();
    case "lower": return input.toLocaleLowerCase();
    case "title": return words.map(cap).join(" ");
    case "sentence": return lower.length ? cap(lower.join(" ")) : "";
    case "camel": return lower.map((word, index) => (index ? cap(word) : word)).join("");
    case "pascal": return lower.map(cap).join("");
    case "snake": return lower.join("_");
    case "kebab": return lower.join("-");
    default: return input;
  }
}

type CronField = { source: string; values: Set<number> };

function parseCronField(source: string, min: number, max: number): CronField {
  const values = new Set<number>();
  const addRange = (start: number, end: number, step = 1) => {
    if (start < min || end > max || start > end || step < 1) throw new Error(`Value must be between ${min} and ${max}.`);
    for (let value = start; value <= end; value += step) values.add(value);
  };

  for (const part of source.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart ? Number(stepPart) : 1;
    if (!Number.isInteger(step)) throw new Error("Cron steps must be whole numbers.");
    if (rangePart === "*") addRange(min, max, step);
    else if (rangePart.includes("-")) {
      const [start, end] = rangePart.split("-").map(Number);
      addRange(start, end, step);
    } else {
      const value = Number(rangePart);
      if (!Number.isInteger(value)) throw new Error("Cron fields must contain numbers, ranges, lists, steps, or *.");
      addRange(value, value, step);
    }
  }
  return { source, values };
}

export function parseCron(input: string) {
  const parts = input.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`Expected 5 fields but received ${parts.length}. Six-field cron syntax is not supported.`);
  const fields = [
    parseCronField(parts[0], 0, 59),
    parseCronField(parts[1], 0, 23),
    parseCronField(parts[2], 1, 31),
    parseCronField(parts[3], 1, 12),
    parseCronField(parts[4], 0, 6),
  ];
  return { parts, fields };
}

export function explainCron(input: string) {
  const { parts, fields } = parseCron(input);
  let explanation = `Runs when minute is ${parts[0]}, hour is ${parts[1]}, day is ${parts[2]}, month is ${parts[3]}, and weekday is ${parts[4]}.`;
  if (parts[0] === "0" && /^\d+$/.test(parts[1]) && parts[2] === "*" && parts[3] === "*") {
    const hour = Number(parts[1]);
    const time = new Date(2020, 0, 1, hour, 0).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (parts[4] === "1-5") explanation = `At ${time} every Monday through Friday.`;
    else if (parts[4] === "*") explanation = `At ${time} every day.`;
  }

  const occurrences: Date[] = [];
  const cursor = new Date();
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  for (let attempt = 0; attempt < 525_600 && occurrences.length < 5; attempt += 1) {
    if (
      fields[0].values.has(cursor.getMinutes()) &&
      fields[1].values.has(cursor.getHours()) &&
      fields[2].values.has(cursor.getDate()) &&
      fields[3].values.has(cursor.getMonth() + 1) &&
      fields[4].values.has(cursor.getDay())
    ) occurrences.push(new Date(cursor));
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return { explanation, parts, occurrences: occurrences.map((date) => date.toISOString()) };
}
