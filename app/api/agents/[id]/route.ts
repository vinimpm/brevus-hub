import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthed } from '@/lib/guard';
import { agentUpdateSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

// Detecta ciclo: ao definir `newParentId` como pai de `agentId`, o novo pai não
// pode ser o próprio agente nem um descendente dele. Sobe a árvore a partir do
// novo pai; se encontrar `agentId`, é ciclo.
async function wouldCycle(agentId: string, newParentId: string): Promise<boolean> {
  let cursor: string | null = newParentId;
  const guard = new Set<string>();
  while (cursor) {
    if (cursor === agentId) return true;
    if (guard.has(cursor)) break; // proteção contra dados já inconsistentes
    guard.add(cursor);
    const node: { parentId: string | null } | null = await prisma.agent.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    cursor = node?.parentId ?? null;
  }
  return false;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const agent = await prisma.agent.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { findings: true, runs: true } },
      runs: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ agent });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = agentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const data = parsed.data;

  const current = await prisma.agent.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (data.parentId !== undefined && data.parentId !== null) {
    if (data.parentId === params.id) {
      return NextResponse.json({ error: 'Um agente não pode ser pai de si mesmo.' }, { status: 422 });
    }
    if (await wouldCycle(params.id, data.parentId)) {
      return NextResponse.json({ error: 'Movimento criaria um ciclo no organograma.' }, { status: 422 });
    }
  }
  if (data.slug && data.slug !== current.slug) {
    const dupe = await prisma.agent.findUnique({ where: { slug: data.slug } });
    if (dupe) return NextResponse.json({ error: 'Slug já existe.' }, { status: 409 });
  }

  const agent = await prisma.agent.update({
    where: { id: params.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
      ...(data.model !== undefined && { model: data.model }),
      ...(data.allowedTools !== undefined && { allowedTools: data.allowedTools }),
      ...(data.schedule !== undefined && { schedule: data.schedule }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.posX !== undefined && { posX: data.posX }),
      ...(data.posY !== undefined && { posY: data.posY }),
    },
  });
  return NextResponse.json({ agent });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const agent = await prisma.agent.findUnique({
    where: { id: params.id },
    include: { _count: { select: { children: true } } },
  });
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (agent._count.children > 0) {
    return NextResponse.json(
      { error: 'Remova ou mova os sub-agentes antes de excluir este nó.' },
      { status: 409 },
    );
  }
  await prisma.agent.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
