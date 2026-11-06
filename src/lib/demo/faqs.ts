// Respuestas pre-generadas para el modo público (sin sesión).
// Se sirven 100% desde el navegador: no llaman a la IA, no consumen tokens
// y no guardan nada en el servidor. Generadas una sola vez con el pipeline RAG real.

export interface DemoSource {
  n?: number;
  id?: string;
  title: string;
  section: string;
  file: string;
  snippet: string;
  relevance?: number;
  cited?: boolean;
}

export interface DemoFaq {
  id: string;
  title: string;
  prompt: string;
  answer: string;
  sources: DemoSource[];
}

export const DEMO_FAQS: DemoFaq[] = [
  {
    "id": "faq-1",
    "title": "Fondos Comunes de Inversión (FCI)",
    "prompt": "¿Cuáles son los plazos de liquidación y horarios de corte (cut-off) para Money Market, T+1 y T+2?",
    "answer": "Acá tenés los plazos de liquidación y los horarios de corte (cut-off) según los manuales:\n\n* **Fondos de Dinero (Money Market):**\n  * **Plazo de liquidación:** T+0 (Inmediato) [1].\n  * **Horario de corte (Cut-off):** 16:30 hs para suscripciones y rescates con liquidación en el mismo día hábil [1].\n\n* **Fondos de Renta Fija Corto y Mediano Plazo (T+1):**\n  * **Plazo de liquidación:** T+1 (24 horas hábiles) [2].\n  * **Horario de corte (Cut-off):** 15:00 hs (las órdenes posteriores se procesan con el valor de cuotaparte del día hábil posterior) [2].\n\n* **Fondos de Cobertura Dólar Linked y Renta Variable (T+2):**\n  * **Plazo de liquidación:** T+2 (48 horas hábiles) [3].\n  * **Horario de corte (Cut-off):** 15:00 hs [3].",
    "sources": [
      {
        "n": 1,
        "id": "TEX-FCI-001#1",
        "title": "Manual Operativo de Fondos Comunes de Inversión (FCI)",
        "section": "1. Tipologías de Fondos y Horarios de Corte (Cut-off Times) > 1.1 Fondos de Dinero (Money Market)",
        "file": "TEX-FCI-001_Fondos_Comunes_Inversion.md",
        "snippet": "Los Fondos Comunes de Inversión permiten delegar la administración en un equipo profesional bajo custodia de una entidad independiente registrada ante CNV.\n* **Plazo de Liquidación:** T+0 (Inmediato).\n* **Composición:** …",
        "relevance": 3,
        "cited": true
      },
      {
        "n": 2,
        "id": "TEX-FCI-001#2",
        "title": "Manual Operativo de Fondos Comunes de Inversión (FCI)",
        "section": "1. Tipologías de Fondos y Horarios de Corte (Cut-off Times) > 1.2 Fondos de Renta Fija Corto y Mediano Plazo",
        "file": "TEX-FCI-001_Fondos_Comunes_Inversion.md",
        "snippet": "* **Plazo de Liquidación:** T+1 (24 horas hábiles).\n* **Composición:** Letras del Tesoro (LECAPs, BONCAPs), pagarés bursátiles avalados y bonos soberanos con vencimiento inferior a 18 meses.\n* **Horario de Corte (Cut-off…",
        "relevance": 3,
        "cited": true
      },
      {
        "n": 3,
        "id": "TEX-FCI-001#3",
        "title": "Manual Operativo de Fondos Comunes de Inversión (FCI)",
        "section": "1. Tipologías de Fondos y Horarios de Corte (Cut-off Times) > 1.3 Fondos de Cobertura Dólar Linked y Renta Variable",
        "file": "TEX-FCI-001_Fondos_Comunes_Inversion.md",
        "snippet": "* **Plazo de Liquidación:** T+2 (48 horas hábiles).\n* **Composición:** Títulos soberanos ajustables por Comunicación \"A\" 3500 del BCRA (Dólar Oficial), ONs sintéticas y acciones líderes del índice S&P Merval.\n* **Horario…",
        "relevance": 3,
        "cited": true
      }
    ]
  },
  {
    "id": "faq-2",
    "title": "Obligaciones Negociables (ONs)",
    "prompt": "¿Cómo es la operatoria de ONs Hard Dollar en mercado primario y secundario, y qué covenants aplican?",
    "answer": "Acá tenés el detalle de la operatoria y normativa para las Obligaciones Negociables (ONs) Hard Dollar:\n\n### 1. Concepto y Tipología\n* **ONs Hard Dollar (Clase Ley Extranjera / Ley Local):** Son emitidas y pagaderas en Dólares Estadounidenses físicos (efectivo en cuenta local especie D o cable especie C). Por lo general, pagan cupones de interés semestrales o trimestrales con tasas nominales anuales (TNA) que oscilan entre el 6.5% y el 9.5% [1].\n\n### 2. Mercado Primario (Licitaciones Primarias)\n* **Período de Difusión y Subasta:** El prospecto de emisión se publica en la Autopista de Información Financiera (AIF) de la CNV y la rueda de licitación permanece abierta entre 1 y 2 jornadas hábiles [3].\n* **Modalidades de Oferta:**\n  - *Tramo No Competitivo:* Pensado exclusivamente para inversores minoristas con montos inferiores a USD 50.000. Estos inversores aceptan directamente la tasa de corte o precio fijado en el tramo competitivo [3].\n  - *Tramo Competitivo:* Utilizado por inversores institucionales y comitentes calificados, quienes ingresan órdenes indicando la tasa requerida y el volumen [3].\n* **Prorrateo:** En caso de que las posturas superen el monto máximo autorizado por el emisor, se aplica un factor de prorrateo equitativo sobre las órdenes presentadas dentro del rango de corte [3].\n\n### 3. Mercado Secundario\n* **Plazos de Liquidación:** Las operaciones se cursan en Contado Inmediato (CI) o a 24 horas hábiles (T+1) [4].\n* **Códigos de Especie:** En el mercado secundario se operan bajo nomenclaturas específicas para cada moneda o especie, como por ejemplo en pesos (`YCA6O`), dólares MEP (`YCA6D`) o dólares cable (`YCA6C`) [4].\n* **Cálculo Financiero:** La Mesa de Operaciones calcula la Tasa Interna de Retorno (TIR / YTM) descontando los flujos futuros de amortización y renta en base a la curva crediticia del emisor [4].\n\n### 4. Covenants Financieros Habituales\nEn los prospectos de emisión, el emisor suele asumir los siguientes compromisos:\n* Mantener un ratio de Deuda Neta / EBITDA consolidado menor a 3.0x [2].\n* Aplicar limitaciones de gravámenes sobre los activos estratégicos (Negative Pledge) [2].\n* Restringir la distribución de dividendos en caso de que el ratio de cobertura de intereses caiga por debajo de 2.0x [2].\n\n*Nota: Las fuentes no detallan plazos de liquidación específicos para el mercado primario ni montos mínimos exactos de emisión más allá del límite de USD 50.000 para el tramo no competitivo.*",
    "sources": [
      {
        "n": 1,
        "id": "TEX-ON-002#2",
        "title": "Manual de Obligaciones Negociables (ONs) y Renta Fija Privada",
        "section": "1. Obligaciones Negociables (ONs): Concepto y Especies > 1.1 Tipologías de Emisión",
        "file": "TEX-ON-002_Obligaciones_Negociables_Bonos.md",
        "snippet": "* **ONs Hard Dollar (Clase Ley Extranjera / Ley Local):** Emitidas y pagaderas en Dólares Estadounidenses físicos (efectivo en cuenta local especie D o cable especie C). Típicamente pagan cupones de interés semestrales o…",
        "relevance": 2,
        "cited": true
      },
      {
        "n": 2,
        "id": "TEX-ON-002#6",
        "title": "Manual de Obligaciones Negociables (ONs) y Renta Fija Privada",
        "section": "3. Riesgo Crediticio, Calificación y Covenants",
        "file": "TEX-ON-002_Obligaciones_Negociables_Bonos.md",
        "snippet": "* **Calificadoras de Riesgo:** Las emisiones de oferta pública cuentan con dictámenes técnicos de calificadoras registradas (Fix SCR, Moody's Local, Untitled Rating). Rango estándar: `AAA(arg)` a `BBB(arg)`.\n* **Covenant…",
        "relevance": 2,
        "cited": true
      },
      {
        "n": 3,
        "id": "TEX-ON-002#4",
        "title": "Manual de Obligaciones Negociables (ONs) y Renta Fija Privada",
        "section": "2. Licitaciones Primarias y Mercado Secundario > 2.1 Participación en Licitaciones Primarias (Mercado Primario)",
        "file": "TEX-ON-002_Obligaciones_Negociables_Bonos.md",
        "snippet": "1. **Período de Difusión y Subasta:** El prospecto de emisión se publica en la Autopista de Información Financiera (AIF) de la CNV. Se abre la rueda de licitación durante 1 a 2 jornadas hábiles.\n2. **Modalidades de Ofert…",
        "relevance": 2,
        "cited": true
      },
      {
        "n": 4,
        "id": "TEX-ON-002#5",
        "title": "Manual de Obligaciones Negociables (ONs) y Renta Fija Privada",
        "section": "2. Licitaciones Primarias y Mercado Secundario > 2.2 Negociación en Mercado Secundario",
        "file": "TEX-ON-002_Obligaciones_Negociables_Bonos.md",
        "snippet": "* **Plazos de Liquidación:** Contado Inmediato (CI) o 24 horas hábiles (T+1).\n* **Códigos de Especie:**\n- Pesos: Ejemplo `YCA6O`\n- Dólares MEP: Ejemplo `YCA6D`\n- Dólares Cable: Ejemplo `YCA6C`\n* **Cálculo de TIR y Duraci…",
        "relevance": 2,
        "cited": true
      }
    ]
  },
  {
    "id": "faq-3",
    "title": "Futuros y Coberturas Rofex",
    "prompt": "¿Cómo funciona la liquidación diaria (mark-to-market) y las garantías en futuros de Dólar Oficial?",
    "answer": "Acá tenés el detalle del funcionamiento de la liquidación diaria y las garantías para los futuros de Dólar Oficial:\n\n### Liquidación Diaria (Mark-to-Market)\n* **Precio de ajuste:** Al cierre de cada jornada (17:00 hs), ACyRSA fija el precio de ajuste del día para cada mensualidad [1].\n* **Cálculo:** Se computa la diferencia entre el precio pactado (o el precio de ajuste del día previo) y el precio de ajuste de cierre [1].\n* **Acreditación y débito:** Si la posición arroja ganancia, el dinero se acredita en la cuenta del cliente a primera hora de la mañana siguiente (T+1). Si arroja pérdida, se debita de la cuenta disponible del cliente [1].\n* **Intradía Margin Call:** Si las fluctuaciones del mercado superan el 70% del margen de garantía disponible, la Mesa de Riesgo emite una llamada de reposición de margen con un plazo de cobertura de 2 horas [1].\n\n### Garantías\n* **Margen Inicial:** Es fijado por Argentina Clearing y Registro S.A. (ACyRSA) y representa aproximadamente entre el 12% y el 18% del valor nocional del contrato [2].\n* **Activos aceptados:** Se aceptan pesos líquidos, dólares billete, Títulos Públicos Nacionales con aforo (por ejemplo, AL30 al 80%), CEDEARs calificados y cuotapartes de Fondos Comunes de Inversión (FCI) Money Market [2].\n* **Devolución:** El margen depositado permanece inmovilizado hasta que se cancele la posición o se llegue al vencimiento del contrato [2].",
    "sources": [
      {
        "n": 1,
        "id": "TEX-FUT-003#4",
        "title": "Manual de Operaciones de Futuros y Derivados Financieros (Matba Rofex)",
        "section": "1. Futuros de Dólar Oficial (Matba Rofex) > 1.3 Diferencias Diarias (Mark-to-Market)",
        "file": "TEX-FUT-003_Derivados_Futuros_Opciones_MatbaRofex.md",
        "snippet": "1. Al cierre de cada jornada de negociación (17:00 hs), ACyRSA fija el precio de ajuste del día para cada mensualidad.\n2. Se computa la diferencia entre el precio pactado (o precio de ajuste del día previo) y el precio d…",
        "relevance": 3,
        "cited": true
      },
      {
        "n": 2,
        "id": "TEX-FUT-003#3",
        "title": "Manual de Operaciones de Futuros y Derivados Financieros (Matba Rofex)",
        "section": "1. Futuros de Dólar Oficial (Matba Rofex) > 1.2 Garantías Iniciales y Aforos",
        "file": "TEX-FUT-003_Derivados_Futuros_Opciones_MatbaRofex.md",
        "snippet": "* **Margen de Garantía Inicial:** Fijado por Argentina Clearing y Registro S.A. (ACyRSA). Representa aproximadamente entre el 12% y el 18% del valor nocional del contrato.\n* **Activos Aceptados en Garantía:** Pesos líqui…",
        "relevance": 2,
        "cited": true
      }
    ]
  },
  {
    "id": "faq-4",
    "title": "Transferencias y Cuentas Espejo",
    "prompt": "¿Cuáles son las reglas de titularidad espejo y plazos de acreditación de depósitos y extracciones?",
    "answer": "Aquí tenés las reglas de titularidad espejo y los plazos de acreditación según nuestros manuales:\n\n**Principio de Titularidad Espejo (Misma Titularidad):**\n* **Regla Inquebrantable:** Solo se admiten transferencias desde y hacia cuentas bancarias donde el comitente figure como titular o cotitular de la cuenta origen/destino, cumpliendo estrictamente con las normativas cambiarias del BCRA y la CNV [1].\n* **Prohibición de Cuentas de Terceros:** Quedan absolutamente rechazadas las transferencias provenientes de cuentas de terceros, familiares no cotitulares, billeteras virtuales anónimas o sociedades no vinculadas [1].\n* **Validación CUIT/CUIL:** El sistema de tesorería cruza automáticamente el CUIT/CUIL del ordenante recibido vía COELSA / MEP interbancario contra el legajo del cliente. Si no coincide, el fondo se devuelve a origen en un plazo de 24 horas hábiles [1].\n\n**Plazos de Acreditación:**\n* **Transferencias en Pesos (ARS):** Se reciben vía CBU/CVU institucional con acreditación automática e inmediata (24/7) [2].\n* **Transferencias en Dólares MEP (USD):** Deben provenir de una cuenta bancaria radicada en una entidad financiera autorizada en Argentina, en un horario bancario de recepción de 10:00 a 17:00 hs. Su acreditación habitual toma entre 15 y 45 minutos luego de validada la compensación interbancaria [2].\n\n*Nota: Los manuales no detallan plazos específicos para las extracciones de fondos en pesos o dólares, ya que solo se especifican los plazos de acreditación de ingresos y la devolución a origen por CUIT/CUIL no coincidente.*",
    "sources": [
      {
        "n": 1,
        "id": "TEX-OPS-004#1",
        "title": "Manual de Transferencias de Fondos, Títulos y Custodia (SET / CVSA)",
        "section": "1. Transferencias Bancarias de Fondos (Pesos y Dólares) > 1.1 Principio de Titularidad Espejo (Misma Titularidad)",
        "file": "TEX-OPS-004_Transferencias_SET_Custodia_Liquidaciones.md",
        "snippet": "Toda entrada o salida de fondos hacia y desde la cuenta comitente debe cumplir estrictamente con las normativas cambiarias del BCRA y la CNV.\n* **Regla Inquebrantable:** Solo se admiten transferencias desde y hacia cuent…",
        "relevance": 2,
        "cited": true
      },
      {
        "n": 2,
        "id": "TEX-OPS-004#2",
        "title": "Manual de Transferencias de Fondos, Títulos y Custodia (SET / CVSA)",
        "section": "1. Transferencias Bancarias de Fondos (Pesos y Dólares) > 1.2 Depósitos y Plazos de Acreditación",
        "file": "TEX-OPS-004_Transferencias_SET_Custodia_Liquidaciones.md",
        "snippet": "* **Transferencias en Pesos (ARS):** Se reciben vía CBU/CVU institucional con acreditación automática e inmediata (24/7).\n* **Transferencias en Dólares MEP (USD):**\n- Deben provenir de una cuenta bancaria radicada en una…",
        "relevance": 2,
        "cited": true
      }
    ]
  }
];
