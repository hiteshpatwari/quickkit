"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { getTool, type ToolDefinition, type ToolId } from "../lib/tools";
import {
  convertCase,
  decodeJwt,
  explainCron,
  textStats,
  type CsvResult,
  type DiffLine,
  type JsonDiffEntry,
  type JsonResult,
} from "../lib/operations";
import { runToolTask } from "../lib/worker-client";
import { useQuickKit } from "./AppChrome";

const examples = {
  json: `{"project":"QuickKit","private":true,"tools":["formatter","diff","viewer"],"limits":{"uploadBytes":0,"worker":true}}`,
  jsonA: `{"user":{"name":"Alex","active":true,"roles":["editor"]},"version":1}`,
  jsonB: `{"user":{"name":"Alexander","active":false,"roles":["editor","admin"]},"version":2}`,
  textA: `QuickKit runs locally.\nYour data stays in your browser.\nNo account required.`,
  textB: `QuickKit works locally.\nYour data stays in your browser.\nNo account needed.`,
  csv: `name,category,local\nJSON Formatter,Data,true\nRegex Tester,Text,true\nJWT Decoder,Developer,true\nCSV Viewer,Files,true`,
  jwt: `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJkZW1vLXVzZXIiLCJpc3MiOiJRdWlja0tpdCIsImlhdCI6MTc4NjMwMDAwMCwiZXhwIjoyMDUwMDAwMDAwfQ.demo-signature`,
};

const CLOCK_NOW = Date.now();

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function toDisplay(value: unknown) {
  if (typeof value === "string") return JSON.stringify(value);
  const serialized = JSON.stringify(value);
  return serialized === undefined ? String(value) : serialized;
}

async function copyText(value: string) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    throw new Error("Clipboard access was blocked. Use Ctrl/Cmd + C instead.");
  }
}

function downloadText(value: string, filename: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function PrivacyBadge({ sensitive = false }: { sensitive?: boolean }) {
  return (
    <details className="privacy-badge">
      <summary><span aria-hidden="true">●</span> Runs locally</summary>
      <div>Your content is processed using browser JavaScript and is not sent to QuickKit servers.{sensitive ? " This input is never persisted." : ""}</div>
    </details>
  );
}

function ToolHeader({ tool }: { tool: ToolDefinition }) {
  const { favorites, toggleFavorite } = useQuickKit();
  const favorite = favorites.includes(tool.id);
  return (
    <header className="tool-header">
      <div className="tool-breadcrumb"><Link href="/">Tools</Link><span>/</span><span>{tool.category}</span></div>
      <div className="tool-heading-row">
        <div className="tool-heading-icon" aria-hidden="true">{tool.icon}</div>
        <div><h1>{tool.name}</h1><p>{tool.description}</p></div>
        <div className="tool-heading-actions">
          <PrivacyBadge sensitive={tool.sensitive} />
          <button className={`favorite-button tool-favorite ${favorite ? "is-favorite" : ""}`} onClick={() => toggleFavorite(tool.id)} aria-pressed={favorite} aria-label={`${favorite ? "Remove from" : "Add to"} favorites`}>{favorite ? "★" : "☆"}</button>
        </div>
      </div>
    </header>
  );
}

function Panel({ title, meta, actions, children, className = "" }: { title: string; meta?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`workspace-panel ${className}`}>
      <header><div><strong>{title}</strong>{meta && <small>{meta}</small>}</div><div className="panel-actions">{actions}</div></header>
      {children}
    </section>
  );
}

function ActionButton({ children, onClick, variant = "secondary", disabled = false, title }: { children: ReactNode; onClick: () => void; variant?: "primary" | "secondary" | "quiet"; disabled?: boolean; title?: string }) {
  return <button type="button" className={`button ${variant}`} onClick={onClick} disabled={disabled} title={title}>{children}</button>;
}

