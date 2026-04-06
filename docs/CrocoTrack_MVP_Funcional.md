# CROCOTRACK — Especificación Funcional del MVP

**Plataforma de Gestión para Criaderos de Cocodrilos**
Versión 1.1 | 2025

---

## 1. Resumen del MVP

CrocoTrack es una plataforma SaaS diseñada para criaderos de cocodrilos. El MVP cubre la operación completa de una o varias fincas: inventario de animales, alimentación, clasificaciones, traslados, sacrificios, mortalidad, reproducción, incubación, limpieza y cumplimiento regulatorio ante el ANLA.

La plataforma opera como aplicación web responsive e instalable como PWA en dispositivos móviles. Funciona con conexión intermitente (offline-first) y está disponible en español.

### Jerarquía de datos

El sistema se organiza en la siguiente jerarquía:

- **Organización (Tenant):** La empresa del dueño. Todas las fincas y usuarios pertenecen a una organización. Los datos de distintas organizaciones están completamente aislados.
- **Finca:** Cada instalación física de cría. Una organización puede tener múltiples fincas.
- **Pileta / Pozo reproductor:** Unidad física dentro de la finca. Puede ser de crianza (pileta) o de reproducción (pozo). Cada una tiene un tipo de encierro definido.
- **Incubadora:** Una por finca. Recibe los huevos recolectados de los pozos reproductores.
- **Lote:** Todos los animales que ocupan una pileta en un periodo de tiempo. Una pileta tiene un solo lote activo a la vez. El lote puede contener animales de una o varias tallas (composición de tallas). Es la unidad central de trazabilidad.
- **Nido:** Grupo de huevos de un mismo pozo reproductor, identificado con un número único dentro del incubador.

### Tipos de encierro

Existen dos tipos de encierro, cada uno con procesos específicos:

- **Pileta de crianza:** Aloja animales en crecimiento desde neonatos hasta talla de sacrificio. Procesos que aplican: alimentación, clasificación, traslado, mortalidad, sacrificio, limpieza.
- **Pozo reproductor:** Aloja animales adultos para reproducción. Procesos que aplican: alimentación, limpieza, recolección de huevos.

### El lote como unidad central

Un lote representa la ocupación de una pileta por un grupo de animales durante un periodo de tiempo. Cada pileta tiene un solo lote activo a la vez. El lote almacena una **composición de tallas**: el desglose de cuántos animales hay por cada talla en pulgadas. Por ejemplo, un lote puede contener 80 animales de 12", 70 de 14" y 50 de 16".

- Se crea cuando ingresan los primeros animales a una pileta vacía (por entrada, clasificación, traslado o eclosión de neonatos).
- Si la pileta ya tiene un lote activo, los animales entrantes se suman a la composición de tallas existente.
- Registra todos los eventos que ocurren: alimentaciones, mortalidades, limpiezas.
- Se cierra cuando todos los animales salen de la pileta (clasificación o traslado total). El inventario llega a cero.
- Permite comparar el desempeño de lotes sucesivos en la misma pileta.

---

## 2. Usuarios y Roles

El sistema maneja dos roles con permisos diferenciados. No existe rol intermedio.

### 2.1 Dueño (Admin del tenant)

- Ve todas sus fincas, piletas, lotes y métricas en un dashboard centralizado.
- Acceso completo a todos los módulos de registro y configuración.
- Único que puede ver reportes, dashboard analítico y exportar datos.
- Crea y configura fincas, piletas, incubadoras y tipos de alimento.
- Invita trabajadores y los asigna a fincas específicas.
- Puede editar o eliminar cualquier registro (toda acción queda en log de auditoría).
- Define la talla mínima de sacrificio por finca o de forma global.

### 2.2 Trabajador

- Puede estar asignado a una o varias fincas de la misma organización.
- Solo ve y opera las fincas a las que está asignado.
- No tiene acceso a reportes, dashboard analítico ni configuración.
- Acciones permitidas:
  - Registrar alimentación por pileta
  - Registrar mortalidad
  - Registrar traslados simples entre piletas
  - Registrar clasificaciones
  - Registrar sacrificios
  - Registrar limpiezas de pileta
  - Registrar eventos en nidos del incubador

### 2.3 Invitación de trabajadores

El flujo de invitación funciona así:

1. El dueño ingresa el correo electrónico del trabajador desde el panel de gestión de usuarios.
2. El sistema envía un correo con un enlace único con expiración.
3. El trabajador hace clic en el enlace y establece su contraseña.
4. Queda automáticamente asociado a la organización y a las fincas asignadas por el dueño.

