# Manual de Conectividad Tecnológica, Protocolo FIX y Trading Algorítmico (DMA)
**Código Interno:** TEX-API-012  
**Área Responsable:** Infraestructura IT, Core Bancario & Trading Cuantitativo  
**Última Revisión:** Octubre 2026  
**Confidencialidad:** Uso Interno Exclusivo  

---

## 1. Conectividad Direct Market Access (DMA) y Protocolo FIX 4.4
Para clientes institucionales, mesas de arbitraje y algoritmos cuantitativos de alta frecuencia, la firma provee acceso directo de ruteo de órdenes mediante el protocolo estándar Financial Information eXchange (FIX v4.4).

### 1.1 Estructura de Mensajes y Tags Principales FIX
* **Tag 35 (MsgType):** Tipo de mensaje.
  - `D`: New Order Single (Nueva Orden).
  - `F`: Order Cancel Request (Cancelación de Orden).
  - `G`: Order Cancel/Replace Request (Modificación de Orden).
  - `8`: Execution Report (Confirmación de Ejecución / Fill).
  - `9`: Order Cancel Reject (Rechazo de Cancelación).
* **Tag 11 (ClOrdID):** Identificador unívoco de orden generado por el cliente.
* **Tag 55 (Symbol):** Instrumento o ticker de negociación (ejemplo: `AL30`, `GGAL`, `YPFD`).
* **Tag 54 (Side):** Sentido de la operación (`1` para Compra / Buy, `2` para Venta / Sell).
* **Tag 38 (OrderQty):** Cantidad nominal de títulos requeridos.
* **Tag 44 (Price):** Precio límite por unidad.
* **Tag 40 (OrdType):** Tipo de orden (`1` para Market, `2` para Limit, `3` para Stop).

### 1.2 Validación de Riesgo Pre-Trade (Pre-Trade Risk Engine)
Antes de rutear cualquier mensaje FIX hacia las pasarelas de BYMA o Matba Rofex, el motor de riesgo de la ALyC realiza validaciones en tiempo real en sub-milisegundos:
1. **Verificación de Poder de Compra (Buying Power):** Saldo líquido suficiente disponible en cuenta comitente más márgenes aforados.
2. **Control de Precios Fuera de Banda (Fat-Finger Filter):** Rechazo automático de órdenes cuyo precio diste más de un 10% del último precio operado en el mercado.
3. **Límite Nocional Máximo por Orden:** Topes monetarios preconfigurados por comitente para evitar ejecuciones accidentales que saturen el libro de ofertas.
4. **Drop Copy:** Flujo paralelo de mensajes de ejecución en tiempo real enviado a los sistemas de Back-Office y Compliance para monitoreo simultáneo.

## 2. APIs REST y WebSocket para Market Data
### 2.1 Especificaciones de la API REST
* **Endpoint Base:** `https://api.tex.internal/v1/`
* **Autenticación:** Tokens Bearer JWT de corta duración (expiración: 15 minutos) emitidos mediante intercambio de claves `API_KEY` y `API_SECRET`.
* **Rate Limits:** Límite institucional de 60 solicitudes por segundo por dirección IP autorizada. Códigos HTTP 429 (`Too Many Requests`) con cabecera `Retry-After`.

### 2.2 Streaming de Cotizaciones vía WebSocket (L1 y L2)
* Permite suscripción en tiempo real a las puntas compradoras y vendedoras (Top of Book / Level 1) y a la profundidad de mercado de 5 posiciones (Depth of Book / Level 2).
* Latencia promedio en enlaces dedicados: inferior a 5 milisegundos hacia el Data Center de BYMA.
