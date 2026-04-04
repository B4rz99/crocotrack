# Sacrificio — Especificación de Diseño

**Fecha:** 2026-04-04
**Módulo:** Sacrificio (Slaughter)
**Estado:** Aprobado

---

## 1. Resumen

El módulo de Sacrificio permite registrar el proceso de sacrificio de animales en una pileta. Todos los animales del lote activo se miden y se clasifican como aptos (sacrificados) o rechazados. Los sacrificados salen del inventario definitivamente. Los rechazados se trasladan a una o varias piletas destino dentro de la misma finca. El lote origen siempre se cierra al finalizar.

### Decisiones clave

- **Sin talla mínima en el sistema:** El control de tallas queda en manos del trabajador en campo. No hay configuración de talla mínima ni validación contra ella.
- **Sin motivo de rechazo:** No se registra el motivo por el cual un animal es rechazado. El dato es implícito en el criterio del trabajador.
- **Tallas medidas (no del lote):** El trabajador ingresa las tallas que midió en campo, no las del lote existente. Similar a clasificación.
- **Procesamiento total:** Todos los animales de la pileta se procesan. No hay sacrificio parcial.
- **Faltantes explícitos:** Si el total procesado (sacrificados + rechazados) es menor al total del lote, la diferencia se registra como `total_faltantes` para trazabilidad.
- **Destino por grupo rechazado:** Cada grupo rechazado (por talla) puede ir a una o varias piletas destino diferentes.
- **Pileta destino puede ser la de origen:** Los rechazados pueden volver a la misma pileta. Se cierra el lote viejo y se crea uno nuevo.

---

## 2. Modelo de Datos

### 2.1 Tabla `sacrificios`

```sql
CREATE TABLE public.sacrificios (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    farm_id          UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    pool_id          UUID NOT NULL REFERENCES public.pools(id) ON DELETE RESTRICT,
    lote_id          UUID NOT NULL REFERENCES public.lotes(id) ON DELETE RESTRICT,
    event_date       DATE NOT NULL,
    total_animals    INTEGER NOT NULL CHECK (total_animals > 0),
    total_sacrificed INTEGER NOT NULL CHECK (total_sacrificed >= 0),
    total_rejected   INTEGER NOT NULL CHECK (total_rejected >= 0),
    total_faltantes  INTEGER NOT NULL DEFAULT 0 CHECK (total_faltantes >= 0),
    notes            TEXT,
    created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active        BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- `total_animals`: total de animales en el lote al momento del evento (sacrificados + rechazados + faltantes).
- `total_sacrificed`: suma de animales aptos sacrificados.
- `total_rejected`: suma de animales rechazados y trasladados.
- `total_faltantes`: animales del lote no contabilizados en el proceso.
- Invariante: `total_sacrificed + total_rejected + total_faltantes = total_animals`.

### 2.2 Tabla `sacrificio_size_groups`

```sql
CREATE TABLE public.sacrificio_size_groups (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sacrificio_id        UUID NOT NULL REFERENCES public.sacrificios(id) ON DELETE CASCADE,
    group_type           TEXT NOT NULL CHECK (group_type IN ('sacrificado', 'rechazado')),
    size_inches          SMALLINT NOT NULL CHECK (size_inches > 0),
    animal_count         INTEGER NOT NULL CHECK (animal_count > 0),
    destination_pool_id  UUID REFERENCES public.pools(id) ON DELETE RESTRICT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (group_type = 'sacrificado' AND destination_pool_id IS NULL) OR
        (group_type = 'rechazado' AND destination_pool_id IS NOT NULL)
    )
);
```

- `group_type`: discriminador — `'sacrificado'` (sale del inventario) o `'rechazado'` (se traslada).
- `destination_pool_id`: nullable, requerido solo para rechazados. Validado por CHECK constraint.

### 2.3 Indexes

```sql
-- sacrificios
CREATE INDEX idx_sacrificios_org_id      ON public.sacrificios(org_id);
CREATE INDEX idx_sacrificios_farm_id     ON public.sacrificios(farm_id);
CREATE INDEX idx_sacrificios_pool_id     ON public.sacrificios(pool_id);
CREATE INDEX idx_sacrificios_lote_id     ON public.sacrificios(lote_id);
CREATE INDEX idx_sacrificios_created_by  ON public.sacrificios(created_by);
CREATE INDEX idx_sacrificios_event_date  ON public.sacrificios(event_date DESC);
CREATE INDEX idx_sacrificios_active
    ON public.sacrificios(farm_id, event_date DESC)
    WHERE is_active = true;

