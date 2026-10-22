import fs from 'fs';
import path from 'path';
import { DocumentChunk, RetrievalResult } from './types';
import { chunkMarkdownDocument } from './chunker';

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del',
  'a', 'al', 'en', 'para', 'por', 'con', 'sin', 'sobre', 'que', 'como',
  'cual', 'cuales', 'quien', 'quienes', 'era', 'es', 'son', 'fue', 'fueron',
  'ser', 'estar', 'haber', 'hay', 'tener', 'tiene', 'tienen', 'este', 'esta',
  'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella',
  'mi', 'tu', 'su', 'sus', 'nuestro', 'nuestra', 'me', 'te', 'se', 'nos',
  'le', 'les', 'lo', 'y', 'o', 'pero', 'mas', 'muy', 'ya', 'si', 'no',
  'dime', 'decime', 'explicame', 'sabes', 'puedes', 'decir', 'definicion'
]);

const ACRONYMS: Record<string, string[]> = {
  on: ['obligacion', 'negociable', 'bono', 'deuda'],
  ons: ['obligacion', 'negociable', 'bono', 'deuda'],
  fci: ['fondo', 'comun', 'inversion', 'cuotaparte', 'money', 'market'],
  fcis: ['fondo', 'comun', 'inversion', 'cuotaparte'],
  mep: ['dolar', 'mep', 'bolsa', 'parking', 'al30'],
  ccl: ['contado', 'liquidacion', 'cable'],
  cedear: ['cedear', 'comafi', 'exterior', 'accion'],
  cedears: ['cedear', 'comafi', 'exterior', 'accion'],
  kyc: ['onboarding', 'apertura', 'identificacion', 'cliente', 'legajo'],
  aml: ['lavado', 'prevencion', 'uif', 'compliance'],
  uif: ['lavado', 'cumplimiento', 'ros', 'pep'],
  cnv: ['comision', 'valores', 'regulacion', 'normativa'],
  rofex: ['futuro', 'opcion', 'derivado', 'matba'],
  matba: ['futuro', 'opcion', 'derivado', 'rofex'],
  byma: ['bolsa', 'mercado', 'valores'],
  cvsa: ['caja', 'valores', 'custodia', 'subcuenta'],
  cbu: ['transferencia', 'banco', 'bancaria', 'cuenta'],
  cvu: ['transferencia', 'billetera', 'cuenta'],
};

function stemSpanish(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ces')) return word.slice(0, -3) + 'z';

  if (word.endsWith('es')) {
    if (word.endsWith('iones') || word.endsWith('siones')) return word.slice(0, -2);
    if (word.endsWith('ades') || word.endsWith('edes')) return word.slice(0, -2);
    if (word.endsWith('bles')) return word.slice(0, -1);
    const beforeEs = word.slice(0, -2);
    const lastChar = beforeEs.slice(-1);
    if (
      'aeiou'.includes(lastChar) ||
      beforeEs.endsWith('bl') ||
      beforeEs.endsWith('nt') ||
      beforeEs.endsWith('rt') ||
      beforeEs.endsWith('st') ||
      beforeEs.endsWith('ct')
    ) {
      return word.slice(0, -1);
    }
    return word.slice(0, -2);
  }

  if (word.endsWith('s') && !word.endsWith('is') && !word.endsWith('us')) {
    return word.slice(0, -1);
  }
  return word;
}

class MemoryVectorStore {
  private chunks: DocumentChunk[] = [];
  private initialized: boolean = false;

  private tokenize(text: string, isQuery: boolean = false): string[] {
    const rawWords = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Eliminar tildes
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !STOPWORDS.has(w));

