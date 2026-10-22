# Manual Integral de Gestión de Riesgo Financiero y Operacional
**Código Interno:** TEX-RSK-010  
**Área Responsable:** Gerencia de Riesgo (Risk Management) & Auditoría  
**Última Revisión:** Octubre 2026  
**Confidencialidad:** Uso Interno Exclusivo  

---

## 1. Marco de Gestión de Riesgo en ALyC
La gestión integral de riesgos asegura la solvencia patrimonial de la firma y el resguardo de los activos comitentes frente a volatilidades severas de mercado, shocks de liquidez o incumplimientos crediticios.

### 1.1 Riesgo de Mercado y Valor en Riesgo (VaR)
* **Value at Risk (VaR):** Métrica fundamental que cuantifica la pérdida potencial máxima esperada en un horizonte temporal determinado para un nivel de confianza estadístico dado.
* **Metodología Oficial:** VaR Histórico y Paramétrico calculado a 1 día hábil con un nivel de confianza del 99% sobre una ventana móvil de 252 observaciones de mercado.
* **Límites de Pérdida Máxima (Stop-Loss Intradía):** Cada mesa de negociación (Trading Desk) tiene asignado un límite de VaR y de pérdida acumulada diaria. Al alcanzarse el 80% del límite, el sistema bloquea la apertura de nuevas posiciones; al 100%, se liquidan de forma automática las posiciones de mayor volatilidad.

### 1.2 Pruebas de Estrés (Stress Testing)
* Se ejecutan simulaciones semanales aplicando escenarios de shock macroeconómico extremo:
  - Salto discreto del tipo de cambio del 25%.
  - Ampliación del Riesgo País en +500 puntos básicos (bps).
  - Caída del 15% en el índice accionario S&P Merval en una sola rueda bursátil.

## 2. Riesgo de Liquidez y Riesgo de Crédito de Contraparte
### 2.1 Cobertura de Liquidez Intradía
* La firma mantiene una reserva líquida de contingencia en Fondos Comunes de Inversión Money Market (T+0) y cuentas corrientes remuneradas equivalente a al menos 3 días del flujo promedio de liquidaciones diarias.
* Líneas de descubierto bancario de emergencia acordadas con entidades financieras de primera línea para garantizar la liquidación ante desfases operativos en compensación interbancaria.

### 2.2 Riesgo Crediticio de Emisores y Contrapartes
* **Límites por Emisor:** Ninguna cartera puede concentrar más del 15% de su patrimonio en títulos de deuda de un único emisor privado corporativo (salvo Títulos Públicos Soberanos del Estado Nacional).
* **Aforos en Garantías de Cauciones:** Los títulos depositados en garantía para cauciones tomadoras se ponderan con aforos de seguridad fijados por BYMA y reforzados por la firma (ejemplo: Bonos soberanos líquidos aforo 80%, Acciones líderes aforo 60%, títulos ilíquidos aforo 0%).
