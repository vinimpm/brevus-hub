import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resolveSources } from '@/hub/rag/ingest';
import type { LocalTool } from './types';

const execAsync = promisify(exec);

function repoDir(repo: string): string | null {
  return resolveSources().find((s) => s.name === repo)?.dir ?? null;
}

// dependency_audit: roda `npm audit` no repo clonado e resume os pacotes vulneráveis.
export const dependencyAudit: LocalTool = {
  schema: {
    name: 'dependency_audit',
    description: 'Audita as dependências npm de um repo (brevus | brevus-mobile) e lista vulnerabilidades.',
    input_schema: {
      type: 'object',
      properties: { repo: { type: 'string', enum: ['brevus', 'brevus-mobile'] } },
      required: ['repo'],
    },
  },
  async handler(input) {
    const dir = repoDir(String(input.repo));
    if (!dir) return `Repo desconhecido: ${input.repo}.`;
    try {
      const { stdout } = await execAsync('npm audit --json', {
        cwd: dir,
        maxBuffer: 20 * 1024 * 1024,
        windowsHide: true,
      }).catch((e: { stdout?: string }) => ({ stdout: e.stdout ?? '' }));
      if (!stdout) return 'npm audit não retornou dados (faltando package-lock.json?).';
      const data = JSON.parse(stdout) as {
        metadata?: { vulnerabilities?: Record<string, number> };
        vulnerabilities?: Record<string, { severity: string; via: unknown[] }>;
      };
      const meta = data.metadata?.vulnerabilities ?? {};
      const top = Object.entries(data.vulnerabilities ?? {})
        .filter(([, v]) => ['high', 'critical'].includes(v.severity))
        .slice(0, 20)
        .map(([name, v]) => `- ${name}: ${v.severity}`)
        .join('\n');
      return (
        `Resumo (${input.repo}): ${JSON.stringify(meta)}\n` +
        (top ? `\nHigh/Critical:\n${top}` : '\nSem high/critical.')
      );
    } catch (e) {
      return `Erro no audit: ${(e as Error).message}`;
    }
  },
};

const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'AWS Access Key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'Private Key', re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { name: 'Generic API key', re: /(api[_-]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/i },
  { name: 'Bearer/JWT', re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'Postgres URL com senha', re: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i },
];

const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.env', '.yml', '.yaml', '.md']);
const SCAN_DENY = new Set(['node_modules', '.next', '.git', 'dist', 'build', '.models', '.rag-cache']);

// secret_scan: varredura por regex de segredos expostos no código (bounded).
export const secretScan: LocalTool = {
  schema: {
    name: 'secret_scan',
    description: 'Procura segredos/credenciais expostas no código de um repo (brevus | brevus-mobile).',
    input_schema: {
      type: 'object',
      properties: { repo: { type: 'string', enum: ['brevus', 'brevus-mobile'] } },
      required: ['repo'],
    },
  },
  async handler(input) {
    const root = repoDir(String(input.repo));
    if (!root) return `Repo desconhecido: ${input.repo}.`;
    const findings: string[] = [];
    let scanned = 0;
    const MAX_FILES = 4000;

    async function walk(rel: string) {
      if (scanned >= MAX_FILES) return;
      let entries: import('fs').Dirent[];
      try {
        entries = await fs.readdir(path.join(root!, rel), { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const childRel = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          if (!SCAN_DENY.has(e.name)) await walk(childRel);
        } else if (SCAN_EXT.has(path.extname(e.name).toLowerCase()) || e.name.startsWith('.env')) {
          scanned++;
          try {
            const text = await fs.readFile(path.join(root!, childRel), 'utf8');
            for (const p of SECRET_PATTERNS) {
              if (p.re.test(text)) findings.push(`- ${childRel}: possível ${p.name}`);
            }
          } catch {
            /* ignora binários */
          }
        }
      }
    }
    await walk('');
    if (findings.length === 0) return `Nenhum segredo aparente em ${scanned} arquivos.`;
    return `Possíveis exposições (${scanned} arquivos varridos):\n${findings.slice(0, 50).join('\n')}`;
  },
};