    const tokens: string[] = [];
    for (const w of rawWords) {
      const stemmed = stemSpanish(w);
      tokens.push(stemmed);
      if (stemmed !== w) {
        tokens.push(w);
      }
      if (isQuery && ACRONYMS[w]) {
        tokens.push(...ACRONYMS[w]);
      }
    }
    return Array.from(new Set(tokens));
  }

  public init(policiesDir: string) {
    if (this.initialized) return;

    if (!fs.existsSync(policiesDir)) {
      console.warn(`Vector store: Directory not found: ${policiesDir}`);
      return;
    }

    const files = fs.readdirSync(policiesDir).filter((f) => f.endsWith('.md'));
    const allChunks: DocumentChunk[] = [];

    for (const file of files) {
      const fullPath = path.join(policiesDir, file);
      const docChunks = chunkMarkdownDocument(fullPath);
      allChunks.push(...docChunks);
    }

    this.chunks = allChunks;
    this.initialized = true;
    console.log(`Vector Store initialized: ${this.chunks.length} chunks indexed.`);
  }

  /**
   * Búsqueda semántica híbrida con lematización en español, expansión de acrónimos
   * y coincidencia ponderada en títulos, secciones y contenido.
   */
  public search(query: string, topK: number = 4): RetrievalResult[] {
    if (!this.initialized || this.chunks.length === 0) {
      const fallbackDir = path.join(process.cwd(), 'data', 'policies');
      this.init(fallbackDir);
    }

    const cleanQuery = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const queryTokens = this.tokenize(query, true);
    if (queryTokens.length === 0) return [];

    const scored: RetrievalResult[] = this.chunks.map((chunk) => {
      let score = 0;
      const contentTokens = this.tokenize(chunk.content);
      const titleTokens = this.tokenize(chunk.title);
      const sectionTokens = this.tokenize(chunk.section);

      const contentSet = new Set(contentTokens);
      const titleSet = new Set(titleTokens);
      const sectionSet = new Set(sectionTokens);

      const rawChunkContent = (chunk.title + ' ' + chunk.section + ' ' + chunk.content)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      // 1. Coincidencia de frase exacta
      if (cleanQuery.length > 5 && rawChunkContent.includes(cleanQuery)) {
        score += 20.0;
      }

      // 2. Coincidencias de tokens con pesos por campo
      let matchedInChunk = 0;
      for (const token of queryTokens) {
        let tokenMatched = false;

        if (sectionSet.has(token)) {
          score += 4.5;
          tokenMatched = true;
        } else {
          // Coincidencia por prefijo en sección
          for (const s of sectionSet) {
            if (token.length >= 4 && s.length >= 4 && (s.startsWith(token) || token.startsWith(s))) {
              score += 3.0;
              tokenMatched = true;
              break;
            }
          }
        }

        if (titleSet.has(token)) {
          score += 3.0;
          tokenMatched = true;
        } else {
          // Coincidencia por prefijo en título
          for (const t of titleSet) {
            if (token.length >= 4 && t.length >= 4 && (t.startsWith(token) || token.startsWith(t))) {
              score += 2.0;
              tokenMatched = true;
              break;
            }
          }
        }

        if (contentSet.has(token)) {
          const count = contentTokens.filter((t) => t === token).length;
          score += 1.5 + Math.log(count + 1);
          tokenMatched = true;
        } else {
          // Coincidencia por prefijo en contenido
          for (const c of contentSet) {
            if (token.length >= 4 && c.length >= 4 && (c.startsWith(token) || token.startsWith(c))) {
              score += 1.0;
              tokenMatched = true;
              break;
            }
          }
        }

        if (tokenMatched) {
          matchedInChunk++;
        }
      }

      // 3. Multiplicador si coinciden múltiples términos clave de la consulta
      if (matchedInChunk > 1) {
        score *= 1.0 + 0.4 * (matchedInChunk - 1);
      }

      return { chunk, score };
    });

    const filtered = scored.filter((r) => r.score > 0.5);
    const candidateList = filtered.length > 0 ? filtered : scored.filter((r) => r.score > 0);
    return candidateList.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  public getStats() {
    return {
      chunksCount: this.chunks.length,
      documents: Array.from(new Set(this.chunks.map((c) => c.sourceDoc))),
    };
  }
}

export const vectorStore = new MemoryVectorStore();
