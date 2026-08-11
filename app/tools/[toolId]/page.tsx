import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolWorkspace } from "../../components/ToolWorkspace";
import { getTool, tools, type ToolId } from "../../lib/tools";

export function generateStaticParams() {
  return tools.map((tool) => ({ toolId: tool.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ toolId: string }> }): Promise<Metadata> {
  const { toolId } = await params;
  const tool = getTool(toolId);
  if (!tool) return {};
  return {
    title: tool.name,
    description: `${tool.description} Runs locally in your browser with QuickKit.`,
  };
}

export default async function ToolRoute({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  if (!getTool(toolId)) notFound();
  return <ToolWorkspace toolId={toolId as ToolId} />;
}
