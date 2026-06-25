'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { Plus, Shield, Megaphone, Network, Bot, Pause } from 'lucide-react';
import type { AgentDTO } from '@/lib/types';

export interface AgentNodeData {
  agent: AgentDTO;
  onAdd: (parentId: string) => void;
  onSelect: (id: string) => void;
  selected: boolean;
}

const statusColor: Record<string, string> = {
  RUNNING: 'bg-amber-400 animate-pulse',
  SUCCEEDED: 'bg-emerald-400',
  FAILED: 'bg-red-400',
  QUEUED: 'bg-sky-400',
  CANCELED: 'bg-white/30',
};

function iconFor(slug: string) {
  if (slug.includes('cyber') || slug.includes('seg')) return Shield;
  if (slug.includes('market') || slug.includes('mkt') || slug.includes('seo')) return Megaphone;
  if (slug.includes('orquestr') || slug.includes('diretor')) return Network;
  return Bot;
}

export function AgentNodeCard({ data }: NodeProps<AgentNodeData>) {
  const { agent, onAdd, onSelect, selected } = data;
  const Icon = iconFor(agent.slug);

  return (
    <div
      onClick={() => onSelect(agent.id)}
      className={[
        'group relative w-52 rounded-xl border bg-[#14141f] px-3 py-2.5 cursor-pointer transition-colors',
        selected ? 'border-brevus-purple-light shadow-lg shadow-brevus-purple/20' : 'border-white/10 hover:border-white/25',
        agent.enabled ? '' : 'opacity-60',
      ].join(' ')}
    >
      <Handle type="target" position={Position.Top} className="!bg-white/30 !border-0" />

      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brevus-purple/20 text-brevus-purple-light">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{agent.name}</span>
            {!agent.enabled && <Pause className="h-3 w-3 text-white/40" />}
          </div>
          <span className="block truncate text-[11px] text-white/40">{agent.model}</span>
        </div>
        {agent.lastRunStatus && (
          <span
            className={`h-2 w-2 rounded-full ${statusColor[agent.lastRunStatus] ?? 'bg-white/20'}`}
            title={`Último run: ${agent.lastRunStatus}`}
          />
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 text-[11px] text-white/45">
        <span className="rounded bg-white/5 px-1.5 py-0.5">{agent.schedule}</span>
        <span>{agent.allowedTools.length} tools</span>
        {agent.findingsCount > 0 && (
          <span className="text-amber-300/80">{agent.findingsCount} findings</span>
        )}
      </div>

      {/* Botão "+" para adicionar sub-agente */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd(agent.id);
        }}
        title="Adicionar sub-agente"
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-[#1c1c2b] text-white/60 opacity-0 group-hover:opacity-100 hover:text-white hover:border-brevus-purple-light transition-all"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      <Handle type="source" position={Position.Bottom} className="!bg-white/30 !border-0" />
    </div>
  );
}
