// Registro central das tools disponíveis para os agentes.
// Alimenta os checkboxes do wizard de criação e a validação no CRUD.
// IMPORTANTE: a implementação de cada tool fica em hub/tools/ (Fase 3).
// Adicionar um TIPO de tool novo exige código + deploy; mas escolher quais
// tools um agente usa é no-code (via UI).

export type ToolCategory = 'code' | 'metrics' | 'web' | 'memory' | 'security' | 'social';

export interface ToolDef {
  slug: string;
  label: string;
  description: string;
  category: ToolCategory;
  /** true = pode enviar dados para fora da infra (web). Apenas termos de busca/URLs. */
  external: boolean;
}

export const TOOL_REGISTRY: ToolDef[] = [
  // --- Código (RAG, read-only) ---------------------------------------------
  {
    slug: 'search_codebase',
    label: 'Buscar no código',
    description: 'Busca semântica (RAG) sobre o código indexado dos repos. Retorna trechos com citação repo:path.',
    category: 'code',
    external: false,
  },
  {
    slug: 'read_file',
    label: 'Ler arquivo',
    description: 'Lê um arquivo específico (read-only) do código clonado.',
    category: 'code',
    external: false,
  },
  // --- Métricas agregadas (sem PII) ----------------------------------------
  {
    slug: 'get_metrics',
    label: 'Métricas agregadas',
    description: 'Consulta métricas anonimizadas/agregadas da plataforma (sem PII) via endpoint interno do web.',
    category: 'metrics',
    external: false,
  },
  // --- Web (saída externa — NUNCA leva código) -----------------------------
  {
    slug: 'web_search',
    label: 'Pesquisa na web',
    description: 'Pesquisa mercado, concorrentes e threat-intel na web. Só termos de busca saem da infra.',
    category: 'web',
    external: true,
  },
  {
    slug: 'fetch_url',
    label: 'Abrir URL',
    description: 'Busca o conteúdo de uma URL pública (site de concorrente, CVE, etc.).',
    category: 'web',
    external: true,
  },
  // --- Memória compartilhada (o hub) ---------------------------------------
  {
    slug: 'read_shared_knowledge',
    label: 'Ler conhecimento compartilhado',
    description: 'Lê fatos publicados por outros agentes (busca semântica na memória do hub).',
    category: 'memory',
    external: false,
  },
  {
    slug: 'publish_knowledge',
    label: 'Publicar conhecimento',
    description: 'Publica um fato na memória compartilhada para os outros agentes usarem.',
    category: 'memory',
    external: false,
  },
  {
    slug: 'write_finding',
    label: 'Registrar finding',
    description: 'Registra um resultado acionável (vuln, insight) com severidade e referências.',
    category: 'memory',
    external: false,
  },
  // --- Segurança (Cyber) ----------------------------------------------------
  {
    slug: 'dependency_audit',
    label: 'Auditar dependências',
    description: 'Roda npm audit nos repos clonados e retorna pacotes vulneráveis.',
    category: 'security',
    external: false,
  },
  {
    slug: 'secret_scan',
    label: 'Varredura de segredos',
    description: 'Procura segredos/credenciais expostas no código (gitleaks).',
    category: 'security',
    external: false,
  },
  // --- Social (Marketing) — entram conforme acesso liberado ----------------
  {
    slug: 'social_listening',
    label: 'Escuta social',
    description: 'Coleta menções/posts de redes sociais (requer credenciais; opcional).',
    category: 'social',
    external: true,
  },
];

export const TOOL_SLUGS = TOOL_REGISTRY.map((t) => t.slug);

export function getTool(slug: string): ToolDef | undefined {
  return TOOL_REGISTRY.find((t) => t.slug === slug);
}

/** Valida que todos os slugs existem no registry. Retorna os inválidos. */
export function invalidTools(slugs: string[]): string[] {
  return slugs.filter((s) => !TOOL_SLUGS.includes(s));
}
