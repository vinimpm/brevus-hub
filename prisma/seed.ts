import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Seed do organograma inicial: Orquestrador (raiz) → Cyber + Marketing.
// O resto dos agentes nasce pela UI (wizard no-code).
async function main() {
  const orchestrator = await prisma.agent.upsert({
    where: { slug: 'orquestrador' },
    update: {},
    create: {
      slug: 'orquestrador',
      name: 'Orquestrador',
      role: [
        'Você é o Diretor do hub de agentes da Brevus, um marketplace que conecta',
        'clientes e prestadores de serviço. Coordene os agentes de departamento,',
        'delegue tarefas conforme a especialidade de cada um e consolide os achados',
        'em um resumo executivo. Nunca exponha dados pessoais (PII).',
      ].join(' '),
      model: 'claude-opus-4-8',
      allowedTools: ['read_shared_knowledge'],
      schedule: 'manual',
      posX: 0,
      posY: 0,
    },
  });

  await prisma.agent.upsert({
    where: { slug: 'cyber' },
    update: {},
    create: {
      slug: 'cyber',
      name: 'Cyberseguranca',
      parentId: orchestrator.id,
      role: [
        'Você é um analista de segurança ofensiva e defensiva da Brevus. Analise o',
        'código (via RAG) em busca de vulnerabilidades, audite dependências, procure',
        'segredos expostos e acompanhe ameaças do mercado. Para cada achado, registre',
        'um finding com severidade, localização (repo:path), impacto e remediação.',
        'Respeite a postura de segurança já documentada em docs/SECURITY.md.',
      ].join(' '),
      model: 'claude-sonnet-4-6',
      allowedTools: [
        'search_codebase',
        'read_file',
        'dependency_audit',
        'secret_scan',
        'web_search',
        'publish_knowledge',
        'write_finding',
      ],
      schedule: 'daily',
      posX: -220,
      posY: 200,
    },
  });

  await prisma.agent.upsert({
    where: { slug: 'marketing' },
    update: {},
    create: {
      slug: 'marketing',
      name: 'Marketing',
      parentId: orchestrator.id,
      role: [
        'Você é um analista de marketing da Brevus. Analise concorrentes, tendências',
        'de mercado e (quando disponível) redes sociais; cruze com métricas agregadas',
        'da plataforma (sem PII) e devolva insights acionáveis de posicionamento,',
        'conteúdo e aquisição. Registre cada insight como finding e publique fatos',
        'relevantes na memória compartilhada.',
      ].join(' '),
      model: 'claude-sonnet-4-6',
      allowedTools: [
        'web_search',
        'fetch_url',
        'get_metrics',
        'read_shared_knowledge',
        'publish_knowledge',
        'write_finding',
      ],
      schedule: 'weekly',
      posX: 220,
      posY: 200,
    },
  });

  console.log('Seed concluído: Orquestrador + Cyber + Marketing.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
