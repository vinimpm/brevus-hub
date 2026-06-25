import { buildRunReport } from './report';
import { sendEmail } from './email';
import { sendWhatsApp } from './whatsapp';

// Entrega o relatório de um run pelos canais configurados (e-mail + WhatsApp).
// Chamado pelo worker após runs agendados. Best-effort: nunca derruba o run.
export async function deliverRunReport(runId: string): Promise<void> {
  try {
    const report = await buildRunReport(runId);
    if (!report) return;
    const [email, wpp] = await Promise.all([sendEmail(report), sendWhatsApp(report)]);
    console.log(`[delivery] run ${runId}: email=${email.info} | whatsapp=${wpp.info}`);
  } catch (e) {
    console.error(`[delivery] falha ao entregar run ${runId}:`, (e as Error).message);
  }
}
