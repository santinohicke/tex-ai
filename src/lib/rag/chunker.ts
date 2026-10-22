import fs from 'fs';
import path from 'path';
import { DocumentChunk } from './types';

/**
 * Divide documentos markdown en chunks estructurados por encabezados H2 / H3.
 * Preserva contexto del documento (título, sección y origen).
 */
export function chunkMarkdownDocument(filePath: string): DocumentChunk[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  
  const lines = content.split('\n');
  let currentDocTitle = fileName.replace(/\.[^/.]+$/, '');
  let currentSection = 'General';
  let buffer: string[] = [];
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;

  for (const line of lines) {
    if (line.startsWith('# ')) {
      currentDocTitle = line.replace('# ', '').trim();
    } else if (line.startsWith('## ') || line.startsWith('### ')) {
      if (buffer.length > 0) {
        const text = buffer.join('\n').trim();
        if (text.length > 40) {
          chunks.push({
            id: `${fileName}-chunk-${chunkIndex++}`,
            sourceDoc: fileName,
            title: currentDocTitle,
            section: currentSection,
            content: text,
            tokensApprox: Math.ceil(text.length / 4)
          });
        }
        buffer = [];
      }
      currentSection = line.replace(/^#+\s*/, '').trim();
    } else {
      buffer.push(line);
    }
  }

  if (buffer.length > 0) {
    const text = buffer.join('\n').trim();
    if (text.length > 40) {
      chunks.push({
        id: `${fileName}-chunk-${chunkIndex++}`,
        sourceDoc: fileName,
        title: currentDocTitle,
        section: currentSection,
        content: text,
        tokensApprox: Math.ceil(text.length / 4)
      });
    }
  }

  return chunks;
}
