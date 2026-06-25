import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Healthcheck do Railway. Verifica o app e (best-effort) a conexão ao DB.
export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  return NextResponse.json({ status: 'ok', db, ts: new Date().toISOString() });
}
