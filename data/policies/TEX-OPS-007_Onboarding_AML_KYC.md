# Manual Operativo: Onboarding de Clientes y Cumplimiento AML/KYC
**Código Interno:** TEX-OPS-007  
**Área Responsable:** Operaciones & Compliance  
**Última Revisión:** Octubre 2026  
**Confidencialidad:** Uso Interno Exclusivo  

---

## 1. Alcance y Objetivo
Este procedimiento establece los requisitos mandatarios para la apertura de cuentas comitentes de personas humanas y jurídicas en la plataforma de Tex AI y servicios de custodia, en estricto cumplimiento con las resoluciones de la CNV (Comisión Nacional de Valores) y la UIF (Unidad de Información Financiera - Res. 30/2017, Res. 230/2023 y modificatorias).

## 2. Tipos de Cuentas y Documentación Obligatoria

### 2.1 Personas Humanas (Residentes)
Para cursar la apertura digital o presencial se requiere sin excepción:
1. **DNI vigente:** Copia legible de frente y dorso (no se aceptan constancias de extravío ni DNI en trámite sin biometría validada vía Renaper).
2. **Constancia de CUIT/CUIL:** Emitida por AFIP/ARCA con antigüedad menor a 60 días.
3. **Justificación de Fondos:**
   - Para límites operativos iniciales hasta $10.000.000 ARS: Recibo de sueldo (últimos 3 recibos si es relación de dependencia) o Certificación de Ingresos emitida por Contador Público legalizada en CPCECABA/Consejo provincial correspondiente.
   - Si es Responsable Inscripto o Monotributista: Última Declaración Jurada de Ganancias y Bienes Personales con acuse de recibo de AFIP, más constancia de inscripción en Ingresos Brutos.
4. **Declaración Jurada PEP (Personas Expuestas Políticamente):** Formulario mandatorio con detalle de cargos públicos en los últimos 2 años. Si es PEP, el legajo debe ser revisado y aprobado por el Oficial de Cumplimiento (Compliance Officer) antes de fondear.
5. **Declaración Jurada FATCA / CRS:** Para determinar residencia fiscal en el exterior o condición de US Person (W-9 / W-8BEN).

### 2.2 Personas Jurídicas (Empresas y Fideicomisos)
1. Estatuto social constitutivo y modificaciones inscriptas ante IGJ o Registro Público provincial.
2. Acta de asamblea y directorio con distribución de cargos y poderes vigentes debidamente inscriptos.
3. Estados Contables auditados del último ejercicio económico cerrado, con informe de auditor legalizado.
4. Identificación del Beneficiario Final (UBO): Declaración jurada individualizando a cada persona física que posea directa o indirectamente el 10% o más del capital social o los derechos de voto.

## 3. Matriz de Riesgo y Perfil del Inversor
Todo cliente debe completar el Test de Inversor previo a su primera operación:
* **Conservador:** Instrumentos admitidos: Cauciones colocadoras, Fondos Comunes de Inversión Money Market (T+0) y Renta Fija Corto Plazo (T+1 en pesos). Plazo sugerido < 30 días.
* **Moderado:** Instrumentos admitidos: Bonos soberanos/subsoberanos en pesos (CER, Duales), Obligaciones Negociables (ONs) Hard Dollar Ley Local y Extranjera, FCI T+2.
* **Agresivo:** Habilitado para Renta Variable local (Acciones BYMA), CEDEARs, Opciones financieras (Calls/Puts) y Cauciones tomadoras (apalancamiento).

## 4. Circuito de Aprobación y Tiempos de Respuesta (SLA)
* **Canal Digital Automatizado (scoring bajo riesgo):** Aprobación en el día hábil dentro de las 2 horas de completada la carga biométrica.
* **Cuentas que requieren análisis de Compliance (PEP, fondos especiales o PJ):** Plazo máximo de dictamen de 48 horas hábiles.
* **Bloqueos preventivos:** Si se detecta una discrepancia en listas restrictivas (OFAC, ONU, RePET), la cuenta queda en estado "PENDING_COMPLIANCE_HOLD" de forma inmediata y automática, suspendiendo cualquier acreditación de transferencias bancarias.
