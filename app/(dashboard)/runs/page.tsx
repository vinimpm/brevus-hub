import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const statusColor: Record<string, string> = {
  RUNNING: 'text-amber-300',
  SUCCEEDED: 'text-emerald-300',
  FAILED: 'text-red-300',
  QUEUED: 'text-sky-300',
  CANCELED: 'text-white/40',
};

export default async function RunsPage() {
  const runs = await prisma.run.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { agent: { select: { name: true } } },
  });

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-4">Runs</h1>
      {runs.length === 0 ? (
        <p className="text-white/40 text-sm">Nenhuma execução ainda.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-white/40 text-[12px]">
            <tr>
              <th className="py-2">Agente</th>
              <th>Status</th>
              <th>Trigger</th>
              <th>Tokens</th>
              <th>Custo</th>
              <th>Quando</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="py-2">{r.agent.name}</td>
                <td className={statusColor[r.status] ?? ''}>{r.status}</td>
                <td className="text-white/50">{r.trigger}</td>
                <td className="text-white/50">{r.inputTokens + r.outputTokens}</td>
                <td className="text-white/50">${r.costUsd.toFixed(3)}</td>
                <td className="text-white/40 text-[12px]">
                  {new Date(r.createdAt).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
