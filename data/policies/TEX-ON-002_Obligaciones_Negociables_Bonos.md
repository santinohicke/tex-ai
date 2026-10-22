# Manual de Obligaciones Negociables (ONs) y Renta Fija Privada
**Código Interno:** TEX-ON-002  
**Área Responsable:** Mercado de Capitales, Corporate Finance & Trading Desk  
**Última Revisión:** Octubre 2026  
**Confidencialidad:** Uso Interno Exclusivo  

---

## 1. Obligaciones Negociables (ONs): Concepto y Especies
Las Obligaciones Negociables son títulos de deuda privada emitidos por empresas bajo la Ley de Obligaciones Negociables N° 23.576 para financiar inversiones de capital o reestructuración de pasivos.

### 1.1 Tipologías de Emisión
* **ONs Hard Dollar (Clase Ley Extranjera / Ley Local):** Emitidas y pagaderas en Dólares Estadounidenses físicos (efectivo en cuenta local especie D o cable especie C). Típicamente pagan cupones de interés semestrales o trimestrales con tasas nominales anuales (TNA) entre el 6.5% y el 9.5%.
* **ONs Dólar Linked:** Denominadas en dólares oficiales pero integradas y cobradas en pesos al tipo de cambio de la Comunicación "A" 3500 BCRA a la fecha de fijación previa al vencimiento.
* **ONs Badlar / TAMAR:** Denominadas en pesos, con rendimiento atado a la tasa de interés interbancaria mayorista más un margen de spread adicional fijado en licitación (ejemplo: Badlar Privada + 400 bps).

### 1.2 Ley Aplicable y Riesgo Jurisdiccional
* **Ley Nueva York (NY):** Los contratos se rigen por los tribunales federales de Manhattan. Ofrecen mayor protección ante contingencias regulatorias locales y mayor liquidez institucional internacional.
* **Ley Argentina:** Se dirimen ante la justicia ordinaria de la Ciudad de Buenos Aires. Suelen negociarse con un leve descuento en precio (mayor rendimiento por prima de riesgo local).

## 2. Licitaciones Primarias y Mercado Secundario
### 2.1 Participación en Licitaciones Primarias (Mercado Primario)
1. **Período de Difusión y Subasta:** El prospecto de emisión se publica en la Autopista de Información Financiera (AIF) de la CNV. Se abre la rueda de licitación durante 1 a 2 jornadas hábiles.
2. **Modalidades de Oferta:**
   - *Tramo No Competitivo:* Exclusivo para inversores minoristas (montos menores a USD 50.000). Aceptan la tasa de corte o precio determinado por el tramo competitivo.
   - *Tramo Competitivo:* Inversores institucionales y comitentes calificados presentan órdenes especificando tasa solicitada y volumen.
3. **Prorrateo:** Si las posturas superan el monto máximo autorizado por el emisor, se aplica factor de prorrateo equitativo sobre las órdenes presentadas dentro del rango de corte.

### 2.2 Negociación en Mercado Secundario
* **Plazos de Liquidación:** Contado Inmediato (CI) o 24 horas hábiles (T+1).
* **Códigos de Especie:** 
  - Pesos: Ejemplo `YCA6O`
  - Dólares MEP: Ejemplo `YCA6D`
  - Dólares Cable: Ejemplo `YCA6C`
* **Cálculo de TIR y Duración Modificada:** La Mesa de Operaciones computa la Tasa Interna de Retorno (TIR / YTM) descontando el flujo futuro de amortización y renta según la curva crediticia del emisor.

## 3. Riesgo Crediticio, Calificación y Covenants
* **Calificadoras de Riesgo:** Las emisiones de oferta pública cuentan con dictámenes técnicos de calificadoras registradas (Fix SCR, Moody's Local, Untitled Rating). Rango estándar: `AAA(arg)` a `BBB(arg)`.
* **Covenants Financieros habituales:** Compromisos asumidos por el emisor en el prospecto:
  - Ratio de Deuda Neta / EBITDA consolidado menor a 3.0x.
  - Limitación de gravámenes sobre activos estratégicos (Negative Pledge).
  - Restricción de distribución de dividendos si el ratio de cobertura de intereses cae de 2.0x.