-- sacrificio_size_groups
CREATE INDEX idx_sacrificio_size_groups_sacrificio_id
    ON public.sacrificio_size_groups(sacrificio_id);
CREATE INDEX idx_sacrificio_size_groups_destination_pool_id
    ON public.sacrificio_size_groups(destination_pool_id);
```

### 2.4 Triggers

```sql
CREATE TRIGGER sacrificios_updated_at
    BEFORE UPDATE ON public.sacrificios
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER sacrificio_size_groups_updated_at
    BEFORE UPDATE ON public.sacrificio_size_groups
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

### 2.5 RLS Policies

**`sacrificios` (parent):**

| Policy | Operación | Condición |
|--------|-----------|-----------|
| `sacrificios_select` | SELECT | `org_id = (SELECT get_user_org_id())` |
| `sacrificios_insert` | INSERT | org match + `user_has_farm_access(farm_id)` |
| `sacrificios_update` | UPDATE | org match + `user_has_farm_access(farm_id)` |
| `sacrificios_delete` | DELETE | org match + `is_owner()` |

**`sacrificio_size_groups` (child):**

| Policy | Operación | Condición |
|--------|-----------|-----------|
| `sacrificio_size_select` | SELECT | `EXISTS` parent con org match |
| `sacrificio_size_insert` | INSERT | `EXISTS` parent con org match + farm access |
| `sacrificio_size_update` | UPDATE | `EXISTS` parent con org match + farm access |
| `sacrificio_size_delete` | DELETE | `EXISTS` parent con org match + `is_owner()` |

### 2.6 RPC: `create_sacrificio()`

**Parámetros:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `p_id` | UUID | ID pre-generado del evento |
| `p_org_id` | UUID | Org ID (no se confía, se re-resuelve) |
| `p_farm_id` | UUID | ID de la finca |
| `p_pool_id` | UUID | ID de la pileta de origen |
| `p_event_date` | DATE | Fecha del evento |
| `p_sacrificed` | JSONB | Array de `{size_inches, animal_count}` para sacrificados |
| `p_rejected` | JSONB | Array de `{size_inches, animal_count, destination_pool_id}` para rechazados |
| `p_notes` | TEXT | Notas opcionales |

**Flujo:**

1. Resolver `org_id` del caller via `get_user_org_id()`.
2. Guardia: pileta pertenece a org, es crianza, corresponde a la finca.
3. Guardia: todas las piletas destino de rechazados pertenecen a org, son crianza, misma finca.
4. Obtener total de animales del lote activo actual.
5. Calcular `total_sacrificed`, `total_rejected` desde los parámetros.
6. Calcular `total_faltantes = total_lote - (total_sacrificed + total_rejected)`.
7. Validar: `total_sacrificed + total_rejected <= total_lote` (no pueden sumar más que lo que hay).
8. Crear lotes destino en piletas que no tengan lote activo.
9. Prevención de deadlocks: lock todos los lotes afectados ordenados por id.
10. Validar que el lote origen existe y está activo (post-lock, race-safe).
11. Insertar registro en `sacrificios` con todos los totales.
12. Insertar `sacrificio_size_groups` para sacrificados (group_type = 'sacrificado', destination_pool_id = NULL).
13. Insertar `sacrificio_size_groups` para rechazados (group_type = 'rechazado', destination_pool_id = valor).
14. Eliminar **toda** la `lote_size_compositions` del lote origen.
15. Cerrar lote origen: status → 'cerrado', closed_at → NOW().
16. Si la pileta de origen es también destino de rechazados: crear nuevo lote activo.
17. Upsert `lote_size_compositions` para cada pileta destino con los rechazados.
18. Retornar `p_id`.