---

## 3. Onboarding para Nuevos Dueños

Cuando un nuevo dueño se registra en la plataforma, un asistente paso a paso lo guía en la configuración inicial antes de comenzar a operar.

### Pasos del onboarding

**Paso 1 — Crear la organización**
Datos requeridos: nombre del criadero, país, moneda de operación.

**Paso 2 — Crear la primera finca**
Datos requeridos: nombre de la finca, ubicación.

**Paso 3 — Configurar los tipos de alimento**
Datos requeridos: nombre del alimento (pollo, pescado, vísceras u otros personalizados).

**Paso 4 — Crear las piletas y pozos**
Datos requeridos: nombre/número del encierro, tipo (crianza o reproductor), capacidad máxima de animales.

**Paso 5 — Configurar el incubador**
Confirmar que la finca tiene incubador y asociarlo.

**Paso 6 — Invitar al primer trabajador (opcional)**
Datos requeridos: correo electrónico y fincas asignadas. Este paso puede hacerse después.

---

## 4. Entradas de Animales

Registra el ingreso de animales a una pileta. Las entradas pueden tener tres orígenes distintos.

### 4.1 Tipos de origen

**Proveedor externo — Persona natural**
Compra a una persona física. Datos adicionales: nombre completo, número de documento de identidad, documento de aval (código + archivo PDF/imagen).

**Proveedor externo — Empresa**
Compra a una empresa o criadero externo. Datos adicionales: nombre de la empresa, nombre del representante legal, NIT, documento de aval (código + archivo PDF/imagen).

**Finca propia de la organización**
Traslado desde otra finca de la misma organización. Datos adicionales: finca de origen, pileta de origen. Se genera automáticamente una salida en la finca origen.

**Incubador (neonatos)**
Eclosión de huevos del incubador interno. Datos adicionales: nido de origen, fecha de eclosión. Los neonatos ingresan como un nuevo lote.

### 4.2 Datos comunes de toda entrada

- Fecha de ingreso
- Finca y pileta destino
- Uno o más grupos de talla, cada uno con:
  - Talla en pulgadas
  - Cantidad de animales de esa talla
- Responsable del registro

Ejemplo: una entrada puede registrar 50 animales de 12" y 30 animales de 14" en la misma operación.

### 4.3 Efectos en el sistema

Cada entrada suma los animales a la composición de tallas del lote activo en la pileta destino. Si la pileta no tiene lote activo, se crea uno nuevo. El inventario se actualiza automáticamente.

---

## 5. Módulo de Alimentación

El módulo de alimentación tiene dos componentes: el registro de alimentación por pileta y la gestión del stock de alimento por finca.

### 5.1 Registro de alimentación

Datos del registro:

- Fecha y hora del registro
- Finca y pileta (lote activo)
- Tipo de alimento
- Cantidad en kilogramos
- Responsable del registro

Cada registro de alimentación descuenta automáticamente la cantidad del stock de alimento disponible en la finca. La frecuencia de alimentación varía por finca y no es fija en el sistema.

### 5.2 Stock de alimento por finca

Cada finca mantiene un inventario de alimento por tipo. Los movimientos del stock son:

**Entrada / Compra:** Se registra cuando llega alimento a la finca. Datos: fecha, tipo, cantidad en kg, proveedor (opcional). Efecto: suma al stock.

**Consumo:** Se genera automáticamente cada vez que se registra una alimentación. Efecto: resta del stock.

### 5.3 Tipos de alimento

Tipos disponibles por defecto: pollo, pescado, vísceras. El dueño puede agregar tipos personalizados durante la configuración.

### 5.4 Alerta de stock bajo

El dashboard muestra una alerta cuando el stock de cualquier tipo de alimento está por debajo de un umbral definido por el dueño.

---

## 6. Clasificación

La clasificación es el proceso de medir todos los animales de una pileta, separarlos por tallas y distribuirlos en distintas piletas según el resultado. Es el evento que cierra el lote activo de la pileta y genera nuevos lotes en las piletas destino. Todos los animales de la pileta se miden y redistribuyen; no se puede clasificar parcialmente.

### 6.1 Datos del evento de clasificación

- Fecha del evento
- Finca y pileta de origen (lote que se clasifica)
- Responsable que realizó la clasificación
- Por cada grupo de talla resultante:
  - Talla en pulgadas del grupo
  - Cantidad de animales en ese grupo
  - Pileta destino dentro de la misma finca

