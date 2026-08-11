"use client";

import { useMemo, useRef, useState } from "react";
import { categories, searchTools, tools } from "../lib/tools";
import { ToolCard } from "./ToolCard";
import { useQuickKit } from "./AppChrome";

export function HomePage() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { favorites, openPalette } = useQuickKit();
  const results = useMemo(() => searchTools(query), [query]);
  const favoriteTools = tools.filter((tool) => favorites.includes(tool.id));

  return (
    <>
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> Private by design · No account</p>
          <h1>Tiny tools.<br /><em>Zero unnecessary uploads.</em></h1>
          <p className="hero-support">Format, inspect, convert, compare, and analyze data directly in your browser.</p>
        </div>
        <div className="hero-instrument" aria-hidden="true">
          <div className="instrument-top"><span>LOCAL PROCESSING</span><span>10 / 10 READY</span></div>
          <div className="instrument-flow"><span>INPUT</span><b>→</b><span>WORKER</span><b>→</b><span>RESULT</span></div>
          <div className="instrument-meter"><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <p>Network payload: <strong>0 bytes</strong></p>
        </div>
        <button className="hero-search" onClick={() => { inputRef.current?.focus(); openPalette(); }}>
          <span className="search-icon" aria-hidden="true">⌕</span>
          <span>Search 10 local tools…</span>
          <kbd>Ctrl K</kbd>
        </button>
      </section>

      <section className="tools-section" aria-labelledby="tools-heading">
        <div className="section-heading">
          <div><p className="eyebrow">Your browser is the backend</p><h2 id="tools-heading">Pick a tool. Get it done.</h2></div>
          <label className="inline-search">
            <span className="sr-only">Filter tools</span>
            <span aria-hidden="true">⌕</span>
            <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter tools" />
          </label>
        </div>

        {favoriteTools.length > 0 && !query && (
          <div className="category-block">
            <div className="category-label"><span>★</span><h2>Your favorites</h2><small>{favoriteTools.length}</small></div>
            <div className="tool-grid">{favoriteTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div>
          </div>
        )}

        {query ? (
          <div className="category-block">
            <div className="category-label"><span>⌕</span><h2>Search results</h2><small>{results.length}</small></div>
            {results.length ? <div className="tool-grid">{results.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div> : (
              <div className="empty-state"><strong>No matching tools.</strong><p>Try “json”, “text”, “url”, or “csv”.</p></div>
            )}
          </div>
        ) : (
          categories.map((category) => {
            const categoryTools = tools.filter((tool) => tool.category === category);
            return (
              <div className="category-block" key={category}>
                <div className="category-label"><span>{category === "Data" ? "{}" : category === "Text" ? "Aa" : category === "Developer" ? ">_" : "▦"}</span><h2>{category}</h2><small>{categoryTools.length}</small></div>
                <div className="tool-grid">{categoryTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div>
              </div>
            );
          })
        )}
      </section>

      <section className="privacy-callout">
        <div className="privacy-lock" aria-hidden="true">LOCAL<br />ONLY</div>
        <div><p className="eyebrow">A plain-language promise</p><h2>Your content stays on this device.</h2><p>QuickKit’s core tools use browser JavaScript and background workers. Your pasted text, JSON, tokens, and files are not sent to QuickKit servers.</p></div>
        <a href="/privacy" className="text-link">Read the privacy model <span aria-hidden="true">→</span></a>
      </section>
    </>
  );
}
