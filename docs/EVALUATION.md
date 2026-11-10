# Evaluación de la recuperación

Set: 198 preguntas con respuesta (85 directas, 85 parafraseadas, 28 repreguntas) y 12 sin respuesta en los manuales.
Un fragmento cuenta como relevante si contiene la cita textual que responde la pregunta.

Resultados medidos sobre la instancia de demostración (12 de noviembre de 2026). Los números dependen de los modelos de embeddings, reranking y reescritura configurados: `npm run eval` los recalcula con tu configuración y reescribe este archivo.

| Configuración | Recall@1 | Recall@3 | Recall@5 | MRR@10 | nDCG@10 |
|---|---|---|---|---|---|
| Buscador anterior (léxico casero) | 46.0% | 54.0% | 57.6% | 0.506 | 0.527 |
| BM25 | 49.0% | 55.1% | 57.1% | 0.526 | 0.542 |
| Denso (embeddings) | 69.7% | 81.8% | 85.9% | 0.768 | 0.803 |
| Híbrido RRF k=60 | 50.5% | 65.7% | 73.2% | 0.612 | 0.681 |
| Híbrido convexo w=0.2 | 70.2% | 81.8% | 87.4% | 0.774 | 0.809 |
| Híbrido + reescritura | 77.8% | 86.9% | 91.9% | 0.837 | 0.866 |
| **Completo (+ reranking)** | **87.9%** | **93.9%** | **94.9%** | **0.911** | **0.923** |

### Recall@5 por tipo de pregunta

| Configuración | directas | parafraseadas | repreguntas |
|---|---|---|---|
| Buscador anterior (léxico casero) | 100.0% | 8.2% | 78.6% |
| BM25 | 100.0% | 8.2% | 75.0% |
| Denso (embeddings) | 98.8% | 81.2% | 60.7% |
| Híbrido RRF k=60 | 100.0% | 45.9% | 75.0% |
| Híbrido convexo w=0.2 | 100.0% | 81.2% | 67.9% |
| Híbrido + reescritura | 100.0% | 81.2% | 100.0% |
| Completo (+ reranking) | 100.0% | 88.2% | 100.0% |

### Decisión de evidencia (pipeline completo)

| Métrica | Valor |
|---|---|
| Fragmento correcto entre los enviados al modelo | 91.4% |
| Preguntas sin respuesta rechazadas correctamente | 100.0% (12/12) |
| Preguntas con respuesta rechazadas por error | 5.6% |

## Qué mostró la evaluación

- **Las preguntas parafraseadas rompen la búsqueda léxica:** BM25 encuentra el 8% de ellas; los embeddings, el 81%.
- **El RRF clásico (k=60) empeora a los embeddings solos:** aplana la diferencia entre los primeros puestos densos y BM25 los reordena. La fusión convexa con peso 0.2 para BM25 nunca empeora y ayuda con términos exactos.
- **La reescritura resuelve las repreguntas** ("¿y en dólares?"): de 68% a 100%.
- **El reranking sube el Recall@1 de 78% a 88%** y es lo que permite rechazar preguntas sin respuesta: la similitud coseno de esas preguntas se superpone con la de las que sí tienen respuesta.

## Cómo correrla

```bash
npm run eval            # todas las configuraciones (usa la API de Claude y, si hay clave, Voyage)
npm run eval -- --no-llm  # solo recuperación, sin reescritura ni reranking
node scripts/eval/sweep.ts  # barrido de la fusión (pesos, k de RRF, candidatos)
npm run eval:golden     # regenera el set de preguntas desde los manuales
```
