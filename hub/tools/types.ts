import type Anthropic from '@anthropic-ai/sdk';

// Contexto de execução passado para os handlers das tools.
export interface ToolContext {
  agentId: string;
  agentSlug: string;
  runId: string;
  /** ids dos agentes-filhos (para delegação do orquestrador). */
  childAgentIds: string[];
}

// Definição de uma tool local: schema (formato Anthropic) + handler.
export interface LocalTool {
  schema: Anthropic.Tool;
  handler: (input: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
  /** true = a execução pode enviar dados para fora (web). */
  external?: boolean;
}
