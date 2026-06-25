import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthed } from '@/lib/guard';
import { agentCreateSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

// Lista todos os agentes (nós do organograma) com contagens p/ o painel.
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { findings: true, runs: true } },
      runs: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, finishedAt: true } },
    },
  });
  return NextResponse.json({ agents });
}

// Cria um agente (nó). Usado pelo wizard "+" do organograma.
export async function POST(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = agentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const data = parsed.data;

  // slug único?
  const exists = await prisma.agent.findUnique({ where: { slug: data.slug } });
  if (exists) {
    return NextResponse.json({ error: 'Slug já existe.' }, { status: 409 });
  }
  // pai existe?
  if (data.parentId) {
    const parent = await prisma.agent.findUnique({ where: { id: data.parentId } });
    if (!parent) {
      return NextResponse.json({ error: 'Pai inexistente.' }, { status: 422 });
    }
  }

  const agent = await prisma.agent.create({
    data: {
      name: data.name,
      slug: data.slug,
      role: data.role,
      parentId: data.parentId ?? null,
      model: data.model,
      allowedTools: data.allowedTools,
      schedule: data.schedule ?? 'manual',
      posX: data.posX ?? 0,
      posY: data.posY ?? 0,
    },
  });
  return NextResponse.json({ agent }, { status: 201 });
}
