import fs from 'fs';
import path from 'path';
import { RagPipeline } from './pipeline.ts';

// Instancia única del pipeline en el servidor. Los embeddings de los manuales se
// calculan una vez y se guardan en data/index/ (se recalculan solo los fragmentos
// cuyo texto cambió).
let instance: RagPipeline | null = null;

export function getRagPipeline(): RagPipeline {
  if (instance) return instance;
  const dataDir = path.join(process.cwd(), 'data');
  const policiesDir = path.join(dataDir, 'policies');
  const cacheFile = path.join(dataDir, 'index', 'embeddings.json');
  const docs = fs.existsSync(policiesDir)
    ? fs
        .readdirSync(policiesDir)
        .filter((f) => f.endsWith('.md'))
        .sort()
        .map((f) => ({ file: f, text: fs.readFileSync(path.join(policiesDir, f), 'utf-8') }))
    : [];
  instance = new RagPipeline(docs, {
    cache: {
      load: () => {
        try {
          return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        } catch {
          return null;
        }
      },
      save: (entries) => {
        try {
          fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
          fs.writeFileSync(cacheFile, JSON.stringify(entries));
        } catch (e) {
          console.warn('No se pudo guardar el caché de embeddings:', e);
        }
      },
    },
  });
  console.log(`RAG: ${instance.chunks.length} fragmentos de ${docs.length} manuales.`);
  instance.ensureEmbeddings(); // en segundo plano; si falla, se reintenta en la primera consulta
  return instance;
}
