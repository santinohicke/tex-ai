# Manual de Operaciones de Futuros y Derivados Financieros (Matba Rofex)
**Código Interno:** TEX-FUT-003  
**Área Responsable:** Mesa de Derivados Financieros & Gestión de Riesgo  
**Última Revisión:** Octubre 2026  
**Confidencialidad:** Uso Interno Exclusivo  

---

## 1. Futuros de Dólar Oficial (Matba Rofex)
Los contratos de futuros de moneda permiten a los participantes del mercado fijar el precio del tipo de cambio oficial para fechas de vencimiento futuras, mitigando el riesgo cambiario comercial.

### 1.1 Especificaciones Técnicas del Contrato
* **Subyacente:** Tipo de cambio de referencia del BCRA Comunicación "A" 3500 (Mayorista).
* **Tamaño del Contrato:** USD 1.000 nominales por contrato.
* **Meses de Negociación:** Mensualidades continuas (Enero a Diciembre) hasta un horizonte de 12 meses.
* **Liquidación:** Exclusivamente financiera por diferencias en pesos (Non-Deliverable / Cash Settlement). No existe entrega física de billetes.
* **Día de Vencimiento:** Último día hábil del mes del contrato respectivo.

### 1.2 Garantías Iniciales y Aforos
* **Margen de Garantía Inicial:** Fijado por Argentina Clearing y Registro S.A. (ACyRSA). Representa aproximadamente entre el 12% y el 18% del valor nocional del contrato.
* **Activos Aceptados en Garantía:** Pesos líquidos, dólares billete, Títulos Públicos Nacionales con aforo (ej. AL30 al 80%), CEDEARs calificados y cuotapartes de FCI Money Market.
* **Devolución de Garantías:** El margen depositado queda inmovilizado hasta la cancelación de la posición o el vencimiento del contrato.

### 1.3 Diferencias Diarias (Mark-to-Market)
1. Al cierre de cada jornada de negociación (17:00 hs), ACyRSA fija el precio de ajuste del día para cada mensualidad.
2. Se computa la diferencia entre el precio pactado (o precio de ajuste del día previo) y el precio de ajuste de cierre.
3. Si la posición arroja ganancia, el dinero se acredita en la cuenta del cliente a primera hora de la mañana siguiente (T+1).
4. Si la posición arroja pérdida, se debita de la cuenta disponible del cliente.
5. **Intradía Margin Call:** Si las fluctuaciones de mercado superan el 70% del margen de garantía disponible, la Mesa de Riesgo emite una llamada de reposición de margen con plazo de cobertura de 2 horas.

## 2. Opciones Financieras sobre Renta Variable
### 2.1 Conceptos Fundamentales
* **Call (Opción de Compra):** Otorga al comprador el derecho (no la obligación) de comprar el activo subyacente a un precio de ejercicio (Strike) determinado hasta la fecha de expiración.
* **Put (Opción de Venta):** Otorga al comprador el derecho de vender el activo subyacente al precio de ejercicio.
* **Prima:** El precio que abona el comprador de la opción al lanzador (vendedor) en el momento de la concertación en plazo T+1.

### 2.2 Coberturas y Estrategias Habituales
* **Lanzamiento Cubierto (Covered Call):** Tenencia de acciones o CEDEARs en cartera combinada con la venta de opciones de compra fuera del dinero (OTM) para generar una tasa de renta adicional.
* **Protective Put (Seguro de Cartera):** Compra de opciones Put sobre tenencias de acciones para fijar un piso máximo de pérdida ante caídas abruptas del mercado.
* **Ejercicio de Opciones:** El ejercicio puede ser ejercido en cualquier momento antes del vencimiento (estilo americano en BYMA). La fecha de vencimiento habitual es el tercer viernes de los meses pares.
