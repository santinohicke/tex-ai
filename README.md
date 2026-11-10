# Tex AI — Asistente RAG de normativa financiera

[![CI / Security Audit & Quality Verification](https://github.com/santinohicke/tex-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/santinohicke/tex-ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16.4.2-black.svg)](https://nextjs.org/)
[![Claude API](https://img.shields.io/badge/Claude-API-cc785c.svg)](https://docs.anthropic.com/)

> Asistente de operaciones, mercado de capitales y compliance que responde **solo** con lo que dicen los manuales de la firma, cita cada dato y dice "no está en los manuales" antes que inventar. Búsqueda híbrida (BM25 + embeddings), reranking y generación con **Claude**, medido con una evaluación propia: **Recall@5 de 95%** (antes 58%).

**Demo:** [tex-ai-app.pages.dev](https://tex-ai-app.pages.dev) — sin sesión podés probar las consultas frecuentes; el chat libre y el historial requieren token.

---

## 1. El Problema que Resuelve

En mesas de dinero, sociedades de bolsa (ALyCs), administradoras de fondos y entidades financieras, los equipos de operaciones, liquidaciones, compliance y atención al cliente enfrentan desafíos críticos:

1. **Dispersión y Complejidad Normativa:** Las regulaciones de mercado (CNV, UIF, BCRA, BYMA, Matba Rofex) y los manuales operativos internos se encuentran fragmentados en decenas de documentos técnicos, circulares y resoluciones extensas.
2. **Riesgo de Alucinación en Modelos Genéricos:** Los modelos de inteligencia artificial tradicionales tienden a inventar plazos de liquidación, períodos de parking, regímenes impositivos o requisitos de justificación de fondos cuando no disponen de contexto explícito y restringido.
3. **Respuestas que no se pueden auditar:** Una respuesta sin fuente no sirve en operaciones ni en compliance: hay que poder ver de qué manual y sección sale cada dato.

### La solución
Tex AI conecta al operador con los manuales verificados de la firma. Cada respuesta cita su fuente (`[1]`, clickeable), y si la información no está en los manuales lo dice en lugar de inventar.

---

## 2. Arquitectura

```
Navegador ── Cloudflare Pages (proxy + estáticos + copia offline) ── Tailscale Funnel ── servidor (Docker)
                                                                                         │
                       Next.js 16 · API /api/chat (sesión HMAC + rate limit) ────────────┘
                                         │
     1. Reescritura de repreguntas ──────┤  Claude Haiku, solo si hay historial
     2. BM25 (español) + embeddings ─────┤  fusión convexa calibrada (0.2 / 0.8)
     3. Reranking 0-3 de 12 candidatos ──┤  Claude Haiku, salida JSON con esquema
     4. Decisión de evidencia ───────────┤  sin evidencia → "no está en los manuales" (sin generar)
     5. Generación con citas [n] ────────┤  Claude Opus, streaming
     6. Validación de citas + traza ─────┘  visible en el Inspector de cada respuesta
```

Detalle de cada decisión en [docs/RAG.md](docs/RAG.md) y métricas en [docs/EVALUATION.md](docs/EVALUATION.md).

---

## 3. Características

### Recuperación híbrida medida, no supuesta
* **Fragmentación estructural:** por secciones del manual, con tamaño máximo, solapamiento por bloques y el contexto `Manual > Sección` indexado en cada fragmento.
* **BM25 + embeddings:** BM25 con stemming y siglas del dominio para términos exactos; embeddings (Voyage AI, el proveedor que recomienda Anthropic para Claude) para preguntas parafraseadas. La forma de combinarlos se eligió con un barrido de parámetros (`scripts/eval/sweep.ts`). Sin clave de Voyage funciona con BM25 + reranking.
* **Reranking y decisión de evidencia:** Claude puntúa si cada candidato contiene el dato pedido; si ninguno alcanza el umbral, responde que la información no figura.
* **Repreguntas:** "¿y en dólares?" se reescribe con la conversación antes de buscar.
* **Citas verificadas:** cada dato lleva su fuente `[n]`, clickeable, y se valida que las citas existan.
* **Evaluación reproducible:** `npm run eval` mide Recall@K, MRR y nDCG sobre 198 preguntas con respuesta (directas, coloquiales y repreguntas) y 12 sin respuesta.

### Modo público y modo con sesión
* **Sin sesión:** cuatro consultas frecuentes con respuestas pre-generadas que se resuelven en el navegador: no llaman a la API, no gastan tokens y no guardan nada en el servidor.
* **Con sesión (token):** chat libre, historial persistente e **Inspector**, que muestra cada etapa del pipeline (consulta reescrita, puntajes BM25 y densos, fusión, reranking, decisión y tiempos). Es solo para usuarios autenticados: en un RAG interno esa información no debería ser pública.
* **Efecto de tipeo y scroll de lectura:** la vista sigue la respuesta hasta que la pregunta llega arriba y ahí se queda quieta.

### Seguridad y control de acceso
* **Sesiones firmadas con HMAC-SHA256** y comparación en tiempo constante (`timingSafeEqual`).
* **Sin secretos en el código:** el token de acceso y el secreto de firma se configuran solo por variables de entorno; sin `ACCESS_TOKEN` no se puede iniciar sesión.
* **Rate limiting doble:** 5 intentos de login por minuto por IP y 12 consultas de chat por minuto.
* **Entradas acotadas:** historial y longitud de mensajes limitados antes de llegar al modelo.

### Persistencia liviana
* Historial en `data/chats/` (índice + un JSON por conversación) y caché de embeddings en `data/index/`, montados como volumen de Docker.

---

## 4. Base de Conocimiento Normativa (14 Manuales Operativos)

La base documental precargada en `data/policies/` cubre exhaustivamente el ecosistema financiero:

| Código | Área Temática | Aspectos Clave Cubiertos |
| :--- | :--- | :--- |
| `TEX-EQT-008` | Renta Variable Local (BYMA) | Panel Líder (S&P Merval), Panel General, ruedas CI y 24hs, fechas ex-cupón, dividendos y splits. |
| `TEX-FX-009` | Mercado de Cambios (MULC / BCRA) | Pagos de importaciones, liquidación de exportaciones y restricción cruzada de 90 días con MEP/CCL. |
| `TEX-RSK-010` | Gestión de Riesgo Financiero | VaR paramétrico e histórico (99%), Stress Testing, aforos en garantías y contingencia de liquidez. |
| `TEX-TAX-011` | Régimen Tributario Bursátil | Tratamiento en Impuesto a las Ganancias y Bienes Personales para bonos, ONs, acciones y CEDEARs. |
| `TEX-API-012` | DMA y Conectividad FIX 4.4 | Protocolo FIX 4.4, tags de orden, motor de riesgo Pre-Trade, API REST y Market Data WebSocket L1/L2. |
| `TEX-FCI-001` | Fondos Comunes de Inversión | Plazos de liquidación (T+0, T+1, T+2), horarios de corte (cut-off), valor de cuotaparte (NAV). |
| `TEX-ON-002` | Obligaciones Negociables (ONs) | Clases Hard Dollar, Dólar Linked, tramos competitivo y no competitivo en licitaciones, covenants y calificación. |
| `TEX-FUT-003` | Futuros y Opciones (Matba Rofex) | Contratos de Dólar A 3500, diferencias diarias Mark-to-Market, márgenes de garantía y coberturas con Puts/Calls. |
| `TEX-GLOS-012` | Glosario Bursátil y Cauciones | Operatoria de Dólar MEP/CCL, parking normativo de 1 día hábil, cauciones colocadoras y tomadoras con aforo. |
| `TEX-OPS-004` | Transferencias y Custodia | Principio de titularidad espejo (BCRA), transferencias bancarias locales, liquidación internacional Euroclear/DTC y CVSA. |
| `TEX-CMP-005` | Cumplimiento PLA/FT (UIF) | Enfoque Basado en Riesgo (EBR), umbrales de justificación de fondos, personas expuestas políticamente (PEP) y ROS. |
| `TEX-OPS-007` | Onboarding de Clientes | Apertura digital biométrica, validación Renaper/ARCA, test del inversor y legajos comitentes. |
| `TEX-SEC-006` | Ciberseguridad y Secreto Bursátil | Directivas de secreto bursátil (Art. 53 Ley 26.831), gestión de tokens, política de escritorio limpio y respuesta a phishing. |
| `TEX-HR-001` | Políticas de Recursos Humanos | Esquema de trabajo híbrido flexible, beneficios corporativos, prepaga médica y régimen de licencias. |

---

## 5. Instalación

### Requisitos
* Node.js 20 o superior
* Una clave de API de [Claude](https://console.anthropic.com/)
* Docker y Docker Compose (opcional)

### Configuración
```bash
git clone https://github.com/santinohicke/tex-ai.git
cd tex-ai
cp .env.example .env.local   # completá ANTHROPIC_API_KEY, ACCESS_TOKEN y AUTH_SECRET
npm install
npm run dev
```
La aplicación queda en `http://localhost:3000`.

| Variable | Para qué |
|---|---|
| `ANTHROPIC_API_KEY` | Clave de la API de Claude (obligatoria) |
| `ACCESS_TOKEN` | Token para iniciar sesión en la interfaz |
| `AUTH_SECRET` | Secreto para firmar las cookies de sesión (32+ caracteres aleatorios) |
| `CLAUDE_MODEL` | Modelo de generación (por defecto `claude-opus-5-5`) |
| `RAG_FAST_MODEL` | Modelo para reescritura y reranking (por defecto `claude-haiku-5-5`) |
| `VOYAGE_API_KEY` | Opcional: activa la búsqueda densa con embeddings de Voyage AI |

---

## 6. Despliegue con Docker

```bash
docker compose up -d --build
```

El servicio queda en el puerto `3050`, con healthcheck sobre `/api/status` y el volumen `./data` para historial, manuales y caché de embeddings.

### Publicarlo desde un servidor propio
La demo corre en un servidor casero: [Tailscale Funnel](https://tailscale.com/kb/1223/funnel) lo expone por HTTPS y un worker de Cloudflare Pages ([`deploy/cloudflare/`](deploy/cloudflare/)) hace de puerta de entrada:
* sirve los archivos estáticos desde Cloudflare, así el servidor solo atiende el HTML y la API;
* si el servidor no responde, entrega una copia estática de la página y la API responde "en mantenimiento": el modo público sigue funcionando;
* registra actividad anónima (visitas, consultas frecuentes probadas, vistas previas del link) en Cloudflare KV, sin cookies ni IPs.

---

## 7. Evaluación y pruebas

```bash
npm run eval                 # métricas de recuperación (ver docs/EVALUATION.md)
node scripts/eval/sweep.ts   # barrido de parámetros de la fusión
python scripts/test_pipeline.py   # auditoría estructural de los manuales
```

---

## 8. Licencia

Distribuido bajo la licencia **MIT**. Ver `LICENSE`.
