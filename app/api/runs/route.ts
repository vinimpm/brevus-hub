import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthed } from '@/lib/guard';
import { enqueueRun } from '@/hub/queue';

export const dynamic = 'force-dynamic';

// Lista os runs recentes (todos os agentes).
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const runs = await prisma.run.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { agent: { select: { name: true, slug: true } } },
  });
  return NextResponse.json({ runs });
}

// Enfileira um run para um agente. A execução de fato é feita pelo worker
// (Fase 3); aqui apenas registramos o Run com status QUEUED. Quando a fila
// (BullMQ) existir, este handler também fará o enqueue.
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const agentId: string | undefined = body?.agentId;
  const trigger: string = body?.trigger ?? 'manual';
  if (!agentId) {
    return NextResponse.json({ error: 'agentId é obrigatório.' }, { status: 422 });
  }
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return NextResponse.json({ error: 'Agente não encontrado.' }, { status: 404 });
  if (!agent.enabled) {
    return NextResponse.json({ error: 'Agente está pausado.' }, { status: 409 });
  }

  const run = await prisma.run.create({
    data: { agentId, trigger, status: 'QUEUED' },
  });

  // Enfileira no BullMQ; o worker (npm run worker) executa via orquestrador.
  try {
    await enqueueRun(run.id);
  } catch (e) {
    // Se o Redis estiver fora, o run fica QUEUED e pode ser reprocessado depois.
    return NextResponse.json(
      { run, warning: `Run criado, mas fila indisponível: ${(e as Error).message}` },
      { status: 201 },
    );
  }
  return NextResponse.json({ run }, { status: 201 });
}
