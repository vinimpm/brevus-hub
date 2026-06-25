import { Queue, type ConnectionOptions } from 'bullmq';

// Fila de execuções dos agentes.
export const RUNS_QUEUE = 'runs';

// Opções de conexão a partir da REDIS_URL (BullMQ cria a própria conexão ioredis,
// evitando conflito de versões com a cópia aninhada do pacote).
export function connectionOptions(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null, // exigido pelo BullMQ
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

let queue: Queue | null = null;
export function runsQueue(): Queue {
  if (!queue) queue = new Queue(RUNS_QUEUE, { connection: connectionOptions() });
  return queue;
}

// Enfileira um run já criado (status QUEUED) para o worker processar.
export async function enqueueRun(runId: string) {
  await runsQueue().add('run', { runId }, { removeOnComplete: 100, removeOnFail: 200 });
}

// Enfileira uma reindexação RAG (job 'ingest'). Tratado pelo mesmo worker.
export async function enqueueIngest(repos?: string[]) {
  await runsQueue().add(
    'ingest',
    { repos: repos ?? [] },
    { removeOnComplete: 20, removeOnFail: 50 },
  );
}
