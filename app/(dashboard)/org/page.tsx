import { prisma } from '@/lib/prisma';
import { TOOL_REGISTRY } from '@/hub/tool-registry';
import type { AgentDTO } from '@/lib/types';
import { OrgChart } from '@/components/OrgChart';

export const dynamic = 'force-dynamic';

export default async function OrgPage() {
  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { findings: true, runs: true } },
      runs: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
    },
  });

  const dto: AgentDTO[] = agents.map((a) => ({
    id: a.id,
    parentId: a.parentId,
    slug: a.slug,
    name: a.name,
    role: a.role,
    model: a.model,
    allowedTools: a.allowedTools,
    schedule: a.schedule,
    enabled: a.enabled,
    posX: a.posX,
    posY: a.posY,
    findingsCount: a._count.findings,
    runsCount: a._count.runs,
    lastRunStatus: a.runs[0]?.status ?? null,
  }));

  return (
    <div className="h-screen flex flex-col">
      <header className="px-6 py-4 border-b border-white/10">
        <h1 className="text-lg font-semibold">Organograma de agentes</h1>
        <p className="text-sm text-white/50">
          Clique em “+” num nó para criar um sub-agente. Clique num nó para editar ou rodar.
        </p>
      </header>
      <div className="flex-1 min-h-0">
        <OrgChart agents={dto} tools={TOOL_REGISTRY} />
      </div>
    </div>
  );
}
