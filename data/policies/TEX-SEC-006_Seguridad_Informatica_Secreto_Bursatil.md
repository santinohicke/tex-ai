# Manual de Seguridad de la Información, Ciberseguridad y Secreto Bursátil
**Código Interno:** TEX-SEC-006  
**Área Responsable:** Ciberseguridad (InfoSec), Tecnología & Asuntos Legales  
**Última Revisión:** Octubre 2026  
**Confidencialidad:** Uso Interno Exclusivo  

---

## 1. Secreto Bursátil y Deber de Confidencialidad
Conforme al Artículo 53 de la Ley de Mercado de Capitales N° 26.831, todo integrante de los órganos de administración, fiscalización y empleados de los agentes registrados debe guardar estricta reserva de las operaciones y de las informaciones de las que tome conocimiento con motivo de su actividad.

### 1.1 Alcance del Secreto Bursátil
* Queda terminantemente prohibido revelar a terceros o utilizar en beneficio propio o ajeno información relativa a órdenes cursadas, carteras comitentes, saldos en cuenta o estrategias de trading.
* **Excepciones Legales Taxativas:** El deber de reserva solo cede ante requerimientos formales cursados por jueces competentes en causas penales, requerimientos de la Comisión Nacional de Valores (CNV) en ejercicio de sus funciones de supervisión, o solicitudes de la Unidad de Información Financiera (UIF).

## 2. Autenticación, Gestión de Tokens y Control de Accesos
Para resguardar los sistemas corporativos e interfaces de clientes (incluido Tex AI) contra accesos no autorizados en redes públicas e internet, se aplican las siguientes directivas:

### 2.1 Políticas de Tokens y Contraseñas
* **Tokens Criptográficos de Sesión:** Las sesiones web utilizan tokens firmados criptográficamente mediante algoritmo HMAC-SHA256 con claves simétricas de alta entropía. Las cookies deben portar las directivas `HttpOnly`, `SameSite=Lax` y cifrado en tránsito TLS 1.3.
* **Tokens de Acceso a Sistemas:** Para acceder a interfaces operativas de la firma desde redes remotas o Funnel público, se requiere un Token de Acceso corporativo unívoco de alta seguridad. Queda terminantemente prohibido el uso de contraseñas débiles o PINs predecibles en entornos accesibles desde internet.
* **Rotación y Auditoría:** Los tokens de acceso deben rotarse trimestralmente o de forma inmediata ante cualquier indicio de compromiso.
* **Bloqueo por Intentos Fallidos (Anti-Brute Force):** El sistema bloquea temporalmente la dirección IP o el identificador de cliente tras 5 intentos fallidos consecutivos de ingreso durante una ventana de 60 segundos.

### 2.2 Política de Escritorio Limpio (Clean Desk)
* Los puestos de trabajo físicos y estaciones de trading deben bloquearse con contraseña (`Win + L`) cada vez que el colaborador se retire del escritorio, sin excepción.
* No está permitido dejar notas adhesivas, contraseñas impresas ni legajos físicos de clientes expuestos a la vista de terceros.

## 3. Prevención de Ataques y Escalamiento de Incidentes
### 3.1 Protección contra Ingeniería Social y Phishing
* Ningún administrador del sistema, mesa de ayuda ni equipo de IT solicitará jamás a un empleado o cliente su contraseña, token privado o segundo factor por mensaje de texto, correo electrónico o llamadas no verificadas.
* Cualquier correo sospechoso que contenga enlaces no reconocidos o archivos adjuntos ejecutables debe reenviarse de inmediato a `security@tex.internal` y eliminarse de la bandeja de entrada.

### 3.2 Protocolo de Respuesta ante Incidentes
1. **Detección:** Notificación al equipo de InfoSec o activación automática de alertas de intrusión (IDS/IPS, anomalías de rate-limit).
2. **Aislamiento Inmediato:** Desconexión de la terminal afectada de la red interna o suspensión del token de acceso comprometido para frenar la propagación lateral.
3. **Erradicación y Análisis Forense:** Revisión de logs auditados de autenticación y transacciones para verificar si existió fuga de información sensible.
4. **Restablecimiento y Notificación:** Reemisión de credenciales seguras y elevación del informe técnico a la Gerencia de Tecnología.
