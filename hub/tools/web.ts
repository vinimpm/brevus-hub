import type { LocalTool } from './types';

// fetch_url: busca o conteúdo textual de uma URL PÚBLICA (site de concorrente,
// página de CVE, etc.). Saída externa — NUNCA envia código proprietário.
// (web_search é tratada como server-tool nativa da Anthropic no orquestrador.)
export const fetchUrl: LocalTool = {
  external: true,
  schema: {
    name: 'fetch_url',
    description:
      'Busca o conteúdo de uma URL pública (concorrente, notícia, CVE) e retorna o texto. ' +
      'Use apenas para pesquisa externa; nunca envia dados internos.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL http(s) pública.' },
      },
      required: ['url'],
    },
  },
  async handler(input) {
    const url = String(input.url ?? '');
    if (!/^https?:\/\//i.test(url)) return 'URL inválida (precisa ser http/https).';
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'BrevusHub/1.0 (+research)' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return `HTTP ${res.status} ao buscar ${url}.`;
      const html = await res.text();
      // strip básico de HTML -> texto.
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text.length > 12000 ? text.slice(0, 12000) + '…(truncado)' : text;
    } catch (e) {
      return `Erro ao buscar ${url}: ${(e as Error).message}`;
    }
  },
};
