import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

// Auth single-tenant: só o dono entra, via credencial definida no ambiente
// (HUB_OWNER_EMAIL / HUB_OWNER_PASSWORD). Sem cadastro, sem banco de usuários.
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'Brevus Hub',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        const ownerEmail = process.env.HUB_OWNER_EMAIL;
        const ownerPassword = process.env.HUB_OWNER_PASSWORD;
        if (!ownerEmail || !ownerPassword) return null; // fail-closed

        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? '';
        if (email === ownerEmail.toLowerCase() && password === ownerPassword) {
          return { id: 'owner', name: 'Brevus', email: ownerEmail };
        }
        return null;
      },
    }),
  ],
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
};
