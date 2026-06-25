import { promises as fs } from 'fs';
import path from 'path';
import { searchCode } from '@/hub/rag/search';
import { resolveSources } from '@/hub/rag/ingest';
import type { LocalTool } from './types';

// Tools de CÓDIGO (read-only). Usadas pelos agentes via o orquestrador (Fase 3).
// Nada aqui escreve no código nem o envia para fora.

/** search_codebase: busca semântica, retorna trechos com citação repo:path. */
export async function searchCodebase(query: string, k = 6): Promise<string> {
  const hits = await searchCode(query, k);
  if (hits.length === 0) return 'Nenhum trecho relevante encontrado no código indexado.';
  return hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.citation} (score ${h.score.toFixed(3)})\n` +
        '```\n' +
        h.content +
        '\n```',
    )
    .join('\n\n');
}

/** read_file: lê um arquivo de um dos repos indexados (read-only, com proteção
 *  contra path traversal e respeitando a denylist por estar fora dos repos). */
export async function readRepoFile(repo: string, relPath: string): Promise<string> {
  const src = resolveSources().find((s) => s.name === repo);
  if (!src) return `Repo desconhecido: ${repo}.`;

  const base = path.resolve(src.dir);
  const target = path.resolve(base, relPath);
  // proteção contra path traversal — alvo precisa estar dentro do repo.
  if (target !== base && !target.startsWith(base + path.sep)) {
    return 'Caminho inválido (fora do repositório).';
  }
  try {
    const text = await fs.readFile(target, 'utf8');
    // corta arquivos muito grandes para caber no contexto.
    return text.length > 16000 ? text.slice(0, 16000) + '\n…(truncado)' : text;
  } catch {
    return `Arquivo não encontrado: ${repo}:${relPath}`;
  }
}

// --- Wrappers LocalTool (usados pelo orquestrador) -------------------------

export const searchCodebaseTool: LocalTool = {
  schema: {
    name: 'search_codebase',
    description:
      'Busca semântica (RAG) no código indexado dos repos Brevus. Retorna trechos com citação repo:path.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        k: { type: 'number', description: 'quantos trechos (padrão 6)' },
      },
      required: ['query'],
    },
  },
  async handler(input) {
    const k = typeof input.k === 'number' ? input.k : 6;
    return searchCodebase(String(input.query), k);
  },
};

export const readFileTool: LocalTool = {
  schema: {
    name: 'read_file',
    description: 'Lê um arquivo (read-only) de um repo indexado. Args: repo (brevus|brevus-mobile) e path.',
    input_schema: {
      type: 'object',
      properties: {
        repo: { type: 'string', enum: ['brevus', 'brevus-mobile'] },
        path: { type: 'string', description: 'caminho relativo dentro do repo' },
      },
      required: ['repo', 'path'],
    },
  },
  async handler(input) {
    return readRepoFile(String(input.repo), String(input.path));
  },
};