### 6.2 Efectos en el sistema

- El lote de origen queda marcado como cerrado. La pileta queda vacía (inventario en cero).
- Se crean nuevos lotes activos en cada pileta destino, o se suman a los lotes activos existentes en esas piletas.
- La composición de tallas de cada lote destino se actualiza con los animales recibidos.
- La trazabilidad queda registrada: de qué lote proviene cada nuevo grupo de animales.

---

## 7. Traslado Simple

Un traslado simple mueve animales de una pileta a otra dentro de la misma finca, sin proceso de clasificación ni medición detallada. Se usa cuando se necesita reubicar animales por capacidad u otras razones operativas.

### 7.1 Datos del traslado

- Fecha del traslado
- Finca (origen y destino son de la misma finca)
- Pileta de origen
- Pileta destino
- Uno o más grupos de talla a trasladar, cada uno con:
  - Talla en pulgadas
  - Cantidad de animales de esa talla
- Responsable del registro

Ejemplo: de una pileta con animales de 12", 14" y 16", se pueden trasladar solo los 50 de 16" a otra pileta, dejando el resto.

### 7.2 Efectos en el sistema

El traslado descuenta los animales indicados (por talla y cantidad) de la composición de tallas del lote origen y los suma a la composición del lote destino. Si la pileta destino no tiene lote activo, se crea uno. Si el lote origen queda en cero animales, se cierra automáticamente.

---

## 8. Sacrificio

El proceso de sacrificio consiste en medir los animales de una pileta y determinar cuáles están aptos para sacrificio. Los animales no aptos son rechazados y trasladados a otra pileta.

### 8.1 Flujo del proceso

1. Se selecciona la pileta a sacrificar.
2. Se miden los animales. Cada animal tiene dos posibles resultados:
  - **Apto para sacrificio:** Cumple la talla mínima requerida y tiene la piel en buen estado. Se registra como sacrificado y sale del inventario.
  - **Rechazado:** No cumple la talla mínima o tiene la piel en mal estado. Se traslada a una pileta de destino especificada.

### 8.2 Datos del evento de sacrificio

- Fecha del evento
- Finca y pileta de origen
- Responsable del registro
- Animales sacrificados: uno o más grupos, cada uno con talla y cantidad
- Animales rechazados: uno o más grupos, cada uno con talla, cantidad, motivo del rechazo (talla insuficiente o piel en mal estado) y pileta destino

### 8.3 Efectos en el sistema

- Los animales sacrificados se descuentan de la composición de tallas del lote y salen del inventario definitivamente.
- Los animales rechazados se descuentan de la composición del lote origen y se suman al lote de la pileta destino (con sus tallas correspondientes).
- Si el lote de origen queda en cero animales, se cierra automáticamente.

---

## 9. Mortalidad

Registra la muerte de animales dentro de una pileta.

### 9.1 Datos del registro

- Fecha del evento
- Finca y pileta
- Uno o más grupos de baja, cada uno con:
  - Talla en pulgadas (seleccionada de las tallas disponibles en el lote activo)
  - Cantidad de animales muertos de esa talla
- Causa de la muerte (enfermedad, pelea, desconocida u otras causas definidas por el dueño)
- Responsable que reporta el evento

El sistema muestra al trabajador las tallas que existen en el lote activo para facilitar el registro y evitar errores.

### 9.2 Efectos en el sistema

El registro de mortalidad descuenta los animales indicados (por talla y cantidad) de la composición de tallas del lote activo en la pileta. Si una talla llega a cero animales, desaparece de la composición. Si el lote completo llega a cero, se cierra automáticamente.

---

## 10. Limpieza de Pileta

El módulo de limpieza permite programar limpiezas con anticipación y registrar su ejecución. Las limpiezas se realizan con los animales dentro de la pileta y no afectan el inventario.

### 10.1 Programación

- El dueño o trabajador agenda la limpieza con fecha prevista.
- La finca y la pileta quedan asociadas al evento.
- El dashboard muestra una alerta si hay limpiezas programadas pendientes.

### 10.2 Registro de ejecución

- Fecha y hora real de realización
- Responsable que ejecutó la limpieza
- Productos utilizados (nombre y cantidad)

---

## 11. Trazabilidad de Huevos e Incubación

