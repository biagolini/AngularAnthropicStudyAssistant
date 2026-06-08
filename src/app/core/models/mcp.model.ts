export interface McpServerEntry {
  id: string;
  name: string;
  description: string;
  url: string;
}

export const MCP_CATALOG: McpServerEntry[] = [
  {
    id: 'aws-knowledge',
    name: 'AWS Knowledge',
    description:
      'Search official AWS documentation, API references, and best practices. Useful for AWS-focused certifications.',
    url: 'https://knowledge-mcp.global.api.aws',
  },
];

export const MCP_BETA_HEADER = 'mcp-client-2025-04-04';

export function findMcpEntry(id: string): McpServerEntry | undefined {
  return MCP_CATALOG.find((entry) => entry.id === id);
}

export function resolveEnabledMcps(enabledIds: string[]): McpServerEntry[] {
  if (!enabledIds || enabledIds.length === 0) return [];
  return enabledIds
    .map((id) => findMcpEntry(id))
    .filter((entry): entry is McpServerEntry => !!entry);
}
