'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { AgentDTO } from '@/lib/types';
import type { ToolDef } from '@/hub/tool-registry';

const MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (rápido/barato)' },
  { value: 'claude-opus-4-8', label: 'Opus 4.8 (análise profunda)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (leve)' },
];

const SCHEDULES = [
  { value: 'manual', label: 'Manual' },
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
];

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

interface Props {
  mode: 'create' | 'edit';
  agents: AgentDTO[];
  tools: ToolDef[];
  parentId: string | null;
  initial?: AgentDTO;
  onClose: () => void;
  onSaved: () => void;
}

export function AgentWizard({ mode, agents, tools, parentId, initial, onClose, onSaved }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  const [role, setRole] = useState(initial?.role ?? '');
  const [model, setModel] = useState(initial?.model ?? 'claude-sonnet-4-6');
  const [schedule, setSchedule] = useState(initial?.schedule ?? 'manual');
  const [parent, setParent] = useState<string | null>(initial?.parentId ?? parentId ?? null);
  const [selectedTools, setSelectedTools] = useState<string[]>(initial?.allowedTools ?? []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const parentName = agents.find((a) => a.id === (parentId ?? initial?.parentId))?.name;

  function toggleTool(t: string) {
    setSelectedTools((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function submit() {
    setSaving(true);
    setError('');
    const payload = {
      name,
      slug: slug || slugify(name),
      role,
      model,
      schedule,
      parentId: parent,
      allowedTools: selectedTools,
    };
    const url = mode === 'create' ? '/api/agents' : `/api/agents/${initial!.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Não foi possível salvar.');
      return;
    }
    onSaved();
  }

  // Agrupa tools por categoria para a UI.
  const byCategory = tools.reduce<Record<string, ToolDef[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-[#14141f] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">
            {mode === 'create' ? 'Novo agente' : `Editar ${initial?.name}`}
            {parentName && mode === 'create' && (
              <span className="text-white/40 font-normal"> · sob {parentName}</span>
            )}
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-white/50">Nome</span>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-brevus-purple-light"
                placeholder="SEO Agent"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/50">Slug</span>
              <input
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-brevus-purple-light font-mono"
                placeholder="seo-agent"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-white/50">Função (system prompt)</span>
            <textarea
              value={role}
              onChange={(e) => setRole(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-brevus-purple-light resize-y"
              placeholder="Descreva o papel do agente, o que ele deve analisar e como deve reportar."
            />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs text-white/50">Pai</span>
              <select
                value={parent ?? ''}
                onChange={(e) => setParent(e.target.value || null)}
                className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 px-2 py-2 text-sm outline-none focus:border-brevus-purple-light"
              >
                <option value="">— raiz —</option>
                {agents
                  .filter((a) => a.id !== initial?.id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-white/50">Modelo</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 px-2 py-2 text-sm outline-none focus:border-brevus-purple-light"
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-white/50">Agenda</span>
              <select
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 px-2 py-2 text-sm outline-none focus:border-brevus-purple-light"
              >
                {SCHEDULES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <span className="text-xs text-white/50">Tools (capacidades)</span>
            <div className="mt-2 space-y-3">
              {Object.entries(byCategory).map(([cat, list]) => (
                <div key={cat}>
                  <span className="text-[10px] uppercase tracking-wide text-white/30">{cat}</span>
                  <div className="mt-1 grid grid-cols-1 gap-1">
                    {list.map((t) => (
                      <label
                        key={t.slug}
                        className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTools.includes(t.slug)}
                          onChange={() => toggleTool(t.slug)}
                          className="mt-0.5 accent-brevus-purple"
                        />
                        <span className="min-w-0">
                          <span className="text-sm flex items-center gap-1.5">
                            {t.label}
                            {t.external && (
                              <span className="text-[9px] rounded bg-amber-500/20 text-amber-300 px-1">
                                externa
                              </span>
                            )}
                          </span>
                          <span className="block text-[11px] text-white/40">{t.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-white/60 hover:text-white"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={saving || !name || !role}
              className="rounded-lg bg-brevus-purple hover:bg-brevus-purple-light px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Salvando…' : mode === 'create' ? 'Criar agente' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
