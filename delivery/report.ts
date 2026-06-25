import { prisma } from '@/lib/prisma';

export interface Report {
  subject: string;
  html: string;
  text: string;
  findingCount: number;
}

const sevEmoji: Record<string, string> = {
  CRITICAL: '🔴',
  HIGH: '🟠',
  MEDIUM: '🟡',
  LOW: '🔵',
  INFO: '⚪',
};

// Monta um relatório a partir dos findings de um run (e do resumo do agente).
export async function buildRunReport(runId: string): Promise<Report | null> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { agent: true, findings: { orderBy: { severity: 'desc' } } },
  });
  if (!run) return null;

  const date = new Date().toLocaleDateString('pt-BR');
  const subject = `[Brevus Hub] ${run.agent.name} — ${run.findings.length} achado(s) · ${date}`;

  const textLines: string[] = [
    `Relatório do agente: ${run.agent.name}`,
    `Data: ${date}  ·  Custo: $${run.costUsd.toFixed(4)}  ·  Tokens: ${run.inputTokens + run.outputTokens}`,
    '',
  ];
  const htmlParts: string[] = [
    `<h2 style="font-family:sans-serif">${run.agent.name}</h2>`,
    `<p style="color:#666;font-family:sans-serif">${date} · Custo $${run.costUsd.toFixed(4)} · ${run.inputTokens + run.outputTokens} tokens</p>`,
  ];

  if (run.findings.length === 0) {
    textLines.push('Nenhum achado novo nesta execução.');
    htmlParts.push('<p style="font-family:sans-serif">Nenhum achado novo nesta execução.</p>');
  } else {
    for (const f of run.findings) {
      const sev = f.severity ? `${sevEmoji[f.severity] ?? ''} ${f.severity}` : '';
      textLines.push(`• ${sev} ${f.title}`);
      if (f.refs.length) textLines.push(`  refs: ${f.refs.join(', ')}`);
      textLines.push(`  ${f.body.replace(/\n/g, '\n  ')}`, '');
      htmlParts.push(
        `<div style="border:1px solid #eee;border-radius:8px;padding:12px;margin:8px 0;font-family:sans-serif">` +
          `<strong>${sev} ${escapeHtml(f.title)}</strong>` +
          `<p style="white-space:pre-wrap;color:#333">${escapeHtml(f.body)}</p>` +
          (f.refs.length ? `<p style="color:#888;font-size:12px">refs: ${escapeHtml(f.refs.join(', '))}</p>` : '') +
          `</div>`,
      );
    }
  }

  if (run.log) {
    textLines.push('— Resumo —', run.log);
    htmlParts.push(
      `<hr/><p style="font-family:sans-serif;white-space:pre-wrap;color:#444">${escapeHtml(run.log)}</p>`,
    );
  }

  return {
    subject,
    html: htmlParts.join('\n'),
    text: textLines.join('\n'),
    findingCount: run.findings.length,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
