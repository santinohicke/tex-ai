# Pipeline RAG de Tex AI

```
Pregunta + historial
   │
   ├─ 1. Reescritura ........ si hay conversación previa, Claude (modelo rápido) la convierte en consulta autónoma
   │                           ("¿y en dólares?" → "horario de corte para depósitos en dólares")
   ├─ 2. Recuperación ....... BM25 (léxico, en español)  ┐
   │                           Embeddings (denso)         ┘→ fusión convexa (BM25 0.2 / denso 0.8)
   ├─ 3. Reranking .......... Claude puntúa 0-3 los 12 mejores candidatos
   ├─ 4. Decisión ........... ningún candidato ≥ 2 → "no hay información", sin llamar al modelo generador
   ├─ 5. Generación ......... Claude con fuentes numeradas, citas [n] obligatorias, streaming
   └─ 6. Validación ......... se verifica que las citas existan y qué fuentes se usaron
```

| Etapa | Modelo por defecto | Variable |
|---|---|---|
| Reescritura y reranking | `claude-haiku-5-5` (sin razonamiento extendido, salida JSON con esquema) | `RAG_FAST_MODEL` |
| Generación | `claude-opus-5-5` (esfuerzo `low`, streaming, reintento del lado del servidor si declina) | `CLAUDE_MODEL`, `CLAUDE_EFFORT` |
| Embeddings (opcional) | `voyage-3.5`, 1024 dimensiones | `VOYAGE_API_KEY`, `RAG_EMBEDDING_MODEL` |

Claude no tiene un modelo de embeddings propio; Anthropic recomienda Voyage AI para eso. La búsqueda densa es opcional: sin `VOYAGE_API_KEY` el pipeline usa BM25 + reranking de Claude.

Cada respuesta guarda una **traza** con todas las etapas: consulta reescrita, posiciones y puntajes de BM25 y del denso, fusión, relevancia del reranking, decisión, tiempos y citas. Se ve con el botón **Inspector**, solo con sesión iniciada: en un RAG interno esa información (estructura de los manuales, identificadores y puntajes) no debería ser pública.

## Decisiones y por qué

**RAG y no fine-tuning.** Los manuales cambian, las respuestas tienen que poder citarse y el costo tiene que ser bajo. Con RAG, actualizar un manual es reemplazar un `.md`. Los embeddings se recalculan solo para los fragmentos cuyo texto cambió (caché por hash en `data/index/`).

**Fragmentación estructural.** Los manuales están organizados en secciones `##`/`###`, y cada una es una unidad de sentido, así que se corta por encabezados y no por tokens fijos:
- Las introducciones de menos de 160 caracteres se fusionan con su primera subsección.
- Las secciones de más de 900 caracteres se parten en ventanas de párrafos o viñetas, con un bloque de solapamiento y sin cortar viñetas.
- Cada fragmento se indexa con su contexto (`Manual > Sección > Subsección`), porque "2.2 Proceso de Rescate" solo tiene sentido sabiendo que es de FCI.

Resultado: 85 fragmentos, mediana de 430 caracteres. En el set de evaluación ninguna respuesta quedó partida entre dos fragmentos.

**Búsqueda híbrida con peso bajo para BM25.** Lo decidió la evaluación, no la intuición:
- **BM25 solo:** acierta el 100% de las preguntas que usan las palabras del manual, pero solo el 8% de las parafraseadas.
- **RRF clásico (k=60):** empeoró a los embeddings solos (Recall@5 de 86% a 73%). Aplana tanto la diferencia entre el 1.º y el 2.º denso que cualquier aporte de BM25 los reordena.
- **Fusión convexa con BM25 al 0.2:** nunca empeora a los embeddings y ayuda con términos exactos (tags FIX, especies como AL30). Es la que quedó.

El barrido completo está en `scripts/eval/sweep.ts`.

**Reranking con Claude.** La similitud coseno ordena bien, pero no sirve para decidir si hay respuesta: la similitud máxima de las preguntas sin respuesta en los manuales (mediana 0.66) se superpone con la de las que sí la tienen (0.74). Un modelo rápido que puntúa "¿este fragmento contiene el dato pedido?" separa los dos casos.

**Decisión de evidencia antes de generar.** Si nada supera relevancia 2, se responde "no está en los manuales" sin invocar al modelo generador. Así se evita la alucinación más peligrosa, la que inventa plazos o montos plausibles, y además no se gastan tokens.

**Planes B:**
- **Sin embeddings** (sin clave, cuota o red): BM25.
- **Sin reranking:** top-K de la fusión, con un umbral de similitud permisivo. Las reglas del prompt obligan a aclarar lo que no figura.

Cada fallo queda registrado en la traza.

## Depurar una respuesta incorrecta

Con el Inspector se revisa etapa por etapa:
1. **Reescritura:** ¿la consulta se entendió bien?
2. **Recuperación:** ¿el fragmento correcto aparece en BM25 o en el denso?
3. **Fusión:** ¿quedó en los 12 candidatos?
4. **Reranking:** ¿le dio relevancia ≥ 2?
5. **Generación:** ¿citó la fuente correcta?

Para cambios en el pipeline se mide antes y después con `npm run eval`.

## Evaluación

Ver [EVALUATION.md](./EVALUATION.md). El set (`scripts/eval/golden.json`) tiene:
- **198 preguntas con respuesta:** directas, parafraseadas con lenguaje coloquial y repreguntas que dependen de la conversación. Las generó un LLM a partir de cada fragmento (`scripts/eval/build-golden.ts`) y se validó que la cita fuera textual.
- **12 preguntas del dominio sin respuesta** en los manuales.

Un fragmento cuenta como relevante si contiene la cita textual. Así el mismo set sirve para comparar estrategias de fragmentación distintas.
