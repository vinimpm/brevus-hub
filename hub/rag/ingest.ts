import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { embed, toVectorLiteral } from './embeddings';

// ---------------------------------------------------------------------------
// Ingestão do código para RAG. Lê os repos READ-ONLY (cópias locais em dev;
// clone via deploy key em prod), filtra segredos/PII/binários, faz chunk,
// gera embeddings SELF-HOSTED e grava em code_chunks (pgvector).
// ---------------------------------------------------------------------------

const ALLOWED_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.md', '.prisma', '.mjs', '.cjs']);

// Diretórios/arquivos que NUNCA entram no índice (segredos, deps, build, dados).
const DENY_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'build', 'out', 'coverage',
  '.models', '.rag-cache', 'public', '.expo', 'android', 'ios', 'baileys-server',
]);
const DENY_FILE_PATTERNS = [
  /(^|\/)\.env/i,
  /secret/i,
  /credential/i,
  /package-lock\.json$/i,
  /\.lock$/i,
  /(^|\/)prisma\/seed/i,
  /(^|\/)prisma\/migrations\//i, // migrations podem conter dados
  /\.(png|jpg|jpeg|gif|svg|ico|webp|pdf|zip|woff2?|ttf|mp4|map)$/i,
];

const CHUNK_LINES = 60;
const OVERLAP = 10;
const MAX_FILE_BYTES = 200 * 1024; // ignora arquivos enormes

export interface RepoSource {
  name: string; // "brevus" | "brevus-mobile"
  dir: string; // caminho local da cópia read-only
}

interface Chunk {
  repo: string;
  filePath: string; // relativo ao repo
  startLine: number;
  endLine: number;
  content: string;
}

function isDenied(rel: string): boolean {
  const parts = rel.split(/[\\/]/);
  if (parts.some((p) => DENY_DIRS.has(p))) return true;
  return DENY_FILE_PATTERNS.some((re) => re.test(rel));
}

async function* walk(root: string, rel = ''): AsyncGenerator<string> {
  const full = path.join(root, rel);
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(full, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    if (isDenied(childRel)) continue;
    if (e.isDirectory()) {
      if (DENY_DIRS.has(e.name)) continue;
      yield* walk(root, childRel);
    } else if (e.isFile()) {
      if (ALLOWED_EXT.has(path.extname(e.name).toLowerCase())) yield childRel;
    }
  }
}

function chunkFile(repo: string, rel: string, text: string): Chunk[] {
  const lines = text.split('\n');
  const chunks: Chunk[] = [];
  for (let start = 0; start < lines.length; start += CHUNK_LINES - OVERLAP) {
    const end = Math.min(start + CHUNK_LINES, lines.length);
    const content = lines.slice(start, end).join('\n').trim();
    if (content.length > 20) {
      chunks.push({ repo, filePath: rel, startLine: start + 1, endLine: end, content });
    }
    if (end >= lines.length) break;
  }
  return chunks;
}

async function insertChunks(chunks: Chunk[], commit: string | null) {
  const BATCH = 32;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const vectors = await embed(batch.map((c) => `${c.filePath}\n${c.content}`));
    for (let j = 0; j < batch.length; j++) {
      const c = batch[j];
      const lit = toVectorLiteral(vectors[j]);
      await prisma.$executeRaw`
        INSERT INTO code_chunks (id, repo, path, symbol, "startLine", "endLine", content, commit, embedding, "createdAt")
        VALUES (${crypto.randomUUID()}, ${c.repo}, ${c.filePath}, ${null}, ${c.startLine}, ${c.endLine},
                ${c.content}, ${commit}, ${Prisma.raw(`'${lit}'::vector`)}, now())`;
    }
    process.stdout.write(`\r  embed+insert ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
  }
  process.stdout.write('\n');
}

/** Reindexação completa de um repo (apaga chunks antigos e reindexa). */
export async function ingestRepo(src: RepoSource): Promise<number> {
  console.log(`\n[ingest] ${src.name} <- ${src.dir}`);
  const all: Chunk[] = [];
  let files = 0;
  for await (const rel of walk(src.dir)) {
    const abs = path.join(src.dir, rel);
    const stat = await fs.stat(abs);
    if (stat.size > MAX_FILE_BYTES) continue;
    const text = await fs.readFile(abs, 'utf8');
    all.push(...chunkFile(src.name, rel, text));
    files++;
  }
  console.log(`[ingest] ${src.name}: ${files} arquivos -> ${all.length} chunks`);

  await prisma.$executeRaw`DELETE FROM code_chunks WHERE repo = ${src.name}`;
  await insertChunks(all, null);

  await prisma.ingestionState.upsert({
    where: { repo: src.name },
    update: { lastRunAt: new Date(), chunkCount: all.length },
    create: { repo: src.name, lastRunAt: new Date(), chunkCount: all.length },
  });
  return all.length;
}

/** Resolve as fontes de repo a partir do ambiente (local em dev). */
export function resolveSources(): RepoSource[] {
  const sources: RepoSource[] = [];
  const web = process.env.RAG_LOCAL_WEB;
  const mobile = process.env.RAG_LOCAL_MOBILE;
  if (web) sources.push({ name: 'brevus', dir: web });
  if (mobile) sources.push({ name: 'brevus-mobile', dir: mobile });
  return sources;
}
