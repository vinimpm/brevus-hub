import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Garante que há sessão (dono logado). Retorna true se autorizado.
export async function isAuthed(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user;
}
