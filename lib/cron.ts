import { NextRequest } from 'next/server';

// Guard fail-closed para endpoints de cron: sem CRON_SECRET configurado, ou
// header divergente, nega. Aceita header `x-cron-secret` ou `Authorization: Bearer`.
export function isValidCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail-closed
  const header = req.headers.get('x-cron-secret');
  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  return header === secret || bearer === secret;
}
