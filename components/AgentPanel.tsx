'use client';

import { useState } from 'react';
import { X, Play, Pencil, Power, Trash2 } from 'lucide-react';
import type { AgentDTO } from '@/lib/types';
import { getTool } from '@/hub/tool-registry';

interface Props {
  agent: AgentDTO;
  onClose: () => void;
  onEdit: () => void;
  onChanged: () => void;
}

export function AgentPanel({ agent, onClose, onEdit, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function run() {
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, trigger: 'manual' }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg('Run enfileirado.');
      onChanged();
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error || 'Falha ao enfileirar.');
    }
  }

  async function toggleEnabled() {
    setBusy(true);
    await fetch(`/api/agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !agent.enabled }),
    });
    setBusy(false);
    onChanged();
  }

  async function remove() {
    if (!confirm(`Excluir o agente "${agent.name}"?`)) return;
    setBusy(true);
    const res = await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) {
      onClose();
      onChanged();
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error || 'Não foi possível excluir.');
    }
  }

  return (
    <div className="absolute right-0 top-0 h-full w-80 border-l border-white/10 bg-[#0f0f17] p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{agent.name}</h3>
        <button onClick={onClose} className="text-white/50 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded bg-white/5 px-2 py-0.5 font-mono">{agent.slug}</span>
          <span className="rounded bg-white/5 px-2 py-0.5">{agent.model}</span>
          <span className="rounded bg-white/5 px-2 py-0.5">{agent.schedule}</span>
          <span className={`rounded px-2 py-0.5 ${agent.enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white/40'}`}>
            {agent.enabled ? 'ativo' : 'pausado'}
          </span>
        </div>

        <div>
          <span className="text-xs text-white/40">Função</span>
          <p className="mt-1 text-white/70 text-[13px] leading-relaxed">{agent.role}</p>
        </div>

        <div>
          <span className="text-xs text-white/40">Tools ({agent.allowedTools.length})</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {agent.allowedTools.map((t) => (
              <span key={t} className="rounded bg-brevus-purple/15 text-brevus-purple-light px-2 py-0.5 text-[11px]">
                {getTool(t)?.label ?? t}
              </span>
            ))}
            {agent.allowedTools.length === 0 && (
              <span className="text-white/30 text-[12px]">nenhuma</span>
            )}
          </div>
        </div>

        <div className="flex gap-3 text-[12px] text-white/50">
          <span>{agent.runsCount} runs</span>
          <span>{agent.findingsCount} findings</span>
        </div>

        {msg && <p className="text-[12px] text-brevus-cyan">{msg}</p>}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={run}
            disabled={busy || !agent.enabled}
            className="col-span-2 flex items-center justify-center gap-2 rounded-lg bg-brevus-purple hover:bg-brevus-purple-light py-2 text-sm font-medium disabled:opacity-50"
          >
            <Play className="h-4 w-4" /> Rodar agora
          </button>
          <button
            onClick={onEdit}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-lg border border-white/10 hover:bg-white/5 py-2 text-sm"
          >
            <Pencil className="h-4 w-4" /> Editar
          </button>
          <button
            onClick={toggleEnabled}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-lg border border-white/10 hover:bg-white/5 py-2 text-sm"
          >
            <Power className="h-4 w-4" /> {agent.enabled ? 'Pausar' : 'Ativar'}
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="col-span-2 flex items-center justify-center gap-2 rounded-lg border border-red-500/20 text-red-300 hover:bg-red-500/10 py-2 text-sm"
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
