import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy", description: "How QuickKit processes, stores, and protects your tool content." };

export default function PrivacyPage() {
  return (
    <div className="page-wrap prose-page">
      <header className="page-title"><p className="eyebrow">No fine print</p><h1>Your data stays on your side of the glass.</h1><p>Most utility sites ask you to trust a server. QuickKit’s core tools don’t need one.</p></header>
      <section className="boundary-diagram" aria-label="QuickKit local processing boundary"><div><span>YOUR BROWSER</span><strong>Input</strong><b>→</b><strong>Background worker</strong><b>→</b><strong>Result</strong><small>Nothing crosses this boundary</small></div><aside><span>QUICKKIT SERVER</span><strong>No tool content received</strong><small>No accounts · No cloud storage · No analytics payloads</small></aside></section>
      <div className="prose-grid"><section><p className="eyebrow">01 · Processing</p><h2>Local by default</h2><p>JSON, text, JWTs, URLs, cron expressions, and CSV files are processed using JavaScript inside your browser. Larger jobs use a Web Worker so the interface remains responsive.</p></section><section><p className="eyebrow">02 · Persistence</p><h2>Inputs are disposable</h2><p>QuickKit does not save tool input or output. JWTs are never persisted. Favorites, theme, and lightweight settings are the only product data stored on this device.</p></section><section><p className="eyebrow">03 · Network</p><h2>No hidden uploads</h2><p>Core tools do not send their input over the network. The service worker caches application assets—not pasted content, files, tokens, or generated output.</p></section><section><p className="eyebrow">04 · AI boundary</p><h2>No AI in this version</h2><p>QuickKit does not currently include an AI-assisted feature. If one is introduced, it will be separately labeled, explicitly triggered, and limited to the minimum selected snippet.</p></section></div>
      <section className="data-table-section"><div><p className="eyebrow">Data handling inspector</p><h2>Every tool, plainly stated.</h2></div><div className="handling-table"><div className="handling-head"><span>Content</span><span>Processing</span><span>Persistence</span><span>Network</span></div>{[["JSON & text", "Browser / worker", "None", "None"], ["JWT tokens", "Browser", "Never", "None"], ["CSV files", "Browser / worker", "None", "None"], ["Preferences", "Browser", "This device", "None"]].map((row) => <div key={row[0]}>{row.map((cell, index) => <span key={cell} className={index > 0 ? "data-status" : ""}>{cell}</span>)}</div>)}</div></section>
    </div>
  );
}
