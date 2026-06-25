import type { Report } from './report';

// Envio por WhatsApp reutilizando o baileys-server existente
// (POST /api/send-message { phone, message }). Best-effort/opcional.
export async function sendWhatsApp(report: Report): Promise<{ ok: boolean; info: string }> {
  const base = process.env.BAILEYS_URL;
  const phone = process.env.REPORT_WHATSAPP_TO;
  if (!base || !phone) return { ok: false, info: 'BAILEYS_URL/REPORT_WHATSAPP_TO ausentes.' };

  // WhatsApp é texto puro; manda um resumo enxuto (não o HTML).
  const message =
    `*${report.subject}*\n\n` +
    (report.text.length > 3500 ? report.text.slice(0, 3500) + '…' : report.text);

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, info: `baileys HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true, info: 'whatsapp enviado' };
  } catch (e) {
    return { ok: false, info: `erro baileys: ${(e as Error).message}` };
  }
}
