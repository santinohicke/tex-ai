'use client';

import React from 'react';
import { Check, AlertTriangle, CornerDownRight } from 'lucide-react';

export interface InspectorTrace {
  query: string;
  standaloneQuery: string;
  rewritten: boolean;
  bm25: { id: string; score: number }[];
  dense: { id: string; score: number }[] | null;
  denseError?: string;
  fused: { id: string; score: number; bm25Rank: number | null; denseRank: number | null }[];
  rerank: { id: string; relevance: number }[] | null;
  rerankError?: string;
  selected: string[];
  decision: 'answer' | 'insufficient_evidence';
  decisionReason: string;
  timingsMs: Record<string, number>;
  config: Record<string, string | number | boolean>;
  labels?: Record<string, { title: string; section: string }>;
  generation?: {
    ms: number;
    provider: string;
    citedSources: number[];
    invalidCitations: number[];
    uncited: boolean;
  } | null;
}

const STAGE_NAMES: Record<string, string> = {
  rewrite: 'Reescritura',
  retrieval: 'BM25 + embeddings',
  rerank: 'Reranking',
  total: 'Recuperación total',
};

function RelevanceDots({ value }: { value: number | undefined }) {
  if (value === undefined) return <span className="text-[#b5ad9f]">–</span>;
  return (
    <span className="inline-flex items-center space-x-0.5" title={`Relevancia ${value}/3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= value ? 'bg-[#cc785c]' : 'bg-[#ded5c6]'}`} />
      ))}
    </span>
  );
}

/** Panel que muestra cada etapa del pipeline RAG para una respuesta. */
export default function RagInspector({ trace }: { trace: InspectorTrace }) {
  const rel = new Map((trace.rerank || []).map((r) => [r.id, r.relevance]));
  const denseScore = new Map((trace.dense || []).map((r) => [r.id, r.score]));
  const bm25Score = new Map(trace.bm25.map((r) => [r.id, r.score]));
  const selected = new Set(trace.selected);
  const timings = Object.entries(trace.timingsMs).filter(([k]) => k !== 'total');
  if (trace.generation) timings.push(['generation', trace.generation.ms]);
  const label = (id: string) => trace.labels?.[id];

  return (
    <div className="mt-2.5 rounded-xl border border-[#ded5c6] bg-[#ece5d8]/60 p-3 text-[11px] text-[#32312e] space-y-3 animate-fadeIn">
      {/* Consulta */}
      <div>
        <div className="font-semibold text-[#141413] mb-0.5">Consulta</div>
        <div className="text-[#6c6860]">{trace.query}</div>
        {trace.rewritten && (
          <div className="flex items-start mt-1 text-[#6c6860]">
            <CornerDownRight className="h-3 w-3 mr-1 mt-0.5 text-[#cc785c] flex-shrink-0" />
            <span>
              <span className="text-[#8e887e]">Reescrita con el contexto: </span>
              {trace.standaloneQuery}
            </span>
          </div>
        )}
      </div>

      {/* Tiempos */}
      <div className="flex flex-wrap gap-1.5">
        {timings.map(([k, ms]) => (
          <span key={k} className="px-2 py-0.5 rounded-md bg-[#f4efe6] border border-[#ded5c6] font-mono">
            {k === 'generation' ? 'Generación' : STAGE_NAMES[k] || k}: {ms} ms
          </span>
        ))}
      </div>

      {/* Candidatos */}
      <div>
        <div className="font-semibold text-[#141413] mb-1">
          Candidatos <span className="font-normal text-[#8e887e]">(fusión de BM25 y embeddings → reranking)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-[#8e887e]">
                <th className="py-1 pr-2 font-medium">Fragmento</th>
                <th className="py-1 px-1.5 font-medium text-right" title="Posición y puntaje BM25">BM25</th>
                <th className="py-1 px-1.5 font-medium text-right" title="Posición y similitud coseno">Denso</th>
                <th className="py-1 px-1.5 font-medium text-right" title="Puntaje de la fusión">Fusión</th>
                <th className="py-1 px-1.5 font-medium text-center">Rerank</th>
                <th className="py-1 pl-1.5 font-medium text-center">Usado</th>
              </tr>
            </thead>
            <tbody>
              {trace.fused.map((f) => (
                <tr key={f.id} className={`border-t border-[#ded5c6] ${selected.has(f.id) ? 'text-[#141413]' : 'text-[#8e887e]'}`}>
                  <td className="py-1 pr-2 max-w-[260px]">
                    <div className="truncate" title={label(f.id) ? `${label(f.id)!.title} > ${label(f.id)!.section}` : f.id}>
                      {label(f.id)?.section || f.id}
                    </div>
                    <div className="font-mono text-[10px] text-[#b5ad9f]">{f.id}</div>
                  </td>
                  <td className="py-1 px-1.5 text-right font-mono whitespace-nowrap">
                    {f.bm25Rank ? `#${f.bm25Rank} · ${bm25Score.get(f.id)?.toFixed(1) ?? ''}` : '–'}
                  </td>
                  <td className="py-1 px-1.5 text-right font-mono whitespace-nowrap">
                    {f.denseRank ? `#${f.denseRank} · ${denseScore.get(f.id)?.toFixed(2) ?? ''}` : '–'}
                  </td>
                  <td className="py-1 px-1.5 text-right font-mono">{f.score.toFixed(3)}</td>
                  <td className="py-1 px-1.5 text-center">
                    <RelevanceDots value={rel.get(f.id)} />
                  </td>
                  <td className="py-1 pl-1.5 text-center">
                    {selected.has(f.id) && <Check className="h-3.5 w-3.5 inline text-[#5db872]" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decisión */}
      <div className="flex items-start">
        {trace.decision === 'answer' ? (
          <Check className="h-3.5 w-3.5 mr-1.5 mt-px text-[#5db872] flex-shrink-0" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 mr-1.5 mt-px text-[#c9a227] flex-shrink-0" />
        )}
        <span>
          <span className="font-semibold text-[#141413]">
            {trace.decision === 'answer' ? 'Respondió' : 'No respondió (evidencia insuficiente)'}:
          </span>{' '}
          {trace.decisionReason}
          {trace.generation && (
            <>
              {' '}
              · citó {trace.generation.citedSources.length ? trace.generation.citedSources.map((n) => `[${n}]`).join('') : 'ninguna fuente'}
              {trace.generation.invalidCitations.length > 0 && ` · citas inválidas: ${trace.generation.invalidCitations.join(', ')}`}
            </>
          )}
        </span>
      </div>

      {(trace.denseError || trace.rerankError) && (
        <div className="text-[#a9583e]">
          {trace.denseError && <div>Embeddings no disponibles (solo BM25): {trace.denseError.slice(0, 140)}</div>}
          {trace.rerankError && <div>Reranking no disponible (se usó la fusión): {trace.rerankError.slice(0, 140)}</div>}
        </div>
      )}

      <div className="text-[10px] text-[#8e887e] font-mono">
        {Object.entries(trace.config)
          .map(([k, v]) => `${k}=${v}`)
          .join(' · ')}
        {trace.generation ? ` · generación: ${trace.generation.provider}` : ''}
      </div>
    </div>
  );
}
