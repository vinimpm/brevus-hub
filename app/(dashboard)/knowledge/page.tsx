import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function KnowledgePage() {
  const items = await prisma.knowledgeItem.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { agent: { select: { name: true } } },
  });

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-1">Knowledge Base</h1>
      <p className="text-sm text-white/50 mb-4">
        Conhecimento compartilhado entre os agentes — o que um descobre, os outros usam.
      </p>
      {items.length === 0 ? (
        <p className="text-white/40 text-sm">Nenhum item publicado ainda.</p>
      ) : (
        <div className="space-y-2">
          {items.map((k) => (
            <div key={k.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{k.topic}</span>
                <span className="ml-auto text-[11px] text-white/40">
                  {k.agent?.name ?? 'sistema'} · v{k.version}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-white/60 whitespace-pre-wrap">{k.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
