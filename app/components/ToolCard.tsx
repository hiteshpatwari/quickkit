"use client";

import Link from "next/link";
import type { ToolDefinition } from "../lib/tools";
import { useQuickKit } from "./AppChrome";

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  const { favorites, toggleFavorite } = useQuickKit();
  const favorite = favorites.includes(tool.id);

  return (
    <article className="tool-card">
      <div className="tool-card-top">
        <span className="tool-glyph" aria-hidden="true">{tool.icon}</span>
        <button
          className={`favorite-button ${favorite ? "is-favorite" : ""}`}
          onClick={() => toggleFavorite(tool.id)}
          aria-label={`${favorite ? "Remove" : "Add"} ${tool.shortName} ${favorite ? "from" : "to"} favorites`}
          aria-pressed={favorite}
        >
          {favorite ? "★" : "☆"}
        </button>
      </div>
      <Link href={tool.route} className="tool-card-link">
        <h3>{tool.shortName}</h3>
        <p>{tool.description}</p>
        <span className="open-tool">Open tool <span aria-hidden="true">↗</span></span>
      </Link>
      <div className="local-label"><span aria-hidden="true">●</span> Runs locally</div>
    </article>
  );
}
