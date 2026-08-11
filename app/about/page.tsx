import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About & Architecture", description: "The product and browser architecture behind QuickKit." };

export default function AboutPage() {
  return (
    <div className="page-wrap prose-page">
      <header className="page-title"><p className="eyebrow">Product + engineering</p><h1>Small tools. Serious browser craft.</h1><p>QuickKit explores a simple question: how useful can a utility suite be when the browser does nearly all the work?</p></header>
      <section className="architecture-hero"><div><span>01</span><strong>Static registry</strong><p>One typed source powers routes, categories, search, favorites, and the command palette.</p></div><b>→</b><div><span>02</span><strong>Lazy route</strong><p>Each tool is loaded only when opened, keeping the home surface lean.</p></div><b>→</b><div><span>03</span><strong>Worker task</strong><p>Parsing, diffing, conversion, and large-file work move off the main thread.</p></div><b>→</b><div><span>04</span><strong>Local result</strong><p>Outputs return to the interface. Content is never written to product storage.</p></div></section>
      <div className="prose-grid"><section><p className="eyebrow">Architecture</p><h2>Built around boundaries</h2><p>The interface, worker runtime, persistence keys, and offline cache each have a narrow job. This keeps privacy claims auditable and future tools consistent.</p></section><section><p className="eyebrow">Performance</p><h2>Workers before spinners</h2><p>Heavy transformations use a shared request/response facade. Newer work can supersede stale results without freezing typing or navigation.</p></section><section><p className="eyebrow">Accessibility</p><h2>Keyboard is a first-class input</h2><p>Semantic controls, visible focus, readable contrast, reduced-motion support, shareable routes, and plain textareas keep tools usable without precision pointing.</p></section><section><p className="eyebrow">Trade-off</p><h2>Focused over exhaustive</h2><p>Ten well-integrated tools create more value than dozens of shallow ones. Accounts, cloud storage, a general chatbot, and server-side file processing are intentional non-goals.</p></section></div>
      <section className="about-cta"><div><p className="eyebrow">Try the signature flow</p><h2>Open JSON Formatter and watch the browser do the work.</h2></div><Link className="button primary" href="/tools/json-formatter">Open JSON Formatter →</Link></section>
    </div>
  );
}
