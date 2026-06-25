import type { LocalTool } from './types';

// get_metrics: consulta métricas AGREGADAS/anônimas da plataforma via endpoint
// interno do web (sem PII). O hub NUNCA acessa o banco de produção.
export const getMetrics: LocalTool = {
  schema: {
    name: 'get_metrics',
    description:
      'Consulta métricas agregadas e anonimizadas da plataforma Brevus (sem dados pessoais). ' +
      'Ex.: volume de pedidos, conversão, distribuição por região, prestadores ativos.',
    input_schema: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          description: 'nome/grupo de métrica (ex.: "overview", "regions", "conversion").',
        },
      },
      required: ['metric'],
    },
  },
  async handler(input) {
    const base = process.env.BREVUS_WEB_URL;
    const secret = process.env.HUB_METRICS_SECRET;
    if (!base || !secret) {
      return 'Métricas indisponíveis: endpoint agregado ainda não configurado (Fase 5).';
    }
    try {
      const url = `${base.replace(/\/$/, '')}/api/internal/metrics?metric=${encodeURIComponent(
        String(input.metric ?? 'overview'),
      )}`;
      const res = await fetch(url, { headers: { 'x-hub-secret': secret } });
      if (res.status === 404) {
        return 'Endpoint de métricas ainda não publicado no web (Fase 5 pendente).';
      }
      if (!res.ok) return `Falha ao buscar métricas: HTTP ${res.status}.`;
      const data = await res.json();
      return JSON.stringify(data);
    } catch (e) {
      return `Erro ao buscar métricas: ${(e as Error).message}`;
    }
  },
};
