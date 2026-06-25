// Embeddings SELF-HOSTED. Rodam localmente (CPU) — o código indexado NUNCA é
// enviado a um serviço externo. Modelo padrão: all-MiniLM-L6-v2 (384 dims).
// Provider 'ollama' fica como alternativa (sidecar local).

const DIM = 384;

type Extractor = (
  texts: string | string[],
  opts: { pooling: 'mean'; normalize: boolean },
) => Promise<{ tolist: () => number[][] }>;

let extractorPromise: Promise<Extractor> | null = null;

async function getXenova(): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      // import dinâmico (ESM) — evita custo no boot e problemas de bundling.
      const { pipeline, env } = await import('@xenova/transformers');
      // cache local dos pesos do modelo (gitignored).
      env.cacheDir = process.env.MODELS_DIR || './.models';
      const model = process.env.EMBEDDINGS_MODEL || 'Xenova/all-MiniLM-L6-v2';
      const pipe = await pipeline('feature-extraction', model);
      return pipe as unknown as Extractor;
    })();
  }
  return extractorPromise;
}

async function embedXenova(texts: string[]): Promise<number[][]> {
  const extractor = await getXenova();
  const out = await extractor(texts, { pooling: 'mean', normalize: true });
  return out.tolist();
}

async function embedOllama(texts: string[]): Promise<number[][]> {
  const url = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
  const results: number[][] = [];
  for (const text of texts) {
    const res = await fetch(`${url}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    });
    if (!res.ok) throw new Error(`Ollama embeddings falhou: ${res.status}`);
    const data = (await res.json()) as { embedding: number[] };
    results.push(data.embedding);
  }
  return results;
}

/** Gera embeddings para uma lista de textos. Sempre self-hosted. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const provider = process.env.EMBEDDINGS_PROVIDER || 'xenova';
  const vectors = provider === 'ollama' ? await embedOllama(texts) : await embedXenova(texts);
  // valida dimensão (precisa bater com vector(384) do schema).
  if (vectors[0] && vectors[0].length !== DIM) {
    throw new Error(
      `Dimensão do embedding (${vectors[0].length}) != ${DIM}. Ajuste o schema (vector(N)) ou o modelo.`,
    );
  }
  return vectors;
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embed([text]);
  return v;
}

/** Formata um vetor como literal pgvector: '[0.1,0.2,...]'. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

export const EMBEDDING_DIM = DIM;
