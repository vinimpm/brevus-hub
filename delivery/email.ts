import type { Report } from './report';

// Envio de e-mail via Resend (REST API — sem dep extra). Best-effort: se a chave
// não estiver setada, apenas loga e ignora.
export async function sendEmail(report: Report): Promise<{ ok: boolean; info: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_EMAIL_TO;
  const from = process.env.REPORT_EMAIL_FROM || 'hub@brevus.com.br';
  if (!apiKey || !to) return { ok: false, info: 'RESEND_API_KEY/REPORT_EMAIL_TO ausentes.' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: to.split(',').map((s) => s.trim()),
        subject: report.subject,
        html: report.html,
        text: report.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, info: `Resend HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true, info: 'e-mail enviado' };
  } catch (e) {
    return { ok: false, info: `erro Resend: ${(e as Error).message}` };
  }
}