---

## 3. Reglas de Negocio y Validación

### 3.1 Validaciones frontend (formulario)

1. **Pileta obligatoria** — Solo piletas de crianza con lote activo.
2. **Al menos un grupo** — Mínimo una fila de talla.
3. **Total procesado <= total del lote** — sacrificados + rechazados no puede superar el total del lote. Puede ser menor (faltantes).
4. **Talla > 0** — Entero positivo.
5. **Cantidad > 0** — Cada cantidad ingresada debe ser mayor a cero (excepto sacrificados que puede ser 0 si toda la talla es rechazada).
6. **Pileta destino obligatoria para rechazados** — Cada grupo rechazado necesita pileta destino.
7. **No duplicar talla + destino** — No puede haber dos filas rechazadas con la misma talla y misma pileta destino.
8. **Fecha no futura** — event_date <= hoy.
9. **Confirmación si hay faltantes** — Si total procesado < total del lote, mostrar diálogo de confirmación antes de enviar.

### 3.2 Validaciones backend (RPC)

10. **Org del caller** — No confiar en p_org_id, resolver via get_user_org_id().
11. **Pileta es crianza** — pool_type = 'crianza'.
12. **Pileta pertenece a finca** — farm_id match.
13. **Lote activo existe** — La pileta debe tener lote activo.
14. **Piletas destino válidas** — Pertenecen a org, son crianza, misma finca.
15. **Total no excede lote** — total_sacrificed + total_rejected <= total del lote.
16. **Lock ordenado** — Prevención de deadlocks.

### 3.3 Invariantes del sistema

- El lote origen **siempre se cierra** después de un sacrificio.
- Los animales sacrificados **salen del inventario** definitivamente.
- Los rechazados **se suman al lote destino** (se crea lote si no existe).
- `total_sacrificed + total_rejected + total_faltantes = total_animals` (invariante almacenada).

---

## 4. Flujo del Formulario y UX

### 4.1 Estructura (una sola página)

**Zona 1 — Encabezado:**
- Selector de pileta (solo crianza con lote activo). Al seleccionar, muestra total de animales del lote.
- Datepicker (default hoy, no permite futuro).
- Campo de notas (opcional, colapsado por defecto).

**Zona 2 — Grupos de talla:**

Tabla dinámica con botón "+ Agregar talla". Cada fila contiene:

| Campo | Descripción |
|-------|-------------|
| Talla (pulgadas) | Input numérico entero |
| Sacrificados | Input numérico (cantidad de aptos, puede ser 0) |
| Rechazados | Sub-lista expandible: una o más filas con cantidad + pileta destino |

Ejemplo visual de una fila:

```
┌────────────┬───────────────┬──────────────────────────────────┐
│ Talla: 16" │ Sacrif.: 40   │ Rechazados:                      │
│            │               │  10 → Pileta B                   │
│            │               │  + Agregar rechazo               │
└────────────┴───────────────┴──────────────────────────────────┘
```

**Zona 3 — Resumen y confirmación:**

Panel fijo inferior con actualización en tiempo real:
- Total sacrificados
- Total rechazados
- Total procesados (sacrificados + rechazados)
- Faltantes (solo visible si > 0, con indicador de advertencia)
- Botón "Registrar sacrificio"

### 4.2 Interacciones

1. **Al seleccionar pileta:** Carga total del lote. Sin lote activo → mensaje de error.
2. **Rechazados opcionales:** Para una talla, puede haber solo sacrificados (todos aptos), solo rechazados (ninguno apto), o ambos.
3. **Múltiples destinos por talla:** Un grupo rechazado de la misma talla puede ir a diferentes piletas.
4. **Validación en tiempo real:** El resumen se actualiza en cada cambio. Errores marcados visualmente.
5. **Confirmación de faltantes:** Si faltantes > 0 al enviar, diálogo de confirmación para evitar errores accidentales.

