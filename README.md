# Tex AI — Asistente Inteligente de Operaciones Financieras y Normativas (RAG)

[![CI / Security Audit & Quality Verification](https://github.com/santinohicke/tex-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/santinohicke/tex-ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.4.2-black.svg)](https://nextjs.org/)

> Sistema corporativo de asistencia operativa, bursátil y de cumplimiento normativo (RAG) impulsado por modelos LLM de última generación, motor de búsqueda semántica con lematización en español y arquitectura de persistencia liviana sin dependencias externas.

---

## 1. El Problema que Resuelve

En mesas de dinero, sociedades de bolsa (ALyCs), administradoras de fondos y entidades financieras, los equipos de operaciones, liquidaciones, compliance y atención al cliente enfrentan desafíos críticos:

1. **Dispersión y Complejidad Normativa:** Las regulaciones de mercado (CNV, UIF, BCRA, BYMA, Matba Rofex) y los manuales operativos internos se encuentran fragmentados en decenas de documentos técnicos, circulares y resoluciones extensas.
2. **Riesgo de Alucinación en Modelos Genéricos:** Los modelos de inteligencia artificial tradicionales tienden a inventar plazos de liquidación, períodos de parking, regímenes impositivos o requisitos de justificación de fondos cuando no disponen de contexto explícito y restringido.
3. **Altos Costos de Infraestructura y Fuga de Datos:** Las soluciones vectoriales pesadas en la nube introducen costos mensuales recurrentes por tokens de incrustación (embeddings) y exponen documentación confidencial corporativa a bases de datos de terceros.

### La Solución de Tex AI
**Tex AI** proporciona una interfaz conversacional profesional, segura y ultra rápida que conecta al operador directamente con la base de manuales y normativas verificadas de la firma. Garantiza respuestas concisas, certeras y desprovistas de alucinaciones, acompañadas por un acordeón interactivo que cita con precisión de sección y documento las fuentes auditadas.

---

## 2. Arquitectura del Sistema

```
                      +---------------------------------------+
                      |       Interfaz Web (Next.js 16)       |
                      |   Lienzo Cálido, Sidebar & Accordion  |
                      +-------------------+-------------------+
                                          |
                                    (Fetch / SSE)
                                          |
                      +-------------------v-------------------+
                      |   Capa de Control & Autenticación     |
                      |   HMAC-SHA256 Token & Rate Limiter    |
                      +-------------------+-------------------+
                                          |
                  +-----------------------+-----------------------+
                  |                                               |
        (Búsqueda Semántica)                            (Inferencia LLM)
                  |                                               |
+-----------------v-----------------+           +-----------------v-----------------+
|   Motor Vectorial en Memoria      |           |    Motor de Inferencia LLM        |
| - Lematización en Español         |           | - Anthropic Claude 3.5 Sonnet     |
| - Diccionario de Acrónimos        |           | - Streaming Server-Sent Events    |
| - 14 Manuales / 100 Chunks RAG    |           | - System Prompt Especializado     |
+-----------------------------------+           +-----------------------------------+
                  |                                               |
                  +-----------------------+-----------------------+
                                          |
                            (Streaming Server-Sent Events)
                                          |
                      +-------------------v-------------------+
                      |         Persistencia Atómica          |
                      |       (JSON Store en Servidor)        |
                      +---------------------------------------+
```

---

## 3. Características Principales

### Motor RAG Nativo con Lematización en Español
* **Stemming Morfológico Inteligente (`stemSpanish`):** Resuelve discrepancias léxicas de género y número en español (por ejemplo: armoniza consultas en singular como *"obligación negociable"* con fuentes en plural como *"Obligaciones Negociables"*).
* **Diccionario de Acrónimos Bursátiles:** Mapeo y expansión semántica de siglas financieras locales (`ON`, `FCI`, `MEP`, `CCL`, `ROFEX`, `CVSA`, `KYC`, `AML`).
* **Ponderación Jerárquica y Frase Exacta:** Asignación ponderada de relevancia sobre títulos, secciones y cuerpo documental, garantizando sub-5ms de latencia en la recuperación de contexto sin requerir GPUs dedicadas.

### Respuestas Concisas y Acordeón Desplegable
* **Acordeón Colapsable:** Las fuentes consultadas se transmiten al concluir la respuesta del modelo y se agrupan en un componente desplegable compacto (`Fuentes consultadas (N)`) para auditoría visual sin saturar la pantalla.

### Seguridad Bancaria y Cero Vulnerabilidades
* **Firma Criptográfica de Sesiones:** Cookies firmadas con algoritmo **HMAC-SHA256** y comparación en tiempo constante (`timingSafeEqual`), neutralizando ataques de suplantación o manipulación de estado.
* **Control de Frecuencia (Rate Limiting Doble):** 
  - Protección anti-fuerza bruta en login (máximo 5 intentos por minuto por IP).
  - Límite de consumo en API de chat (máximo 12 consultas por minuto por cliente).
* **Sanitización de Entorno:** Libre de claves fijas (hardcoded secrets). Configuración 100% aislada mediante variables de entorno.

### Persistencia Atómica en Servidor
* Almacenamiento local ultraliviano en `data/chats/` mediante índice maestro (`index.json`) y registros JSON individuales por conversación, soportando creación, consulta y eliminación con persistencia en volúmenes Docker.

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

## 5. Instalación y Puesta en Marcha

### Requisitos Previos
* Node.js v20 o superior
* Docker & Docker Compose (opcional para ejecución en contenedores)
* Clave de API de [Anthropic Console](https://console.anthropic.com/)

### Paso 1: Clonar el Repositorio
```bash
git clone https://github.com/santinohicke/tex-ai.git
cd tex-ai
```

### Paso 2: Configurar Variables de Entorno
Copia el archivo de ejemplo y completa tus claves:
```bash
cp .env.example .env.local
```
Edita `.env.local`:
```env
ANTHROPIC_API_KEY=tu_clave_de_anthropic_aqui
CLAUDE_MODEL=claude-3-5-sonnet-20241022
ACCESS_TOKEN=TuTokenSecreto2026!
AUTH_SECRET=cadena_aleatoria_de_al_menos_32_caracteres_para_firmar_cookies
```

### Paso 3: Instalar Dependencias y Ejecutar en Desarrollo
```bash
npm install
npm run dev
```
La aplicación estará disponible en `http://localhost:3000`.

---

## 6. Despliegue con Docker

Para desplegar la aplicación en producción con contenedor optimizado sobre Alpine Linux:

```bash
docker compose up -d --build
```

El servicio iniciará en el puerto `3050` con healthcheck automático sobre `/api/status` y volumen montado en `./data` para persistencia de chats e ingesta en caliente de políticas.

---

## 7. Pruebas Automatizadas y Auditoría de Ingesta

El proyecto incluye un pipeline en Python para validar la integridad estructural y cobertura de entidades de las políticas:

```bash
python scripts/test_pipeline.py
```

Salida esperada:
```
...
----------------------------------------------------------------------
Ran 3 tests in 0.250s

OK
```

---

## 8. Licencia

Este proyecto está distribuido bajo la licencia **MIT**. Consulte el archivo `LICENSE` para más información.
