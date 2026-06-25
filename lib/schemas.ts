import { z } from 'zod';
import { TOOL_SLUGS } from '@/hub/tool-registry';

const slug = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífen.');

export const agentCreateSchema = z.object({
  name: z.string().min(2).max(60),
  slug: slug,
  role: z.string().min(10, 'Descreva a função do agente (system prompt).'),
  // "" (sem pai selecionado no form) é tratado como raiz (null).
  parentId: z
    .preprocess((v) => (v === '' ? null : v), z.string().nullable().optional()),
  model: z.enum(['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']),
  allowedTools: z
    .array(z.string())
    .refine((tools) => tools.every((t) => TOOL_SLUGS.includes(t)), {
      message: 'Tool inválida (fora do registry).',
    }),
  schedule: z.string().default('manual'),
  posX: z.number().optional(),
  posY: z.number().optional(),
});

export const agentUpdateSchema = agentCreateSchema.partial().extend({
  enabled: z.boolean().optional(),
});

export type AgentCreateInput = z.infer<typeof agentCreateSchema>;
export type AgentUpdateInput = z.infer<typeof agentUpdateSchema>;
