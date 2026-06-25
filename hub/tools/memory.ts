import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { embedOne, toVectorLiteral } from '@/hub/rag/embeddings';
import type { LocalTool } from './types';

// Tools da MEMÓRIA COMPARTILHADA ("o hub"): o que um agente registra/publica,
// os outros conseguem ler. Nenhum PII (não há PII no corpus por construção).

export const writeFinding: LocalTool = {
  schema: {
    name: 'write_finding',
    description:
      'Registra um resultado acionável (vulnerabilidade, insight, oportunidade) com severidade e referências.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'vulnerability | insight | competitor | opportunity | other' },
        severity: { type: 'string', enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
        title: { type: 'string' },
        body: { type: 'string', description: 'Detalhe em markdown: o quê, impacto e recomendação.' },
        refs: { type: 'array', items: { type: 'string' }, description: 'Citações repo:path ou URLs.' },
      },
      required: ['type', 'title', 'body'],
    },
  },
  async handler(input, ctx) {
    const refs = Array.isArray(input.refs) ? (input.refs as string[]) : [];
    const dedupeKey = crypto
      .createHash('sha1')
      .update(`${ctx.agentId}:${input.title}`)
      .digest('hex');

    // dedupe simples: se já existe finding aberto com a mesma chave, não duplica.
    const existing = await prisma.finding.findFirst({
      where: { dedupeKey, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
    });
    if (existing) return `Finding já existente (id ${existing.id}); não duplicado.`;

    const f = await prisma.finding.create({
      data: {
        runId: ctx.runId,
        agentId: ctx.agentId,
        type: String(input.type),
        severity: (input.severity as never) ?? null,
        title: String(input.title),
        body: String(input.body),
        refs,
        dedupeKey,
        sources: {
          create: refs.map((r) => ({
            kind: r.startsWith('http') ? 'url' : 'code',
            ref: r,
          })),
        },
      },
    });
    return `Finding registrado: ${f.id} (${f.severity ?? 'sem severidade'}).`;
  },
};

export const publishKnowledge: LocalTool = {
  schema: {
    name: 'publish_knowledge',
    description:
      'Publica um fato/insight na memória compartilhada para outros agentes reutilizarem.',
    input_schema: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
        content: { type: 'string', description: 'O fato, de forma autocontida.' },
      },
      required: ['topic', 'content'],
    },
  },
  async handler(input, ctx) {
    const id = crypto.randomUUID();
    const vec = await embedOne(`${input.topic}\n${input.content}`);
    const lit = toVectorLiteral(vec);
    await prisma.$executeRaw`
      INSERT INTO knowledge_items (id, "agentId", topic, content, embedding, version, "createdAt")
      VALUES (${id}, ${ctx.agentId}, ${String(input.topic)}, ${String(input.content)},
              ${Prisma.raw(`'${lit}'::vector`)}, 1, now())`;
    return `Conhecimento publicado: "${input.topic}".`;
  },
};

export const readSharedKnowledge: LocalTool = {
  schema: {
    name: 'read_shared_knowledge',
    description:
      'Busca na memória compartilhada fatos publicados por outros agentes (busca semântica).',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        k: { type: 'number', description: 'quantos itens (padrão 5)' },
      },
      required: ['query'],
    },
  },
  async handler(input) {
    const k = typeof input.k === 'number' ? input.k : 5;
    const vec = await embedOne(String(input.query));
    const lit = toVectorLiteral(vec);
    const rows = await prisma.$queryRaw<
      { topic: string; content: string; score: number; agentId: string | null }[]
    >`
      SELECT topic, content, "agentId",
             1 - (embedding <=> ${Prisma.raw(`'${lit}'::vector`)}) AS score
      FROM knowledge_items
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${Prisma.raw(`'${lit}'::vector`)}
      LIMIT ${k}`;
    if (rows.length === 0) return 'Nenhum conhecimento compartilhado relevante ainda.';
    return rows
      .map((r) => `• [${r.topic}] (score ${r.score.toFixed(3)})\n${r.content}`)
      .join('\n\n');
  },
};
