import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { embedOne, toVectorLiteral } from './embeddings';

export interface CodeHit {
  repo: string;
  path: string;
  startLine: number | null;
  endLine: number | null;
  content: string;
  score: number;
  citation: string; // "repo:path#L10-L70"
}

// Busca semântica sobre o código indexado (pgvector, distância de cosseno).
// Embedding da query é self-hosted — a query não sai da infra.
export async function searchCode(query: string, k = 6): Promise<CodeHit[]> {
  const vec = await embedOne(query);
  const lit = toVectorLiteral(vec);

  const rows = await prisma.$queryRaw<
    {
      repo: string;
      path: string;
      startLine: number | null;
      endLine: number | null;
      content: string;
      score: number;
    }[]
  >`
    SELECT repo, path, "startLine", "endLine", content,
           1 - (embedding <=> ${Prisma.raw(`'${lit}'::vector`)}) AS score
    FROM code_chunks
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${Prisma.raw(`'${lit}'::vector`)}
    LIMIT ${k}`;

  return rows.map((r) => ({
    ...r,
    citation: `${r.repo}:${r.path}${r.startLine ? `#L${r.startLine}-L${r.endLine}` : ''}`,
  }));
}
