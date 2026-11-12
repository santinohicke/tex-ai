// Normalización léxica en español para la búsqueda BM25.

export const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del',
  'a', 'al', 'en', 'para', 'por', 'con', 'sin', 'sobre', 'que', 'como',
  'cual', 'cuales', 'quien', 'quienes', 'era', 'es', 'son', 'fue', 'fueron',
  'ser', 'estar', 'haber', 'hay', 'tener', 'tiene', 'tienen', 'este', 'esta',
  'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella',
  'mi', 'tu', 'su', 'sus', 'nuestro', 'nuestra', 'me', 'te', 'se', 'nos',
  'le', 'les', 'lo', 'y', 'o', 'u', 'e', 'pero', 'mas', 'muy', 'ya', 'si', 'no',
  'dime', 'decime', 'explicame', 'sabes', 'puedes', 'decir', 'definicion',
  'cuando', 'donde', 'cuanto', 'cuantos', 'cuanta', 'cuantas', 'hace', 'hacer',
  'debo', 'puedo', 'deben', 'puede', 'pueden', 'segun', 'entre', 'tambien',
  'hs', 'etc',
]);

// Expansión de siglas del dominio (solo en la consulta).
export const ACRONYMS: Record<string, string[]> = {
  on: ['obligacion', 'negociable'],
  ons: ['obligacion', 'negociable'],
  fci: ['fondo', 'comun', 'inversion'],
  fcis: ['fondo', 'comun', 'inversion'],
  mep: ['dolar', 'bolsa'],
  ccl: ['contado', 'liquidacion', 'cable'],
  kyc: ['onboarding', 'identificacion', 'cliente'],
  aml: ['lavado', 'activo', 'prevencion'],
  pla: ['lavado', 'activo', 'prevencion'],
  uif: ['unidad', 'informacion', 'financiera'],
  cnv: ['comision', 'nacional', 'valor'],
  rofex: ['futuro', 'derivado', 'matba'],
  matba: ['futuro', 'derivado', 'rofex'],
  cvsa: ['caja', 'valor'],
  ros: ['reporte', 'operacion', 'sospechosa'],
  pep: ['persona', 'expuesta', 'politicamente'],
  var: ['valor', 'riesgo'],
  dma: ['acceso', 'directo', 'mercado'],
  mulc: ['mercado', 'cambio'],
};

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9+\s]/g, ' ');
}

// Stemmer liviano: reduce plurales y sufijos frecuentes para que
// "obligaciones negociables" y "obligación negociable" compartan términos.
export function stem(word: string): string {
  if (word.length <= 3 || /\d/.test(word)) return word;
  let w = word;
  if (w.endsWith('ces')) w = w.slice(0, -3) + 'z';
  else if (w.endsWith('iones')) w = w.slice(0, -2);
  else if (w.endsWith('es') && /[^aeiou]es$/.test(w) && !/(bles|ntes|rtes|stes|ctes)$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith('s') && !/(is|us)$/.test(w)) w = w.slice(0, -1);
  // sufijos derivativos (liquidación/liquidar/liquidada -> liquid)
  for (const suf of ['aciones', 'acion', 'amiento', 'imiento', 'adora', 'ador', 'ado', 'ada', 'ido', 'ida', 'ar', 'er', 'ir']) {
    if (w.length - suf.length >= 4 && w.endsWith(suf)) {
      w = w.slice(0, -suf.length);
      break;
    }
  }
  return w;
}

export function tokenize(text: string, opts: { expandAcronyms?: boolean } = {}): string[] {
  const out: string[] = [];
  for (const raw of normalize(text).split(/\s+/)) {
    if (raw.length < 2 || STOPWORDS.has(raw)) continue;
    out.push(stem(raw));
    if (opts.expandAcronyms && ACRONYMS[raw]) {
      for (const a of ACRONYMS[raw]) out.push(stem(a));
    }
  }
  return out;
}
