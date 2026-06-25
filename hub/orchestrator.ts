import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { LOCAL_TOOLS } from '@/hub/tools';
import type { ToolContext } from '@/hub/tools/types';

// Preços aproximados (USD por 1M tokens) — ajuste conforme a tabela vigente.
const PRICING: Record<string, { in: number; out: number }> = {
  'claude-opus-4-8': { in: 15, out: 75 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
};

const MAX_ITERATIONS = 12;
const MAX_TOKENS = 4096;
const MAX_DELEGATION_DEPTH = 2;

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY não configurada.');
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

function systemPrompt(role: string): string {
  return [
    role,
    '',
    'Diretrizes obrigatórias:',
    '- Você trabalha para a Brevus (marketplace que conecta clientes e prestadores).',
    '- NUNCA exponha dados pessoais (PII): e-mails, CPF, telefones, endereços, pagamentos.',
    '- Fundamente afirmações sobre o produto no código (use search_codebase/read_file) e cite repo:path.',
    '- Para pesquisa externa, use web_search/fetch_url — jamais envie código proprietário para fora.',
    '- Registre resultados acionáveis com write_finding e publique fatos úteis com publish_knowledge.',
    '- Seja objetivo. Ao final, entregue um resumo executivo do que fez e descobriu.',
  ].join('\n');
}

interface RunResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

// Executa um agente (identificado por runId) com seu conjunto de tools.
export async function runAgent(runId: string, depth = 0): Promise<RunResult> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { agent: { include: { children: true } } },
  });
  if (!run) throw new Error(`Run ${runId} não encontrado.`);
  const agent = run.agent;

  await prisma.run.update({
    where: { id: runId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  const ctx: ToolContext = {
    agentId: agent.id,
    agentSlug: agent.slug,
    runId,
    childAgentIds: agent.children.map((c) => c.id),
  };

  // Monta o conjunto de tools a partir do allowlist do agente.
  const tools: Anthropic.Tool[] = [];
  const localSlugs: string[] = [];
  for (const slug of agent.allowedTools) {
    const t = LOCAL_TOOLS[slug];
    if (t) {
      tools.push(t.schema);
      localSlugs.push(slug);
    }
  }
  // web_search nativa (server-tool da Anthropic), se permitida.
  if (agent.allowedTools.includes('web_search')) {
    tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: 5 } as unknown as Anthropic.Tool);
  }
  // Delegação: se o agente tem filhos e ainda há profundidade, expõe a tool.
  const canDelegate = agent.children.length > 0 && depth < MAX_DELEGATION_DEPTH;
  if (canDelegate) {
    tools.push({
      name: 'delegate_to_subagent',
      description:
        'Delega uma tarefa a um agente subordinado (departamento/sub-agente). ' +
        `Subordinados disponíveis: ${agent.children.map((c) => c.slug).join(', ')}.`,
      input_schema: {
        type: 'object',
        properties: {
          agent_slug: { type: 'string', description: 'slug do subordinado' },
          task: { type: 'string', description: 'instrução específica para o subordinado' },
        },
        required: ['agent_slug', 'task'],
      },
    });
  }

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content:
        agent.children.length > 0
          ? 'Execute sua rotina coordenando seus subordinados conforme necessário e consolide os achados.'
          : 'Execute sua rotina de análise e registre os achados.',
    },
  ];

  let inputTokens = 0;
  let outputTokens = 0;
  let finalText = '';

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const resp = await anthropic().messages.create({
      model: agent.model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt(agent.role),
      tools: tools.length ? tools : undefined,
      messages,
    });
    inputTokens += resp.usage.input_tokens;
    outputTokens += resp.usage.output_tokens;

    messages.push({ role: 'assistant', content: resp.content });

    const textNow = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    if (textNow) finalText = textNow;

    if (resp.stop_reason !== 'tool_use') break;

    // Resolve as tool_use de tools LOCAIS / delegação (web_search é resolvida pela API).
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of resp.content) {
      if (block.type !== 'tool_use') continue;
      const name = block.name;
      const input = (block.input ?? {}) as Record<string, unknown>;
      let resultText = '';
      try {
        if (name === 'delegate_to_subagent' && canDelegate) {
          resultText = await delegate(agent.children, input, depth);
        } else if (LOCAL_TOOLS[name]) {
          resultText = await LOCAL_TOOLS[name].handler(input, ctx);
        } else {
          resultText = `Tool ${name} indisponível.`;
        }
      } catch (e) {
        resultText = `Erro na tool ${name}: ${(e as Error).message}`;
      }
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: resultText });
    }
    if (toolResults.length === 0) break;
    messages.push({ role: 'user', content: toolResults });
  }

  const price = PRICING[agent.model] ?? { in: 3, out: 15 };
  const costUsd = (inputTokens / 1e6) * price.in + (outputTokens / 1e6) * price.out;

  await prisma.run.update({
    where: { id: runId },
    data: {
      status: 'SUCCEEDED',
      finishedAt: new Date(),
      inputTokens,
      outputTokens,
      costUsd,
      log: finalText.slice(0, 8000),
    },
  });

  return { text: finalText, inputTokens, outputTokens, costUsd };
}

// Delegação: executa um filho inline (cria Run próprio) e devolve o resumo dele.
async function delegate(
  children: { id: string; slug: string }[],
  input: Record<string, unknown>,
  depth: number,
): Promise<string> {
  const slug = String(input.agent_slug ?? '');
  const child = children.find((c) => c.slug === slug);
  if (!child) return `Subordinado "${slug}" não encontrado.`;
  const childRun = await prisma.run.create({
    data: { agentId: child.id, trigger: 'parent-delegation', status: 'QUEUED' },
  });
  const res = await runAgent(childRun.id, depth + 1);
  return `Resumo de ${slug}:\n${res.text}`;
}

// Marca um run como falho (usado pelo worker em caso de erro).
export async function failRun(runId: string, message: string) {
  await prisma.run.update({
    where: { id: runId },
    data: { status: 'FAILED', finishedAt: new Date(), error: message.slice(0, 2000) },
  });
}
