import 'dotenv/config';
import { searchCode } from '@/hub/rag/search';
import { prisma } from '@/lib/prisma';

// CLI de teste de retrieval: `npm run rag:query -- "como funciona a busca publica?"`
async function main() {
  const q = process.argv.slice(2).join(' ').trim();
  if (!q) {
    console.error('Uso: npm run rag:query -- "sua pergunta"');
    process.exit(1);
  }
  const hits = await searchCode(q, 5);
  console.log(`\nQuery: ${q}\n`);
  for (const h of hits) {
    console.log(`• ${h.citation}  (score ${h.score.toFixed(3)})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
