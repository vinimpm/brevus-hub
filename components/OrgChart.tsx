'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Plus } from 'lucide-react';
import type { AgentDTO } from '@/lib/types';
import type { ToolDef } from '@/hub/tool-registry';
import { AgentNodeCard, type AgentNodeData } from './AgentNodeCard';
import { AgentWizard } from './AgentWizard';
import { AgentPanel } from './AgentPanel';

const nodeTypes: NodeTypes = { agent: AgentNodeCard };

// Auto-layout simples por profundidade para nós ainda não posicionados (pos 0,0).
function autoLayout(agents: AgentDTO[]): Record<string, { x: number; y: number }> {
  const byParent = new Map<string | null, AgentDTO[]>();
  for (const a of agents) {
    const k = a.parentId;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(a);
  }
  const pos: Record<string, { x: number; y: number }> = {};
  const perDepthCount: number[] = [];
  function walk(id: string | null, depth: number) {
    const children = byParent.get(id) ?? [];
    for (const c of children) {
      perDepthCount[depth] = (perDepthCount[depth] ?? 0) + 1;
      const idx = perDepthCount[depth] - 1;
      pos[c.id] = { x: idx * 240 - 240, y: depth * 170 };
      walk(c.id, depth + 1);
    }
  }
  walk(null, 0);
  return pos;
}

interface Props {
  agents: AgentDTO[];
  tools: ToolDef[];
}

export function OrgChart({ agents, tools }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wizard, setWizard] = useState<
    { mode: 'create'; parentId: string | null } | { mode: 'edit'; agent: AgentDTO } | null
  >(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  const onAdd = useCallback((parentId: string) => setWizard({ mode: 'create', parentId }), []);
  const onSelect = useCallback((id: string) => setSelectedId(id), []);

  const layout = useMemo(() => autoLayout(agents), [agents]);

  const nodes: Node<AgentNodeData>[] = useMemo(
    () =>
      agents.map((a) => {
        const positioned = a.posX !== 0 || a.posY !== 0;
        const p = positioned ? { x: a.posX, y: a.posY } : layout[a.id] ?? { x: 0, y: 0 };
        return {
          id: a.id,
          type: 'agent',
          position: p,
          data: { agent: a, onAdd, onSelect, selected: selectedId === a.id },
        };
      }),
    [agents, layout, onAdd, onSelect, selectedId],
  );

  const edges: Edge[] = useMemo(
    () =>
      agents
        .filter((a) => a.parentId)
        .map((a) => ({
          id: `${a.parentId}-${a.id}`,
          source: a.parentId!,
          target: a.id,
          type: 'smoothstep',
          animated: a.lastRunStatus === 'RUNNING',
          style: { stroke: 'rgba(255,255,255,0.18)' },
        })),
    [agents],
  );

  const onNodeDragStop: NodeMouseHandler = useCallback(async (_e, node) => {
    await fetch(`/api/agents/${node.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posX: node.position.x, posY: node.position.y }),
    });
  }, []);

  const selected = agents.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-4 top-4 z-10">
        <button
          onClick={() => setWizard({ mode: 'create', parentId: null })}
          className="flex items-center gap-2 rounded-lg bg-brevus-purple hover:bg-brevus-purple-light px-3 py-2 text-sm font-medium shadow-lg"
        >
          <Plus className="h-4 w-4" /> Novo agente
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeDragStop={onNodeDragStop}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
      >
        <Background color="#2a2a3a" gap={20} />
        <Controls className="!bg-white/5 !border-white/10" />
        <MiniMap
          pannable
          className="!bg-black/40"
          nodeColor={() => '#6D28D9'}
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>

      {selected && (
        <AgentPanel
          agent={selected}
          onClose={() => setSelectedId(null)}
          onEdit={() => setWizard({ mode: 'edit', agent: selected })}
          onChanged={refresh}
        />
      )}

      {wizard && (
        <AgentWizard
          mode={wizard.mode}
          agents={agents}
          tools={tools}
          parentId={wizard.mode === 'create' ? wizard.parentId : null}
          initial={wizard.mode === 'edit' ? wizard.agent : undefined}
          onClose={() => setWizard(null)}
          onSaved={() => {
            setWizard(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
