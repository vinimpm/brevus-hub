import type { LocalTool } from './types';
import { searchCodebaseTool, readFileTool } from './code';
import { getMetrics } from './metrics';
import { fetchUrl } from './web';
import { writeFinding, publishKnowledge, readSharedKnowledge } from './memory';
import { dependencyAudit, secretScan } from './security';

// Mapa slug (do tool-registry) -> implementação LocalTool.
// 'web_search' NÃO está aqui: é tratada como server-tool nativa da Anthropic
// no orquestrador. 'social_listening' fica para quando houver credenciais.
export const LOCAL_TOOLS: Record<string, LocalTool> = {
  search_codebase: searchCodebaseTool,
  read_file: readFileTool,
  get_metrics: getMetrics,
  fetch_url: fetchUrl,
  write_finding: writeFinding,
  publish_knowledge: publishKnowledge,
  read_shared_knowledge: readSharedKnowledge,
  dependency_audit: dependencyAudit,
  secret_scan: secretScan,
};

export function getLocalTool(slug: string): LocalTool | undefined {
  return LOCAL_TOOLS[slug];
}
