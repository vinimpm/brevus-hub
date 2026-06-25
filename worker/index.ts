import 'dotenv/config';
import { Worker } from 'bullmq';
import { connectionOptions, RUNS_QUEUE } from '@/hub/queue';
import { runAgent, failRun } from '@/hub/orchestrator';
import { deliverRunReport } from '@/delivery';
import { ingestRepo, resolveSources } from '@/hub/rag/ingest';
import { prisma } from '@/lib/prisma';

// Worker que consome a fila e processa dois tipos de job:
//  - 'run'    : executa um agente (orquestrador) e, se for agendado, entrega o relatório
//  - 'ingest' : reindexa o RAG (clone/cópia read-only dos repos)
// Rodar com: `npm run worker`.
const worker = new Worker(
  RUNS_QUEUE,
  async (job) => {
    if (job.name === 'ingest') {
      const filters = (job.data?.repos as string[] | undefined) ?? [];
      let sources = resolveSources();
      if (filters.length) sources = sources.filter((s) => filters.some((f) => s.name.includes(f)));
      let total = 0;
      for (const src of sources) total += await ingestRepo(src);
      console.log(`[worker] ingest concluído: ${total} chunks`);
      return;
    }

    // job 'run'
    const { runId } = job.data as { runId: string };
    console.log(`[worker] executando run ${runId}…`);
    try {
      const res = await runAgent(runId);
      console.log(
        `[worker] run ${runId} OK — ${res.inputTokens + res.outputTokens} tokens, $${res.costUsd.toFixed(4)}`,
      );
      // Entrega o relatório apenas para runs agendados (cron).
      const run = await prisma.run.findUnique({ where: { id: runId }, select: { trigger: true } });
      if (run?.trigger === 'cron') await deliverRunReport(runId);
    } catch (e) {
      console.error(`[worker] run ${runId} FALHOU:`, (e as Error).message);
      await failRun(runId, (e as Error).message).catch(() => {});
      throw e;
    }
  },
  { connection: connectionOptions(), concurrency: 2 },
);

worker.on('ready', () => console.log('[worker] pronto, aguardando jobs…'));
worker.on('failed', (job, err) => console.error(`[worker] job ${job?.id} falhou:`, err.message));

async function shutdown() {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
