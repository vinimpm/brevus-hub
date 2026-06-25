import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidCron } from '@/lib/cron';
import { enqueueRun } from '@/hub/queue';

export const dynamic = 'force-dynamic';

// Disparado pelo Railway cron. Enfileira runs dos agentes habilitados cuja
// agenda casa com a cadência pedida. Ex.: cron diário -> ?cadence=daily.
// Fail-closed via CRON_SECRET (header x-cron-secret ou Authorization: Bearer).
export async function GET(req: NextRequest) {
  if (!isValidCron(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 });
  }
  const cadence = req.nextUrl.searchParams.get('cadence') || 'daily';

  const agents = await prisma.agent.findMany({
    where: { enabled: true, schedule: cadence },
    select: { id: true, slug: true },
  });

  const enqueued: string[] = [];
  for (const a of agents) {
    const run = await prisma.run.create({
      data: { agentId: a.id, trigger: 'cron', status: 'QUEUED' },
    });
    await enqueueRun(run.id);
    enqueued.push(a.slug);
  }

  return NextResponse.json({ cadence, enqueued, count: enqueued.length });
}