Este módulo gestiona el ciclo reproductivo completo: desde la recolección de huevos en los pozos reproductores hasta la eclosión y el ingreso de neonatos a las piletas de crianza.

### 11.1 Flujo del ciclo reproductivo

1. **Recolección:** Se recogen los huevos del pozo reproductor y se trasladan al incubador de la finca.
2. **Registro de nido:** Los huevos se agrupan en nidos numerados dentro del incubador. Cada nido queda vinculado al pozo de origen y a la fecha de recolección.
3. **Seguimiento:** Durante la incubación se registran los eventos que reducen el conteo de huevos del nido.
4. **Eclosión:** Los neonatos que nacen se registran por día y se asignan a piletas de crianza disponibles según capacidad.

### 11.2 Recolección de huevos

Datos del registro:

- Pozo reproductor de origen
- Fecha de recolección
- Cantidad de huevos recolectados
- Responsable del registro

### 11.3 Datos del nido

- Número de nido (identificador único dentro del incubador)
- Pozo reproductor de origen
- Fecha de recolección
- Cantidad inicial de huevos
- Fecha estimada de eclosión (calculada automáticamente: fecha de recolección + 80 días aproximadamente)

### 11.4 Eventos de baja durante incubación

Se registran las bajas de huevos del nido según la causa:

- **Huevo infértil:** No presentó ninguna señal de desarrollo. Se descarta.
- **Muerte embrionaria temprana:** El embrión inició su desarrollo pero murió en etapa inicial.
- **Muerte embrionaria tardía:** El embrión estaba avanzado en su desarrollo pero murió antes de eclosionar.
- **Huevo podrido o contaminado:** El huevo presenta contaminación bacteriana o fúngica.
- **Huevo roto en manipulación:** Dañado accidentalmente durante el manejo o el registro.

Cada evento de baja registra: tipo de evento, cantidad de huevos, fecha y responsable.

### 11.5 Registro de eclosión

La eclosión no ocurre en un solo momento; puede extenderse varios días. Cada día de eclosión se registra como un evento independiente:

- Fecha del día de eclosión
- Cantidad de neonatos nacidos ese día
- Pileta destino (dentro de la misma finca, según capacidad disponible)
- Responsable del registro

Un nido puede generar múltiples eventos de eclosión en diferentes días, y los neonatos pueden distribuirse en distintas piletas. Todos los neonatos de un evento de eclosión ingresan con la misma talla (neonato). La trazabilidad queda completa: pozo reproductor → nido → pileta de crianza.

### 11.6 Registro de temperatura y humedad del incubador

El trabajador o dueño registra manualmente la temperatura y humedad del incubador. El sistema guarda automáticamente la fecha y hora del registro.

Datos del registro:

- Temperatura (°C)
- Humedad (%)
- Fecha y hora (automática, al momento de guardar)
- Responsable del registro (automático, usuario logueado)

El monitoreo es por incubador completo, no por nido individual. El dashboard muestra una alerta si la última lectura registrada está fuera del rango óptimo configurado por el dueño. El histórico de lecturas está disponible para el dueño como referencia.

---

## 12. Planilla ANLA — Reporte Regulatorio

La Planilla de Control de Inventario por Encierro de Manejo es un documento oficial exigido por la Autoridad Nacional de Licencias Ambientales (ANLA). El sistema la genera automáticamente a partir de los datos ya registrados en los otros módulos.

### 12.1 Generación del reporte

El dueño selecciona: finca → pileta → año → mes. El sistema construye la planilla automáticamente sin necesidad de ingresar datos adicionales.

### 12.2 Estructura de la planilla

**Encabezado:**

- Nombre del criadero (fuente: nombre de la finca)
- Tipo de encierro (fuente: atributo de la pileta — crianza o reproductor)
- Número del encierro (fuente: número de la pileta)
- Año y mes (seleccionados al generar el reporte)

**Ingresos (por día):**

- Cantidad de animales (fuente: entradas y traslados recibidos)
- Encierro de origen (fuente: pileta o finca de origen de la entrada)
- Talla mínima y máxima (fuente: tallas registradas en las entradas del día)

**Salidas — Reclasificaciones:**

- Cantidad y encierro destino (fuente: clasificaciones realizadas en el periodo)

**Salidas — Mortalidad:**

- Cantidad (fuente: registros de mortalidad del periodo)

**Salidas — Sacrificio:**

- Cantidad (fuente: registros de sacrificio del periodo)

**Salidas — Otras:**

- Cantidad y tipo (fuente: otros eventos de salida registrados)

