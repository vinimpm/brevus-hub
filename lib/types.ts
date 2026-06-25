// Tipos compartilhados entre server e client (organograma).

export type RunStatusLite = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

export interface AgentDTO {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  role: string;
  model: string;
  allowedTools: string[];
  schedule: string;
  enabled: boolean;
  posX: number;
  posY: number;
  findingsCount: number;
  runsCount: number;
  lastRunStatus: RunStatusLite | null;
}
