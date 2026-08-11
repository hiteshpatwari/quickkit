export type ToolCategory = "Data" | "Text" | "Developer" | "Files";

export type ToolId =
  | "json-formatter"
  | "json-diff"
  | "json-to-typescript"
  | "text-diff"
  | "regex"
  | "text-inspector"
  | "jwt"
  | "url"
  | "cron"
  | "csv";

export type ToolDefinition = {
  id: ToolId;
  name: string;
  shortName: string;
  category: ToolCategory;
  description: string;
  route: string;
  keywords: string[];
  icon: string;
  sensitive?: boolean;
};

export const tools: ToolDefinition[] = [
  {
    id: "json-formatter",
    name: "JSON Formatter & Validator",
    shortName: "JSON Formatter",
    category: "Data",
    description: "Format, validate, minify, and inspect JSON.",
    route: "/tools/json-formatter",
    keywords: ["json", "pretty", "validate", "minify", "format"],
    icon: "{ }",
  },
  {
    id: "json-diff",
    name: "JSON Diff",
    shortName: "JSON Diff",
    category: "Data",
    description: "Compare JSON by structure, not whitespace.",
    route: "/tools/json-diff",
    keywords: ["json", "compare", "difference", "structural"],
    icon: "Δ",
  },
  {
    id: "json-to-typescript",
    name: "JSON to TypeScript",
    shortName: "JSON → TypeScript",
    category: "Data",
    description: "Infer readable TypeScript types from JSON.",
    route: "/tools/json-to-typescript",
    keywords: ["json", "typescript", "interface", "types", "convert"],
    icon: "TS",
  },
  {
    id: "text-diff",
    name: "Text Diff",
    shortName: "Text Diff",
    category: "Text",
    description: "Compare text line by line with clear changes.",
    route: "/tools/text-diff",
    keywords: ["text", "compare", "diff", "changes", "lines"],
    icon: "±",
  },
  {
    id: "regex",
    name: "Regex Tester",
    shortName: "Regex Tester",
    category: "Text",
    description: "Test JavaScript patterns and inspect matches.",
    route: "/tools/regex",
    keywords: ["regex", "regexp", "pattern", "match", "replace"],
    icon: ".*",
  },
  {
    id: "text-inspector",
    name: "Text Inspector",
    shortName: "Text Inspector",
    category: "Text",
    description: "Count, clean, and transform plain text.",
    route: "/tools/text-inspector",
    keywords: ["text", "count", "words", "case", "cleanup"],
    icon: "Aa",
  },
  {
    id: "jwt",
    name: "JWT Decoder",
    shortName: "JWT Decoder",
    category: "Developer",
    description: "Decode token structure and inspect time claims.",
    route: "/tools/jwt",
    keywords: ["jwt", "token", "decode", "claims", "expiry"],
    icon: "•••",
    sensitive: true,
  },
  {
    id: "url",
    name: "URL Inspector",
    shortName: "URL Inspector",
    category: "Developer",
    description: "Break down, edit, encode, and decode URLs.",
    route: "/tools/url",
    keywords: ["url", "uri", "query", "encode", "decode", "link"],
    icon: "↗",
  },
  {
    id: "cron",
    name: "Cron Explainer",
    shortName: "Cron Explainer",
    category: "Developer",
    description: "Understand five-field cron schedules.",
    route: "/tools/cron",
    keywords: ["cron", "schedule", "time", "job", "expression"],
    icon: "09",
  },
  {
    id: "csv",
    name: "CSV Viewer",
    shortName: "CSV Viewer",
    category: "Files",
    description: "Open, filter, sort, and inspect CSV locally.",
    route: "/tools/csv",
    keywords: ["csv", "table", "spreadsheet", "file", "data"],
    icon: "▦",
  },
];

export const categories: ToolCategory[] = ["Data", "Text", "Developer", "Files"];

export function getTool(id: string) {
  return tools.find((tool) => tool.id === id);
}

export function searchTools(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return tools;

  return tools
    .map((tool) => {
      const haystack = [
        tool.name,
        tool.shortName,
        tool.category,
        tool.description,
        ...tool.keywords,
      ]
        .join(" ")
        .toLowerCase();
      const starts = tool.name.toLowerCase().startsWith(normalized) ? 2 : 0;
      const exactKeyword = tool.keywords.includes(normalized) ? 1 : 0;
      return { tool, score: haystack.includes(normalized) ? 1 + starts + exactKeyword : 0 };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((result) => result.tool);
}
