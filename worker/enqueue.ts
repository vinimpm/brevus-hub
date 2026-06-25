import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { enqueueRun } from '@/hub/queue';

// Utilitário de dev: enfileira um run para um agente por slug.
// Uso: `npm run enqueue -- cyber`
async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Uso: npm run enqueue -- <slug-do-agente>');
    process.exit(1);
  }
  const agent = await prisma.agent.findUnique({ where: { slug } });
  if (!agent) {
    console.error(`Agente "${slug}" não encontrado.`);
    process.exit(1);
  }
  const run = await prisma.run.create({
    data: { agentId: agent.id, trigger: 'manual', status: 'QUEUED' },
  });
  await enqueueRun(run.id);
  console.log(`Run ${run.id} enfileirado para ${slug}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
