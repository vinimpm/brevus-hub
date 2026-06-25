import 'dotenv/config';
import { ingestRepo, resolveSources } from '@/hub/rag/ingest';
import { prisma } from '@/lib/prisma';

// CLI de ingestão RAG: `npm run ingest`.
// Lê os repos configurados (RAG_LOCAL_WEB / RAG_LOCAL_MOBILE), reindexa tudo.
async function main() {
  let sources = resolveSources();
  // filtro opcional por nome: `npm run ingest -- mobile`  (casa "brevus-mobile")
  const filters = process.argv.slice(2);
  if (filters.length > 0) {
    sources = sources.filter((s) => filters.some((f) => s.name.includes(f)));
  }
  if (sources.length === 0) {
    console.error('Nenhum repo configurado. Defina RAG_LOCAL_WEB / RAG_LOCAL_MOBILE no .env.');
    process.exit(1);
  }
  const t0 = Date.now();
  let total = 0;
  for (const src of sources) {
    total += await ingestRepo(src);
  }
  console.log(`\n[ingest] concluído: ${total} chunks em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
