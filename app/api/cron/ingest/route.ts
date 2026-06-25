import { NextRequest, NextResponse } from 'next/server';
import { isValidCron } from '@/lib/cron';
import { enqueueIngest } from '@/hub/queue';

export const dynamic = 'force-dynamic';

// Disparado pelo Railway cron. Enfileira a reindexação RAG (read-only).
export async function GET(req: NextRequest) {
  if (!isValidCron(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 });
  }
  await enqueueIngest();
  return NextResponse.json({ ok: true, queued: 'ingest' });
}
