import type { DocumentChunk } from './types.ts';

export interface ChunkOptions {
  maxChars: number; // tamaño máximo de un fragmento (sin el encabezado de contexto)
  overlapBlocks: number; // bloques (párrafos/viñetas) repetidos entre fragmentos consecutivos
  minChars: number; // secciones más cortas se fusionan con la siguiente
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = { maxChars: 900, overlapBlocks: 1, minChars: 160 };

interface Section {
  path: string[]; // [H2, H3]
  blocks: string[];
}

/**
 * Fragmentación estructural de un manual markdown:
 * 1. Cada sección H2/H3 es una unidad semántica (los manuales están escritos así).
 * 2. Las introducciones muy cortas de un H2 se fusionan con su primera subsección
 *    para no generar fragmentos sin contenido útil.
 * 3. Secciones largas se parten en ventanas de bloques (párrafos, viñetas, filas)
 *    con solapamiento, sin cortar nunca una viñeta por la mitad.
 * 4. Cada fragmento lleva un encabezado de contexto (documento > sección) que se
 *    indexa junto al texto, así "1.2 Proceso de Rescate" sabe que habla de FCI.
 */
export function chunkMarkdown(
  fileName: string,
  markdown: string,
  opts: ChunkOptions = DEFAULT_CHUNK_OPTIONS
): DocumentChunk[] {
  const docCode = fileName.split('_')[0];
  let title = fileName.replace(/\.md$/, '');
  const sections: Section[] = [];
  let h2 = '';
  let current: Section | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length && current) current.blocks.push(para.join(' ').trim());
    para = [];
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (line.startsWith('# ')) {
      title = line.slice(2).trim();
      continue;
    }
    const heading = line.match(/^(#{2,3})\s+(.*)$/);
    if (heading) {
      flushPara();
      const text = heading[2].trim();
      if (heading[1] === '##') h2 = text;
      current = { path: heading[1] === '##' ? [text] : [h2, text], blocks: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue; // metadatos del encabezado del manual
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flushPara();
      continue;
    }
    if (!line.trim()) {
      flushPara();
    } else if (/^\s*([*\-+]|\d+\.|\|)\s/.test(line) || line.startsWith('|')) {
      flushPara();
      current.blocks.push(line.trim());
    } else {
      para.push(line.trim());
    }
  }
  flushPara();

  // Fusionar secciones demasiado cortas (típicamente la intro de un H2) con la siguiente
  const merged: Section[] = [];
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const size = s.blocks.join('\n').length;
    const next = sections[i + 1];
    if (size < opts.minChars && next && next.path[0] === s.path[0]) {
      next.blocks = [...s.blocks, ...next.blocks];
      if (next.path.length === 1) next.path = s.path;
      continue;
    }
    if (size > 0) merged.push(s);
  }

  const chunks: DocumentChunk[] = [];
  for (const s of merged) {
    const windows: string[][] = [];
    let win: string[] = [];
    let len = 0;
    for (const b of s.blocks) {
      if (len + b.length > opts.maxChars && win.length) {
        windows.push(win);
        win = opts.overlapBlocks > 0 ? win.slice(-opts.overlapBlocks) : [];
        len = win.reduce((n, x) => n + x.length + 1, 0);
      }
      win.push(b);
      len += b.length + 1;
    }
    if (win.length) windows.push(win);

    windows.forEach((w, wi) => {
      const content = w.join('\n');
      const section = s.path.filter(Boolean).join(' > ');
      chunks.push({
        id: `${docCode}#${chunks.filter((c) => c.docCode === docCode).length + 1}`,
        docCode,
        sourceDoc: fileName,
        title,
        section: windows.length > 1 ? `${section} (${wi + 1}/${windows.length})` : section,
        content,
        contextText: `${title}\n${section}\n${content}`,
        tokensApprox: Math.ceil(content.length / 4),
      });
    });
  }
  return chunks;
}
