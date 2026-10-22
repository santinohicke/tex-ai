# Glosario Operativo de Instrumentos Bursátiles, Cauciones y Operatoria MEP/CCL
**Código Interno:** TEX-GLOS-012  
**Área Responsable:** Mesa de Operaciones (Trading Desk) & Research  
**Última Revisión:** Octubre 2026  
**Confidencialidad:** Uso Interno Exclusivo  

---

## 1. Dólar MEP (Dólar Mercado Electrónico de Pagos / Bolsa)
Mecanismo legal mediante el cual un comitente compra activos que cotizan en pesos y los liquida en dólares en el mercado local (BYMA / MAE).

### 1.1 Procedimiento Habitual y Parking
1. **Instrumentos utilizados:** Títulos públicos soberanos con alta liquidez (ej. AL30 / GD30).
2. **Paso 1:** Compra del bono en pesos en plazo Contado Inmediato (CI) o 24 horas (T+1). Símbolo: `AL30`.
3. **Plazo de Permanencia (Parking):** Conforme regulaciones CNV vigentes, para transferir o vender en dólares especie `AL30D`, el activo debe permanecer en custodia durante el plazo de parking estipulado por normativa (actualmente 1 día hábil para personas humanas). Durante el parking, el inversor asume el riesgo precio de fluctuación del activo.
4. **Paso 2:** Venta del bono contra dólares especie `D` (ej. `AL30D`). La liquidación de dólares se acredita en la subcuenta comitente USD local.
5. **Restricciones Cruzadas:** No pueden operar MEP clientes que hayan accedido a subsidios de tarifas de servicios públicos, créditos a tasa subsidiada o que hayan realizado transferencias al exterior bajo el régimen MULC en los últimos 90 días.

## 2. Contado con Liquidación (CCL / Cable)
Operatoria análoga al MEP, pero donde la venta se efectúa contra especie `C` (dólares transferidos a una cuenta bancaria radicada en el exterior, bajo custodia de Euroclear o DTC).

* **Ratio de Canje (Cable):** Es el costo o spread porcentual entre el Dólar MEP (local) y el Dólar Cable (exterior).
* **Restricción de 200.000 USD semanales:** Para ventas contra especie `C` y `D` de bonos soberanos reestructurados, rigen los límites de notificación previa si se superan los montos operados fijados por CNV.

## 3. CEDEARs (Certificados de Depósito Argentinos)
Certificados emitidos por el Banco Comafi que representan acciones de empresas no argentinas que cotizan en mercados extranjeros (NYSE, NASDAQ).

* **Moneda de cotización:** Se negocian tanto en Pesos (`AAPL`, `TSLA`, `SPY`) como en Dólares (`AAPLD`, `TSLAD`).
* **Ratio de Conversión:** Cada CEDEAR equivale a una fracción de la acción subyacente (ejemplo: Apple ratio 10:1 significa que 10 CEDEARs representan 1 acción ordinaria de Apple Inc.).
* **Cobertura:** Al estar atados a activos en el exterior, replican el movimiento de la acción original multiplicado por la variación del tipo de cambio Contado con Liquidación (CCL).
* **Dividendos:** Los dividendos pagados por la empresa en el exterior se liquidan al tenedor en Dólar Cable (especie C) descontando retenciones impositivas de origen (IRS 30% en USA) y la comisión del Banco Custodio Comafi.

## 4. Cauciones Bursátiles (Colocadoras y Tomadoras)
Préstamos de dinero a muy corto plazo garantizados por activos financieros (acciones, bonos) depositados en Caja de Valores. Es el equivalente bursátil del plazo fijo o call interbancario, pero con garantía líquida aforada.

* **Caución Colocadora:** El cliente presta dinero (pesos o dólares) a cambio de una Tasa Nominal Anual (TNA) fija garantizada por el mercado.
* **Caución Tomadora:** El cliente toma dinero prestado dejando sus títulos en garantía con un aforo (haircut de seguridad). Si el valor de las garantías cae por debajo del margen requerido, el sistema emite un Margin Call y el Trading Desk liquida activos automáticamente a las 15:00 hs para cancelar el préstamo.
* **Plazos:** Desde 1 día (overnight) hasta 120 días. El plazo de mayor volumen es a 1 día hábil y 7 días.
* **Comisiones:** Tasa de arancel de custodia BYMA + arancel de la ALyC (0.15% prorrateado anualizado).
