"use client";

import Link from "next/link";
import { tools } from "../lib/tools";
import { useQuickKit } from "./AppChrome";
import { ToolCard } from "./ToolCard";

export function FavoritesPage() {
  const { favorites } = useQuickKit();
  const selected = tools.filter((tool) => favorites.includes(tool.id));
  return (
    <div className="page-wrap">
      <header className="page-title"><p className="eyebrow">Saved on this device</p><h1>Your favorites</h1><p>Keep your most-used local tools one click away.</p></header>
      {selected.length ? <div className="tool-grid">{selected.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div> : (
        <div className="empty-state large"><strong>No favorites yet.</strong><p>Select the star on any tool to pin it here.</p><Link className="button primary" href="/">Browse tools</Link></div>
      )}
    </div>
  );
}