function Status({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return <div className={`tool-status ${error ? "error" : "success"}`} role="status">{error || message}</div>;
}

function FileActions({ accept, onLoad }: { accept: string; onLoad: (content: string, name: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onLoad(String(reader.result ?? ""), file.name);
    reader.readAsText(file);
  };
  return (
    <>
      <button className="text-button" onClick={() => inputRef.current?.click()}>Upload</button>
      <input ref={inputRef} className="sr-only" type="file" accept={accept} onChange={(event) => handleFile(event.target.files?.[0])} />
    </>
  );
}

function DropOverlay({ onLoad, children }: { onLoad: (content: string, name: string) => void; children: ReactNode }) {
  const [dragging, setDragging] = useState(false);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onLoad(String(reader.result ?? ""), file.name);
    reader.readAsText(file);
  };
  return <div className={`drop-surface ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>{children}{dragging && <div className="drop-message">Drop file to load locally</div>}</div>;
}

function ToolDocs({ tool, shortcuts = "Cmd/Ctrl + Enter to run · Cmd/Ctrl + Shift + C to copy" }: { tool: ToolDefinition; shortcuts?: string }) {
  return (
    <details className="tool-docs">
      <summary>About this tool</summary>
      <div className="tool-doc-grid"><div><span>What it does</span><p>{tool.description}</p></div><div><span>Data handling</span><p>Processing: Browser<br />Persistence: {tool.sensitive ? "Never" : "None"}<br />Network: None</p></div><div><span>Keyboard</span><p>{shortcuts}</p></div></div>
    </details>
  );
}

function JsonFormatter({ tool }: { tool: ToolDefinition }) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<JsonResult>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [workerMs, setWorkerMs] = useState<number>();
  const [indent, setIndent] = useState(2);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("quickkit.settings") ?? "{}") as { indentation?: number };
        if (saved.indentation === 4) setIndent(4);
      } catch { /* Preferences are optional. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const run = useCallback(async (mode: "format" | "minify") => {
    if (!input.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await runToolTask<JsonResult>("format-json", { input, mode, indent });
      setResult(response.data);
      setWorkerMs(response.metrics?.workerMs);
    } catch (runError) {
      setResult(undefined);
      setError(runError instanceof Error ? runError.message : "Invalid JSON");
    } finally { setBusy(false); }
  }, [input, indent]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void run("format"); }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "c" && result?.output) { event.preventDefault(); void copyText(result.output); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, result]);

  return (
    <>
      <div className="tool-toolbar"><div><ActionButton variant="primary" onClick={() => void run("format")} disabled={busy}>{busy ? "Formatting…" : "Format"}</ActionButton><ActionButton onClick={() => void run("minify")} disabled={busy}>Minify</ActionButton><ActionButton variant="quiet" onClick={() => { setInput(""); setResult(undefined); setError(""); }}>Clear</ActionButton></div><label>Indent <select value={indent} onChange={(event) => setIndent(Number(event.target.value))}><option value="2">2 spaces</option><option value="4">4 spaces</option></select></label></div>
      <Status error={error} message={result ? `Valid JSON · processed locally${workerMs !== undefined ? ` in ${workerMs.toFixed(1)} ms` : ""}` : undefined} />
      <div className="split-workspace">
        <Panel title="Input" meta={input ? formatBytes(new TextEncoder().encode(input).byteLength) : "JSON"} actions={<><FileActions accept=".json,application/json" onLoad={(content) => setInput(content)} /><button className="text-button" onClick={() => setInput(examples.json)}>Example</button></>}>
          <DropOverlay onLoad={(content) => setInput(content)}><textarea className="code-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder={'Paste JSON here\n\nor drop a .json file'} spellCheck={false} aria-label="JSON input" /></DropOverlay>
        </Panel>
        <Panel title="Output" meta={result ? "Formatted JSON" : "Waiting for input"} actions={<><button className="text-button" disabled={!result} onClick={() => result && void copyText(result.output)}>Copy</button><button className="text-button" disabled={!result} onClick={() => result && downloadText(result.output, "quickkit-output.json", "application/json")}>Download</button></>}>
          <textarea className="code-input output" value={result?.output ?? ""} readOnly placeholder="Your formatted JSON will appear here." aria-label="Formatted JSON output" />
        </Panel>
      </div>
      {result && <div className="stat-strip"><div><span>Objects</span><strong>{result.stats.objects}</strong></div><div><span>Arrays</span><strong>{result.stats.arrays}</strong></div><div><span>Keys</span><strong>{result.stats.keys}</strong></div><div><span>Max depth</span><strong>{result.stats.maxDepth}</strong></div><div><span>Input size</span><strong>{formatBytes(result.stats.bytes)}</strong></div></div>}
      <ToolDocs tool={tool} />
    </>
  );
}

function JsonDiff({ tool }: { tool: ToolDefinition }) {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [entries, setEntries] = useState<JsonDiffEntry[]>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); setError("");
    try { setEntries((await runToolTask<JsonDiffEntry[]>("json-diff", { left, right })).data); }
    catch (runError) { setEntries(undefined); setError(runError instanceof Error ? runError.message : "Unable to compare JSON."); }
    finally { setBusy(false); }
  };
  return (
    <>
      <div className="tool-toolbar"><div><ActionButton variant="primary" onClick={() => void run()} disabled={busy || !left || !right}>{busy ? "Comparing…" : "Compare JSON"}</ActionButton><ActionButton onClick={() => { const old = left; setLeft(right); setRight(old); }}>Swap</ActionButton><ActionButton variant="quiet" onClick={() => { setLeft(""); setRight(""); setEntries(undefined); }}>Clear</ActionButton></div><button className="text-button" onClick={() => { setLeft(examples.jsonA); setRight(examples.jsonB); }}>Load example</button></div>
      <Status error={error} message={entries ? `${entries.length} structural ${entries.length === 1 ? "change" : "changes"} found.` : undefined} />
      <div className="split-workspace compact"><Panel title="JSON A"><textarea className="code-input" value={left} onChange={(event) => setLeft(event.target.value)} placeholder="Paste the original JSON" spellCheck={false} /></Panel><Panel title="JSON B"><textarea className="code-input" value={right} onChange={(event) => setRight(event.target.value)} placeholder="Paste the changed JSON" spellCheck={false} /></Panel></div>
      <Panel title="Structural changes" meta="Formatting differences are ignored" className="result-panel">
        <div className="diff-results">
          {entries ? (entries.length ? entries.map((entry, index) => <div className={`json-change ${entry.kind}`} key={`${entry.path}-${index}`}><span className="change-kind">{entry.kind}</span><code>{entry.path}</code><div>{entry.kind !== "added" && <del>{toDisplay(entry.before)}</del>}{entry.kind === "changed" && <span aria-hidden="true">→</span>}{entry.kind !== "removed" && <ins>{toDisplay(entry.after)}</ins>}</div></div>) : <div className="empty-state inline"><strong>No structural differences.</strong></div>) : <div className="empty-state inline"><p>Compare two JSON documents to see added, removed, and changed values.</p></div>}
        </div>
      </Panel>
      <ToolDocs tool={tool} />
    </>
  );
}

function JsonToTypescript({ tool }: { tool: ToolDefinition }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [rootName, setRootName] = useState("Root");
  const [readonly, setReadonly] = useState(false);
  const [semicolons, setSemicolons] = useState(true);
  const [mode, setMode] = useState<"interface" | "type">("interface");
  const run = async () => {
    setError("");
    try { setOutput((await runToolTask<string>("json-to-typescript", { input, options: { rootName, readonly, semicolons, mode } })).data ?? ""); }
    catch (runError) { setOutput(""); setError(runError instanceof Error ? runError.message : "Unable to infer types."); }
  };
  return (
    <>
      <div className="tool-toolbar wrap"><div><ActionButton variant="primary" onClick={() => void run()} disabled={!input}>Generate types</ActionButton><ActionButton variant="quiet" onClick={() => { setInput(""); setOutput(""); }}>Clear</ActionButton></div><div className="option-row"><label>Root name <input value={rootName} onChange={(event) => setRootName(event.target.value)} /></label><label>Style <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="interface">Interfaces</option><option value="type">Type aliases</option></select></label><label className="mini-check"><input type="checkbox" checked={readonly} onChange={(event) => setReadonly(event.target.checked)} /> Readonly</label><label className="mini-check"><input type="checkbox" checked={semicolons} onChange={(event) => setSemicolons(event.target.checked)} /> Semicolons</label></div></div>
      <Status error={error} message={output ? "TypeScript generated locally." : undefined} />
      <div className="split-workspace"><Panel title="Input JSON" actions={<button className="text-button" onClick={() => setInput(examples.json)}>Example</button>}><textarea className="code-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Paste JSON to infer its shape" spellCheck={false} /></Panel><Panel title="TypeScript" actions={<><button className="text-button" disabled={!output} onClick={() => void copyText(output)}>Copy</button><button className="text-button" disabled={!output} onClick={() => downloadText(output, "quickkit-types.ts", "text/typescript")}>Download</button></>}><textarea className="code-input output" value={output} readOnly placeholder="Generated interfaces will appear here." spellCheck={false} /></Panel></div>
      <ToolDocs tool={tool} />
    </>
  );
}

function TextDiff({ tool }: { tool: ToolDefinition }) {
  const [left, setLeft] = useState(""); const [right, setRight] = useState("");
  const [lines, setLines] = useState<DiffLine[]>(); const [error, setError] = useState("");
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const run = async () => { try { setError(""); setLines((await runToolTask<DiffLine[]>("text-diff", { left, right, ignoreWhitespace })).data); } catch (runError) { setError(runError instanceof Error ? runError.message : "Diff failed."); } };
  const unified = lines?.map((line) => `${line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " "} ${line.value}`).join("\n") ?? "";
  return (
    <><div className="tool-toolbar"><div><ActionButton variant="primary" onClick={() => void run()} disabled={!left && !right}>Compare text</ActionButton><ActionButton onClick={() => { const old = left; setLeft(right); setRight(old); }}>Swap</ActionButton><ActionButton variant="quiet" onClick={() => { setLeft(""); setRight(""); setLines(undefined); }}>Clear</ActionButton></div><label className="mini-check"><input type="checkbox" checked={ignoreWhitespace} onChange={(event) => setIgnoreWhitespace(event.target.checked)} /> Ignore whitespace</label></div>
      <Status error={error} message={lines ? `${lines.filter((line) => line.kind !== "same").length} changed lines.` : undefined} />
      <div className="split-workspace compact"><Panel title="Original" actions={<button className="text-button" onClick={() => setLeft(examples.textA)}>Example</button>}><textarea className="code-input text-mode" value={left} onChange={(event) => setLeft(event.target.value)} placeholder="Paste original text" /></Panel><Panel title="Changed" actions={<button className="text-button" onClick={() => setRight(examples.textB)}>Example</button>}><textarea className="code-input text-mode" value={right} onChange={(event) => setRight(event.target.value)} placeholder="Paste changed text" /></Panel></div>
      <Panel title="Unified diff" actions={<button className="text-button" disabled={!unified} onClick={() => void copyText(unified)}>Copy result</button>} className="result-panel"><div className="line-diff">{lines ? lines.map((line, index) => <div key={index} className={line.kind}><span>{line.oldLine ?? ""}</span><span>{line.newLine ?? ""}</span><b>{line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "}</b><code>{line.value || " "}</code></div>) : <div className="empty-state inline"><p>Compare two blocks to see a line-level diff.</p></div>}</div></Panel><ToolDocs tool={tool} /></>
  );
}

function RegexTester({ tool }: { tool: ToolDefinition }) {
  const [pattern, setPattern] = useState(""); const [flags, setFlags] = useState("g"); const [text, setText] = useState("");
  const result = useMemo(() => {
    if (!pattern) return { matches: [] as { value: string; index: number; groups: string[] }[], error: "" };
    try {
      const safeFlags = flags.includes("g") ? flags : `${flags}g`;
      const regex = new RegExp(pattern, [...new Set(safeFlags)].join(""));
      const matches: { value: string; index: number; groups: string[] }[] = [];
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) && matches.length < 1000) {
        matches.push({ value: match[0], index: match.index, groups: match.slice(1) });
        if (match[0] === "") regex.lastIndex += 1;
      }
      return { matches, error: "" };
    } catch (error) { return { matches: [], error: error instanceof Error ? error.message : "Invalid regular expression" }; }
  }, [pattern, flags, text]);
  return (
    <><div className="regex-controls"><label><span>Pattern</span><div className="pattern-input"><b>/</b><input value={pattern} onChange={(event) => setPattern(event.target.value)} placeholder="e.g. ([A-Za-z]+)(\d+)" spellCheck={false} /><b>/</b></div></label><label className="flags-input"><span>Flags</span><input value={flags} onChange={(event) => setFlags(event.target.value.replace(/[^dgimsuvy]/g, ""))} placeholder="gim" spellCheck={false} /></label><button className="text-button example-link" onClick={() => { setPattern("([A-Za-z]+)(\\d+)"); setFlags("gi"); setText("Ticket example42 matched. Backup code beta17 did too."); }}>Load example</button></div>
      <Status error={result.error} message={!result.error && pattern ? `${result.matches.length} ${result.matches.length === 1 ? "match" : "matches"}.` : undefined} />
      <div className="split-workspace"><Panel title="Test text"><textarea className="code-input text-mode" value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste text to test against the pattern" /></Panel><Panel title="Matches" meta="Live JavaScript RegExp results"><div className="match-list">{result.matches.length ? result.matches.map((match, index) => <article key={`${match.index}-${index}`}><header><strong>Match {index + 1}</strong><span>{match.index}–{match.index + match.value.length}</span></header><code>{match.value || "(empty match)"}</code>{match.groups.length > 0 && <div className="group-list">{match.groups.map((group, groupIndex) => <span key={groupIndex}><b>{groupIndex + 1}</b> {group ?? "undefined"}</span>)}</div>}</article>) : <div className="empty-state inline"><p>{pattern ? "No matches in the test text." : "Enter a pattern to inspect matches and groups."}</p></div>}</div></Panel></div><ToolDocs tool={tool} shortcuts="Results update as you type · Escape closes the command palette" /></>
  );
}

function TextInspector({ tool }: { tool: ToolDefinition }) {
  const [input, setInput] = useState(""); const stats = useMemo(() => textStats(input), [input]);
  const transform = (mode: string) => setInput(convertCase(input, mode));
  return (
    <><div className="tool-toolbar wrap"><div><ActionButton onClick={() => setInput(input.trim())}>Trim</ActionButton><ActionButton onClick={() => setInput(input.replace(/^\s*$(?:\r?\n)?/gm, ""))}>Remove blank lines</ActionButton><ActionButton onClick={() => setInput(input.replace(/[ \t]+/g, " "))}>Normalize spaces</ActionButton><ActionButton onClick={() => setInput([...new Set(input.split(/\r?\n/))].join("\n"))}>Dedupe lines</ActionButton><ActionButton variant="quiet" onClick={() => setInput("")}>Clear</ActionButton></div></div>
      <div className="inspector-layout"><Panel title="Text" actions={<button className="text-button" onClick={() => setInput("QuickKit turns small browser tasks into fast, private workflows.\n\nPaste text here to inspect it.")}>Example</button>}><textarea className="code-input text-mode tall" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Paste or type text to inspect it" /></Panel><aside className="metric-panel"><p className="eyebrow">Live analysis</p>{Object.entries({ Characters: stats.characters, "Without spaces": stats.charactersNoSpaces, Words: stats.words, Lines: stats.lines, Paragraphs: stats.paragraphs, Sentences: stats.sentences, "Reading time": `${stats.readingTime} min`, "Byte size": formatBytes(stats.bytes) }).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</aside></div>
      <section className="case-tools"><header><strong>Convert case</strong><span>Transformations only happen when selected.</span></header><div>{[["upper", "UPPERCASE"], ["lower", "lowercase"], ["title", "Title Case"], ["sentence", "Sentence case"], ["camel", "camelCase"], ["pascal", "PascalCase"], ["snake", "snake_case"], ["kebab", "kebab-case"]].map(([mode, label]) => <button key={mode} onClick={() => transform(mode)}>{label}</button>)}</div></section><ToolDocs tool={tool} />
    </>
  );
}

function JwtDecoder({ tool }: { tool: ToolDefinition }) {
  const [input, setInput] = useState("");
  const decoded = useMemo(() => { if (!input.trim()) return { data: undefined, error: "" }; try { return { data: decodeJwt(input), error: "" }; } catch (error) { return { data: undefined, error: error instanceof Error ? error.message : "Invalid JWT" }; } }, [input]);
  const payload = decoded.data?.payload;
  const exp = typeof payload?.exp === "number" ? new Date(payload.exp * 1000) : undefined;
  const nbf = typeof payload?.nbf === "number" ? new Date(payload.nbf * 1000) : undefined;
  const timeStatus = exp && exp.getTime() < CLOCK_NOW ? "Expired" : nbf && nbf.getTime() > CLOCK_NOW ? "Not active yet" : exp || nbf ? "Valid time window" : "No expiration claim";
  return (
    <><div className="jwt-warning"><strong>Decoded, not verified.</strong><span>QuickKit does not verify this token’s signature or authenticity.</span></div><Panel title="JWT input" meta="Never persisted" actions={<><button className="text-button" onClick={() => setInput(examples.jwt)}>Demo token</button><button className="text-button" onClick={() => setInput("")}>Clear</button></>}><textarea className="code-input jwt-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Paste a three-part JWT here" spellCheck={false} /></Panel><Status error={decoded.error} message={decoded.data ? `Token decoded locally · ${timeStatus}` : undefined} />
      {decoded.data ? <div className="jwt-results"><Panel title="Header" actions={<button className="text-button" onClick={() => void copyText(JSON.stringify(decoded.data!.header, null, 2))}>Copy</button>}><pre>{JSON.stringify(decoded.data.header, null, 2)}</pre></Panel><Panel title="Payload" actions={<button className="text-button" onClick={() => void copyText(JSON.stringify(decoded.data!.payload, null, 2))}>Copy</button>}><pre>{JSON.stringify(decoded.data.payload, null, 2)}</pre></Panel><aside className="claims-panel"><p className="eyebrow">Claim status</p><strong className={`claim-status ${timeStatus === "Expired" ? "bad" : ""}`}>{timeStatus}</strong>{Object.entries(decoded.data.payload).filter(([key]) => ["iss", "sub", "aud", "exp", "nbf", "iat", "jti"].includes(key)).map(([key, value]) => <div key={key}><code>{key}</code><span>{["exp", "nbf", "iat"].includes(key) && typeof value === "number" ? <>{String(value)}<small>{new Date(value * 1000).toLocaleString()}</small></> : String(value)}</span></div>)}<p>This reflects claim timestamps only. It is not cryptographic validation.</p></aside></div> : <div className="empty-state large"><strong>Demo token available</strong><p>Use the fictional demo token to explore header, payload, and time claims.</p></div>}<ToolDocs tool={tool} />
    </>
  );
}

function UrlInspector({ tool }: { tool: ToolDefinition }) {
  const [input, setInput] = useState("https://example.com:443/path/to/page?q=test&page=2#section");
  const parsed = useMemo(() => { try { return { url: new URL(input), error: "" }; } catch { return { url: undefined, error: "Enter a complete URL, including its protocol." }; } }, [input]);
  const updateParam = (index: number, kind: "key" | "value", value: string) => {
    if (!parsed.url) return;
    const entries = [...parsed.url.searchParams.entries()];
    entries[index][kind === "key" ? 0 : 1] = value;
    const nextUrl = new URL(parsed.url.toString());
    nextUrl.search = "";
    entries.forEach(([key, itemValue]) => nextUrl.searchParams.append(key, itemValue));
    setInput(nextUrl.toString());
  };
  const removeParam = (index: number) => {
    if (!parsed.url) return;
    const entries = [...parsed.url.searchParams.entries()].filter((_, itemIndex) => itemIndex !== index);
    const nextUrl = new URL(parsed.url.toString());
    nextUrl.search = ""; entries.forEach(([key, value]) => nextUrl.searchParams.append(key, value)); setInput(nextUrl.toString());
  };
  const parts = parsed.url ? [["Protocol", parsed.url.protocol], ["Origin", parsed.url.origin], ["Host", parsed.url.host], ["Hostname", parsed.url.hostname], ["Port", parsed.url.port || "—"], ["Path", parsed.url.pathname], ["Hash", parsed.url.hash || "—"]] : [];
  return (
    <><Panel title="URL" actions={<button className="text-button" onClick={() => void copyText(input)}>Copy</button>}><input className="large-url-input" value={input} onChange={(event) => setInput(event.target.value)} aria-label="URL to inspect" spellCheck={false} /></Panel><Status error={parsed.error} message={parsed.url ? "Valid URL · parsed by the browser URL API." : undefined} />
      {parsed.url && <div className="url-layout"><Panel title="Breakdown"><dl className="url-parts">{parts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><code>{value}</code></dd></div>)}</dl></Panel><Panel title="Query parameters" actions={<button className="text-button" onClick={() => { parsed.url!.searchParams.append("key", "value"); setInput(parsed.url!.toString()); }}>Add row</button>}><div className="query-table">{[...parsed.url.searchParams.entries()].map(([key, value], index) => <div key={`${key}-${index}`}><input aria-label={`Parameter ${index + 1} key`} value={key} onChange={(event) => updateParam(index, "key", event.target.value)} /><input aria-label={`Parameter ${index + 1} value`} value={value} onChange={(event) => updateParam(index, "value", event.target.value)} /><button aria-label={`Remove ${key}`} onClick={() => removeParam(index)}>×</button></div>)}{!parsed.url.searchParams.size && <div className="empty-state inline"><p>No query parameters.</p></div>}</div></Panel></div>}
      <section className="encode-tools"><div><span>Encode a component</span><input placeholder="hello world & more" onChange={(event) => { const output = event.currentTarget.nextElementSibling as HTMLInputElement; output.value = encodeURIComponent(event.target.value); }} /><input readOnly aria-label="Encoded component" /></div><div><span>Decode a component</span><input placeholder="hello%20world" onChange={(event) => { const output = event.currentTarget.nextElementSibling as HTMLInputElement; try { output.value = decodeURIComponent(event.target.value); } catch { output.value = "Invalid encoded component"; } }} /><input readOnly aria-label="Decoded component" /></div><p>Component encoding is for a query value or path segment—not an entire URL.</p></section><ToolDocs tool={tool} />
    </>
  );
}

function CronExplainer({ tool }: { tool: ToolDefinition }) {
  const [input, setInput] = useState("0 9 * * 1-5"); const [result, setResult] = useState<ReturnType<typeof explainCron>>(); const [error, setError] = useState("");
  const run = () => { try { setError(""); setResult(explainCron(input)); } catch (runError) { setResult(undefined); setError(runError instanceof Error ? runError.message : "Invalid cron expression"); } };
  const labels = ["Minute", "Hour", "Day", "Month", "Weekday"];
  return (
    <><div className="cron-entry"><label><span>Five-field cron expression</span><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && run()} spellCheck={false} /></label><ActionButton variant="primary" onClick={run}>Explain schedule</ActionButton></div><p className="format-note">Standard five-field cron: minute · hour · day of month · month · day of week. Browser timezone: <strong>{Intl.DateTimeFormat().resolvedOptions().timeZone}</strong></p><Status error={error} />
      {result && <><section className="cron-summary"><p className="eyebrow">Plain-language schedule</p><h2>{result.explanation}</h2></section><div className="cron-layout"><Panel title="Field map"><div className="cron-fields">{result.parts.map((part, index) => <div key={labels[index]}><span>{labels[index]}</span><code>{part}</code></div>)}</div></Panel><Panel title="Next 5 occurrences" meta={Intl.DateTimeFormat().resolvedOptions().timeZone}><ol className="occurrence-list">{result.occurrences.map((value) => <li key={value}><span>{new Date(value).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span><strong>{new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</strong></li>)}</ol></Panel></div></>}<ToolDocs tool={tool} />
    </>
  );
}

function CsvViewer({ tool }: { tool: ToolDefinition }) {
  const [input, setInput] = useState(""); const [fileName, setFileName] = useState(""); const [result, setResult] = useState<CsvResult>(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [filter, setFilter] = useState(""); const [sort, setSort] = useState<{ index: number; direction: 1 | -1 }>(); const [page, setPage] = useState(0);
  const load = (content: string, name = "") => { setInput(content); setFileName(name); setResult(undefined); setPage(0); };
  const parse = async () => { setBusy(true); setError(""); try { setResult((await runToolTask<CsvResult>("parse-csv", { input })).data); setPage(0); } catch (runError) { setError(runError instanceof Error ? runError.message : "CSV parsing failed."); } finally { setBusy(false); } };
  const rows = useMemo(() => {
    let next = result?.rows ?? [];
    if (filter) { const query = filter.toLowerCase(); next = next.filter((row) => row.some((cell) => cell.toLowerCase().includes(query))); }
    if (sort) next = [...next].sort((a, b) => a[sort.index].localeCompare(b[sort.index], undefined, { numeric: true }) * sort.direction);
    return next;
  }, [result, filter, sort]);
  const pageSize = 60; const visible = rows.slice(page * pageSize, page * pageSize + pageSize); const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  return (
    <><div className="tool-toolbar wrap"><div><ActionButton variant="primary" onClick={() => void parse()} disabled={!input || busy}>{busy ? "Parsing locally…" : "Open CSV"}</ActionButton><FileActions accept=".csv,text/csv" onLoad={load} /><ActionButton variant="quiet" onClick={() => { load(""); setFilter(""); }}>Clear</ActionButton></div>{result && <label className="inline-search compact-search"><span aria-hidden="true">⌕</span><input value={filter} onChange={(event) => { setFilter(event.target.value); setPage(0); }} placeholder="Filter all rows" /></label>}</div><Status error={error} message={result ? `${result.rows.length.toLocaleString()} rows parsed locally${result.malformed ? " · inconsistent rows detected" : ""}.` : undefined} />
      {!result ? <DropOverlay onLoad={load}><section className="csv-drop"><div className="drop-icon" aria-hidden="true">▦</div><h2>Drop a CSV file here</h2><p>Or paste CSV data below. Nothing is uploaded.</p><textarea value={input} onChange={(event) => load(event.target.value)} placeholder={examples.csv} aria-label="CSV input" spellCheck={false} /><button className="text-button" onClick={() => load(examples.csv, "quickkit-example.csv")}>Load example data</button>{fileName && <strong>{fileName}</strong>}</section></DropOverlay> : <><div className="stat-strip"><div><span>Rows</span><strong>{result.rows.length.toLocaleString()}</strong></div><div><span>Columns</span><strong>{result.headers.length}</strong></div><div><span>Delimiter</span><strong>{result.delimiter === "\t" ? "Tab" : result.delimiter}</strong></div><div><span>Input size</span><strong>{formatBytes(new TextEncoder().encode(input).byteLength)}</strong></div><div><span>Showing</span><strong>{rows.length.toLocaleString()}</strong></div></div><section className="csv-table-wrap" aria-label="CSV table"><table><thead><tr>{result.headers.map((header, index) => <th key={`${header}-${index}`}><button onClick={() => setSort((current) => current?.index === index ? { index, direction: current.direction === 1 ? -1 : 1 } : { index, direction: 1 })}>{header || `Column ${index + 1}`} {sort?.index === index ? (sort.direction === 1 ? "↑" : "↓") : ""}</button></th>)}</tr></thead><tbody>{visible.map((row, rowIndex) => <tr key={page * pageSize + rowIndex}>{result.headers.map((_, cellIndex) => <td key={cellIndex}><button title="Copy cell" onClick={() => void copyText(row[cellIndex] ?? "")}>{row[cellIndex] ?? ""}</button></td>)}</tr>)}</tbody></table></section><div className="pagination"><button disabled={page === 0} onClick={() => setPage((current) => current - 1)}>← Previous</button><span>Page {page + 1} of {pageCount}</span><button disabled={page + 1 >= pageCount} onClick={() => setPage((current) => current + 1)}>Next →</button></div></>}<ToolDocs tool={tool} shortcuts="Click a cell to copy · Click a heading to sort" />
    </>
  );
}

export function ToolWorkspace({ toolId }: { toolId: ToolId }) {
  const tool = getTool(toolId);
  if (!tool) return null;
  const contents: Record<ToolId, ReactNode> = {
    "json-formatter": <JsonFormatter tool={tool} />,
    "json-diff": <JsonDiff tool={tool} />,
    "json-to-typescript": <JsonToTypescript tool={tool} />,
    "text-diff": <TextDiff tool={tool} />,
    regex: <RegexTester tool={tool} />,
    "text-inspector": <TextInspector tool={tool} />,
    jwt: <JwtDecoder tool={tool} />,
    url: <UrlInspector tool={tool} />,
    cron: <CronExplainer tool={tool} />,
    csv: <CsvViewer tool={tool} />,
  };
  return <div className="tool-page"><ToolHeader tool={tool} /><div className="tool-workspace">{contents[toolId]}</div></div>;
}