### 4.3 Esquema Zod

```typescript
const rejectedGroupSchema = z.object({
  animal_count: z.number().int().positive(),
  destination_pool_id: z.string().uuid(),
})

const sacrificioGroupSchema = z.object({
  size_inches: z.number().int().positive(),
  sacrificed_count: z.number().int().min(0),
  rejected: z.array(rejectedGroupSchema).default([]),
})

const createSacrificioSchema = z.object({
  farm_id: z.string().uuid(),
  pool_id: z.string().uuid(),
  event_date: z.string().date(),
  groups: z.array(sacrificioGroupSchema).min(1),
  notes: z.string().optional(),
})
```

Validación adicional con `.refine()`:
- Cada grupo debe tener al menos un animal: `sacrificed_count + sum(rejected[].animal_count) > 0`.
- No puede haber dos entries en `rejected` con el mismo `destination_pool_id` dentro del mismo grupo de talla.
- No puede haber dos grupos con el mismo `size_inches` (tallas únicas por evento).

---

## 5. Capa de API, Routing y Navegación

### 5.1 API (`src/features/sacrificios/api/sacrificios.api.ts`)

| Función | Descripción |
|---------|-------------|
| `createSacrificio(data)` | Transforma el formulario validado en los JSONB `p_sacrificed` y `p_rejected`, llama al RPC `create_sacrificio()`. |
| `fetchSacrificios(farmId, page)` | Lista paginada por finca. Query a `sacrificios` con join a `pools` para nombre de pileta. Orden: `event_date DESC`. |
| `fetchSacrificioById(id)` | Detalle con `sacrificio_size_groups` + nombres de piletas destino. |

### 5.2 Hooks (`src/features/sacrificios/hooks/`)

| Hook | Descripción |
|------|-------------|
| `useCreateSacrificio()` | Mutation TanStack Query. Invalida queries de sacrificios, lotes y composiciones. |
| `useSacrificios(farmId)` | Query paginada de sacrificios por finca. |
| `useSacrificioDetail(id)` | Query del detalle de un sacrificio. |

### 5.3 Páginas (`src/features/sacrificios/pages/`)

| Página | Ruta | Descripción |
|--------|------|-------------|
| `SacrificiosPage` | `/farms/:farmId/sacrificios` | Lista: fecha, pileta, sacrificados, rechazados, faltantes. Click abre detalle. |
| `SacrificioCreatePage` | `/farms/:farmId/sacrificios/nuevo` | Formulario de registro. |
| `SacrificioDetailPage` | `/farms/:farmId/sacrificios/:sacrificioId` | Vista de solo lectura del evento. |

### 5.4 Routing

Nuevas constantes en `src/shared/constants/routes.ts`:

```typescript
SACRIFICIOS: 'sacrificios',
SACRIFICIO_CREATE: 'sacrificios/nuevo',
SACRIFICIO_DETAIL: 'sacrificios/:sacrificioId',
```

Children de `farms/:farmId` en `router.tsx`.

### 5.5 Navegación

Agregar "Sacrificios" al sidebar de `FarmLayout` con ícono `Scissors` de lucide-react, posicionado después de "Traslados".

---

## 6. Estructura de Archivos

```
src/features/sacrificios/
├── api/
│   └── sacrificios.api.ts
├── components/
│   ├── SacrificioForm.tsx
│   ├── SacrificioGroupRow.tsx
│   ├── SacrificioSummary.tsx
│   └── SacrificioDetail.tsx
├── hooks/
│   ├── use-create-sacrificio.ts
│   ├── use-sacrificios.ts
│   └── use-sacrificio-detail.ts
├── pages/
│   ├── SacrificiosPage.tsx
│   ├── SacrificioCreatePage.tsx
│   └── SacrificioDetailPage.tsx
└── types/
    └── sacrificio.types.ts

src/shared/schemas/
└── sacrificio.schema.ts

supabase/migrations/
└── 00011_sacrificio.sql
```
