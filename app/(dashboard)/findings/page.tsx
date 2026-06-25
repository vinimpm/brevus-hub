import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const sevColor: Record<string, string> = {
  CRITICAL: 'bg-red-500/20 text-red-300',
  HIGH: 'bg-orange-500/20 text-orange-300',
  MEDIUM: 'bg-amber-500/20 text-amber-300',
  LOW: 'bg-sky-500/20 text-sky-300',
  INFO: 'bg-white/10 text-white/60',
};

export default async function FindingsPage() {
  const findings = await prisma.finding.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { agent: { select: { name: true } } },
  });

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-4">Findings</h1>
      {findings.length === 0 ? (
        <p className="text-white/40 text-sm">
          Nenhum finding ainda. Rode um agente no organograma para gerar resultados.
        </p>
      ) : (
        <div className="space-y-2">
          {findings.map((f) => (
            <div key={f.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2">
                {f.severity && (
                  <span className={`rounded px-2 py-0.5 text-[11px] ${sevColor[f.severity] ?? ''}`}>
                    {f.severity}
                  </span>
                )}
                <span className="text-sm font-medium">{f.title}</span>
                <span className="ml-auto text-[11px] text-white/40">{f.agent.name}</span>
              </div>
              <p className="mt-1 text-[13px] text-white/60 line-clamp-3 whitespace-pre-wrap">{f.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
