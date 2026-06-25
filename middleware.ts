export { default } from 'next-auth/middleware';

// Protege as PÁGINAS do dashboard (redireciona p/ /login se não autenticado).
// As rotas /api/* se autoguardam via isAuthed() e retornam 401 JSON — por isso
// /api fica fora do matcher (exceto pelo próprio /login e assets).
export const config = {
  matcher: [
    '/((?!login|api|_next/static|_next/image|favicon.ico).*)',
  ],
};
