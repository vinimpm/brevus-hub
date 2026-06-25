# Brevus Agent Hub

Hub de agentes de IA da Brevus. Organograma visual de agentes especializados
(Cyberseguranca, Marketing, …) que trabalham sobre a plataforma com **RAG sobre o
código** (read-only) e **memória compartilhada**, **sem expor PII** nem o código a
serviços externos.

## Stack
- **Next.js 14** (dashboard + API) · **React Flow** (organograma)
- **Prisma + Postgres + pgvector** (DB dedicado: agentes, runs, findings, RAG)
- **Claude Agent SDK** (runtime hierárquico de agentes, sob ZDR)
- **Embeddings self-hosted** (`@xenova/transformers` / Ollama)
- **BullMQ + Redis** (fila de execuções) · **Resend** + baileys (entrega)

## Princípios de segurança (não violar)
1. O hub **nunca** acessa o banco de produção; dados só via `get_metrics` agregado/anônimo.
2. Acesso ao código é **read-only** (deploy keys); embeddings **self-hosted** (repo nunca sai).
3. Geração no **Claude sob ZDR + no-training**; só trechos recuperados transitam.
4. `web_search`/`fetch_url` **nunca** levam código; só termos/URLs.
5. Crons e endpoints internos são **fail-closed** (sem secret → 401).

## Dev local
```bash
cp .env.example .env          # preencha os segredos
docker compose up -d          # Postgres(pgvector) + Redis
npm install
npm run prisma:migrate        # cria o schema
npm run db:seed               # Orquestrador + Cyber + Marketing
npm run dev                   # http://localhost:3100 (login: HUB_OWNER_EMAIL/PASSWORD)
npm run worker                # processa runs e ingestão (terminal separado)
npm run ingest                # indexa os repos p/ RAG (ou `-- mobile` p/ filtrar)
npm run rag:query -- "..."    # testa a busca semântica
npm run enqueue -- cyber      # enfileira um run manualmente
```

## Agendamento (Railway cron) e entrega
Configure **cron jobs no Railway** apontando para os endpoints (fail-closed por
`CRON_SECRET`, via header `x-cron-secret` ou `Authorization: Bearer`):
- `GET /api/cron/run-scheduled?cadence=daily` — enfileira agentes com `schedule=daily`.
- `GET /api/cron/run-scheduled?cadence=weekly` — idem semanal.
- `GET /api/cron/ingest` — reindexa o RAG.

Após um run **agendado** (trigger `cron`), o worker entrega um relatório por
**e-mail** (Resend, se `RESEND_API_KEY`+`REPORT_EMAIL_TO`) e **WhatsApp** (baileys,
se `BAILEYS_URL`+`REPORT_WHATSAPP_TO`). Sem as chaves, degrada sem erro.

## Deploy (Railway)
Serviço próprio no projeto Brevus (isolado do web). `railway.json` roda
`prisma migrate deploy && npm start`. Provisione Postgres (pgvector) e Redis como
plugins; rode o **worker** como um segundo serviço (`npm run worker`). Em prod, a
ingestão clona os repos via **deploy key read-only** (ou use volumes). Variáveis:
ver `.env.example`. **Use conta Anthropic com ZDR.**

## Roadmap (fases)
✅ 0 Fundação · ✅ 1 Organograma + CRUD · ✅ 2 RAG core · ✅ 3 Runtime + memória ·
⏳ 4 Agente Cyber (e2e) · ⏳ 5 Métricas agregadas (web, requer aprovação) ·
⏳ 6 Agente Marketing (e2e) · ✅ 7 Agendamento + entrega
(4 e 6 dependem de `ANTHROPIC_API_KEY` para validação ao vivo.)