**Saldo por día:**

- Cálculo acumulado automático: saldo anterior + ingresos - salidas

**Responsable:**

- Nombre del usuario que registró cada evento

### 12.3 Reglas de agrupación

Si en un mismo día ocurren múltiples eventos del mismo tipo, se agrupan en la fila correspondiente a ese día.

### 12.4 Exportación

El reporte es exportable en formato Excel y PDF con la estructura exacta requerida por el ANLA.

---

## 13. Dashboard y Alertas

El dashboard es exclusivo para el dueño y es la pantalla principal de la aplicación. Está organizado en tres niveles de vista.

### 13.1 Vista global — Todas las fincas

Resumen del estado de toda la operación:

- **Total de animales vivos:** Suma del inventario activo de todos los lotes en todas las fincas.
- **Talla con mayor cantidad de animales:** Distribución de animales por talla en toda la organización. Muestra cuál es la talla predominante.
- **Promedio de crecimiento mensual:** Promedio de pulgadas ganadas por mes en los lotes activos de todas las fincas.
- **Tasa de mortalidad por finca:** Porcentaje de muertes sobre el inventario inicial del periodo, mostrado por finca para comparar.
- **Comparativo de rendimiento entre fincas:** Tabla o gráfica que compara las fincas en métricas clave: crecimiento, mortalidad, consumo de alimento.
- **Proyección mensual de animales a sacrificio:** Estimación de cuántos animales alcanzarán la talla mínima de sacrificio en los próximos meses, basada en la tasa de crecimiento histórica de cada lote.
- **Huevos en incubación:** Total de huevos activos en el incubador de cada finca y la fecha de eclosión estimada más próxima.

### 13.2 Vista por finca

- Inventario actual de cada pileta: cantidad total de animales y desglose por talla (composición de tallas del lote activo).
- Tasa de mortalidad de la finca en el periodo actual.
- Promedio de crecimiento mensual de la finca.
- Estado de cada lote activo: días transcurridos, animales actuales, próxima alimentación.
- Estado del incubador: nidos activos, próxima eclosión estimada.

### 13.3 Vista comparativa por lote (Análisis de cohortes)

Permite comparar el desempeño del lote actual en una pileta contra el lote anterior que ocupó esa misma pileta. Esto revela si la operación está mejorando, empeorando o se mantiene estable.

Métricas de comparación:

- **Crecimiento total:** Pulgadas ganadas desde la entrada hasta la salida (o hasta hoy si es el lote activo).
- **Días en pileta:** Duración del lote en la pileta.
- **Tasa de crecimiento:** Pulgadas ganadas por día o por mes.
- **Mortalidad %:** Porcentaje de bajas sobre la cantidad inicial del lote.
- **Consumo total de alimento:** Suma de kg de alimento registrados durante el lote.
- **Conversión alimenticia:** Kg de alimento consumidos por cada pulgada de crecimiento ganada.

### 13.4 Alertas visibles en el dashboard

Las alertas se muestran directamente en el dashboard (web y móvil) y no generan notificaciones push ni correos. El dueño las ve al ingresar a la aplicación.

- **Pileta sin alimentar:** La pileta no tiene registro de alimentación en el número de días configurado por el dueño.
- **Stock de alimento bajo:** El inventario de un tipo de alimento en una finca cae por debajo del umbral definido por el dueño.
- **Limpieza programada pendiente:** Hay una limpieza programada que ya superó su fecha prevista sin registro de ejecución.
- **Temperatura/humedad fuera de rango:** La última lectura registrada manualmente en el incubador está fuera del rango óptimo configurado.

---

## 14. Stack Tecnológico

- **Runtime:** Bun
- **Lenguaje:** TypeScript (strict)
- **Frontend:** React 19.2 + Vite
- **Linter / Formatter:** Biome
- **Validación:** Zod
- **UI:** shadcn/ui + Tailwind CSS + React Bits
- **Data Fetching:** TanStack Query
- **Estado local:** Zustand
- **Routing:** React Router
- **Offline:** Workbox + Dexie.js
- **Backend / BaaS:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Pagos:** Stripe
- **Correos:** Resend
- **Gráficas:** Recharts
- **Exportación:** jsPDF
- **Despliegue:** Cloudflare Pages
- **Repositorio / CI/CD:** GitHub + GitHub Actions
- **Monitoreo:** Sentry

---

*CrocoTrack — Especificación Funcional del MVP v1.1*