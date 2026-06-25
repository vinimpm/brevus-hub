import type { Config } from 'tailwindcss';

// Paleta alinhada à identidade Brevus (roxo + ciano) — ver brand-identity.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brevus: {
          purple: '#6D28D9',
          'purple-light': '#8B5CF6',
          cyan: '#06B6D4',
        },
      },
    },
  },
  plugins: [],
};

export default config;
