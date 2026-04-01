# Farms CRUD + Pool Listing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full CRUD for farms and pools with offline-first data layer, modal dialogs for forms, and a sortable pool table.

**Architecture:** TanStack Query for server state with Dexie.js fallback for offline reads. API functions try Supabase first, fall back to Dexie + sync outbox. Two pages (`/farms`, `/farms/:farmId`), three modal types (create farm, edit farm, create/edit pool), and a delete confirmation dialog. Owner-only access.

**Tech Stack:** React 19, TanStack Query, Supabase, Dexie.js, Zod v4, shadcn/ui (base-nova), Tailwind CSS v4

---

## Task 1: Add `dropdown-menu` shadcn Component

The farms and pool rows need action menus. No dropdown-menu component exists yet.

**Files:**
- Create: `src/shared/components/ui/dropdown-menu.tsx`

**Step 1: Install the component**

```bash
bunx shadcn@latest add dropdown-menu --style base-nova
```

If the CLI prompts for overwrite or confirmation, accept defaults. If the base-nova style flag doesn't work, run `bunx shadcn@latest add dropdown-menu` and it should pick up the config from `components.json`.

**Step 2: Verify the component exists**

```bash
cat src/shared/components/ui/dropdown-menu.tsx | head -5
```

Expected: File exists with `@base-ui/react` imports.

**Step 3: Commit**

```
feat(ui): add dropdown-menu component
```

---

## Task 2: Add `table` shadcn Component

The pool listing needs a table component.

**Files:**
- Create: `src/shared/components/ui/table.tsx`

**Step 1: Install the component**

```bash
bunx shadcn@latest add table --style base-nova
```

If the CLI doesn't have a `table` component for base-nova, create it manually as a simple HTML table wrapper with Tailwind styles:

```tsx
import type * as React from "react";
import { cn } from "@/shared/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-3 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-3 py-2 align-middle [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  );
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
```

**Step 2: Verify**

```bash
bun run typecheck
```

**Step 3: Commit**

```
feat(ui): add table component
```

---

## Task 3: Add Update Schemas

**Files:**
- Modify: `src/shared/schemas/farm.schema.ts`
- Modify: `src/shared/schemas/pool.schema.ts`

**Step 1: Add update schemas**

In `farm.schema.ts`, add after the existing code:

```ts
export const updateFarmSchema = createFarmSchema;

export type UpdateFarmInput = z.infer<typeof updateFarmSchema>;
```

In `pool.schema.ts`, add after the existing code:

```ts
export const updatePoolSchema = createPoolSchema;

export type UpdatePoolInput = z.infer<typeof updatePoolSchema>;
```

These are the same shape for now. Separate types allow divergence later.

**Step 2: Verify**

```bash
bun run typecheck
```

**Step 3: Commit**

```
feat(schemas): add update schemas for farm and pool
```

---

## Task 4: Farms API Layer

**Files:**
- Create: `src/features/farms/api/farms.api.ts`

This follows the onboarding pattern: try Supabase, write to Dexie, fall back to outbox on failure. For reads, try Supabase then fall back to Dexie.

**Step 1: Create the API file**

```ts
import { db } from "@/shared/lib/db";
import { supabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import type { CreateFarmInput, UpdateFarmInput } from "@/shared/schemas/farm.schema";

const generateId = (): string => crypto.randomUUID();
const nowISO = (): string => new Date().toISOString();

export async function getFarms(orgId: string) {
  const { data, error } = await supabase
    .from("farms")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    const local = await db.farms
      .where("org_id")
      .equals(orgId)
      .filter((f) => f.is_active)
      .sortBy("name");
    return local;
  }

  const now = nowISO();
  await db.farms.bulkPut(
    data.map((farm) => ({
      ...farm,
      location: farm.location ?? undefined,
      _sync_status: "synced" as const,
      _local_updated_at: now,
    })),
  );

  return data;
}

export async function getFarmById(farmId: string) {
  const { data, error } = await supabase
    .from("farms")
    .select("*")
    .eq("id", farmId)
    .single();

  if (error) {
    const local = await db.farms.get(farmId);
    return local ?? null;
  }

  const now = nowISO();
  await db.farms.put({
    ...data,
    location: data.location ?? undefined,
    _sync_status: "synced",
    _local_updated_at: now,
  });

  return data;
}

export async function createFarm(orgId: string, input: CreateFarmInput) {
  const id = generateId();
  const now = nowISO();
  const payload = {
    id,
    org_id: orgId,
    name: input.name,
    location: input.location ?? null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  const { error } = await supabase.from("farms").insert(payload);
  const syncStatus = error ? "pending" : "synced";

  await db.farms.put({
    ...payload,
    location: payload.location ?? undefined,
    _sync_status: syncStatus,
    _local_updated_at: now,
  });

  if (error) {
    await addToOutbox("farms", id, "INSERT", payload);
  }

  return { id };
}

export async function updateFarm(farmId: string, input: UpdateFarmInput) {
  const now = nowISO();
  const updates = {
    name: input.name,
    location: input.location ?? null,
    updated_at: now,
  };

  const { error } = await supabase
    .from("farms")
    .update(updates)
    .eq("id", farmId);

  await db.farms.update(farmId, {
    ...updates,
    location: updates.location ?? undefined,
    _sync_status: error ? "pending" : "synced",
    _local_updated_at: now,
  });

  if (error) {
    await addToOutbox("farms", farmId, "UPDATE", { id: farmId, ...updates });
  }
}

export async function deleteFarm(farmId: string) {
  const now = nowISO();

  const { error } = await supabase
    .from("farms")
    .update({ is_active: false, updated_at: now })
    .eq("id", farmId);

  await db.farms.update(farmId, {
    is_active: false,
    _sync_status: error ? "pending" : "synced",
    _local_updated_at: now,
  });

  if (error) {
    await addToOutbox("farms", farmId, "UPDATE", {
      id: farmId,
      is_active: false,
      updated_at: now,
    });
  }
}
```

**Step 2: Verify**

```bash
bun run typecheck
```

**Step 3: Commit**

```
feat(farms): add farms API with offline support
```

---

## Task 5: Pools API Layer

**Files:**
- Create: `src/features/farms/api/pools.api.ts`

**Step 1: Create the API file**

Same pattern as farms API but for pools. Key differences: queries filter by `farm_id`, creates require `orgId` and `farmId`.

```ts
import { db } from "@/shared/lib/db";
import { supabase } from "@/shared/lib/supabase";
import { addToOutbox } from "@/shared/lib/sync";
import type { CreatePoolInput, UpdatePoolInput } from "@/shared/schemas/pool.schema";

const generateId = (): string => crypto.randomUUID();
const nowISO = (): string => new Date().toISOString();

export async function getPoolsByFarm(farmId: string) {
  const { data, error } = await supabase
    .from("pools")
    .select("*")
    .eq("farm_id", farmId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    const local = await db.pools
      .where("farm_id")
      .equals(farmId)
      .filter((p) => p.is_active)
      .sortBy("name");
    return local;
  }

  const now = nowISO();
  await db.pools.bulkPut(
    data.map((pool) => ({
      ...pool,
      code: pool.code ?? undefined,
      capacity: pool.capacity ?? undefined,
      _sync_status: "synced" as const,
      _local_updated_at: now,
    })),
  );

  return data;
}

export async function createPool(
  orgId: string,
  farmId: string,
  input: CreatePoolInput,
) {
  const id = generateId();
  const now = nowISO();
  const payload = {
    id,
    org_id: orgId,
    farm_id: farmId,
    name: input.name,
    code: input.code ?? null,
    pool_type: input.pool_type,
    capacity: input.capacity,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  const { error } = await supabase.from("pools").insert(payload);
  const syncStatus = error ? "pending" : "synced";

  await db.pools.put({
    ...payload,
    code: payload.code ?? undefined,
    capacity: payload.capacity ?? undefined,
    _sync_status: syncStatus,
    _local_updated_at: now,
  });

  if (error) {
    await addToOutbox("pools", id, "INSERT", payload);
  }

  return { id };
}

export async function updatePool(poolId: string, input: UpdatePoolInput) {
  const now = nowISO();
  const updates = {
    name: input.name,
    code: input.code ?? null,
    pool_type: input.pool_type,
    capacity: input.capacity,
    updated_at: now,
  };

  const { error } = await supabase
    .from("pools")
    .update(updates)
    .eq("id", poolId);

  await db.pools.update(poolId, {
    ...updates,
    code: updates.code ?? undefined,
    _sync_status: error ? "pending" : "synced",
    _local_updated_at: now,
  });

  if (error) {
    await addToOutbox("pools", poolId, "UPDATE", { id: poolId, ...updates });
  }
}

export async function deletePool(poolId: string) {
  const now = nowISO();

  const { error } = await supabase
    .from("pools")
    .update({ is_active: false, updated_at: now })
    .eq("id", poolId);

  await db.pools.update(poolId, {
    is_active: false,
    _sync_status: error ? "pending" : "synced",
    _local_updated_at: now,
  });

  if (error) {
    await addToOutbox("pools", poolId, "UPDATE", {
      id: poolId,
      is_active: false,
      updated_at: now,
    });
  }
}
```

**Step 2: Verify**

```bash
bun run typecheck
```

**Step 3: Commit**

```
feat(farms): add pools API with offline support
```

---

## Task 6: TanStack Query Hooks

**Files:**
- Create: `src/features/farms/hooks/useFarms.ts`
- Create: `src/features/farms/hooks/useFarm.ts`
- Create: `src/features/farms/hooks/usePools.ts`
- Create: `src/features/farms/hooks/useFarmMutations.ts`
- Create: `src/features/farms/hooks/usePoolMutations.ts`

**Step 1: Create query hooks**

`useFarms.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { getFarms } from "../api/farms.api";

export function useFarms() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  return useQuery({
    queryKey: ["farms", orgId],
    queryFn: () => getFarms(orgId!),
    enabled: !!orgId,
  });
}
```

`useFarm.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import { getFarmById } from "../api/farms.api";

export function useFarm(farmId: string) {
  return useQuery({
    queryKey: ["farms", farmId],
    queryFn: () => getFarmById(farmId),
    enabled: !!farmId,
  });
}
```

`usePools.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import { getPoolsByFarm } from "../api/pools.api";

export function usePools(farmId: string) {
  return useQuery({
    queryKey: ["pools", farmId],
    queryFn: () => getPoolsByFarm(farmId),
    enabled: !!farmId,
  });
}
```

**Step 2: Create mutation hooks**

`useFarmMutations.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { CreateFarmInput, UpdateFarmInput } from "@/shared/schemas/farm.schema";
import { createFarm, deleteFarm, updateFarm } from "../api/farms.api";

export function useCreateFarm() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: (input: CreateFarmInput) => createFarm(profile!.org_id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
    },
  });
}

export function useUpdateFarm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ farmId, input }: { farmId: string; input: UpdateFarmInput }) =>
      updateFarm(farmId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
    },
  });
}

export function useDeleteFarm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (farmId: string) => deleteFarm(farmId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
    },
  });
}
```

`usePoolMutations.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { CreatePoolInput, UpdatePoolInput } from "@/shared/schemas/pool.schema";
import { createPool, deletePool, updatePool } from "../api/pools.api";

export function useCreatePool(farmId: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: (input: CreatePoolInput) => createPool(profile!.org_id, farmId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pools", farmId] });
    },
  });
}

export function useUpdatePool(farmId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ poolId, input }: { poolId: string; input: UpdatePoolInput }) =>
      updatePool(poolId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pools", farmId] });
    },
  });
}

export function useDeletePool(farmId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (poolId: string) => deletePool(poolId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pools", farmId] });
    },
  });
}
```

**Step 2: Verify**

```bash
bun run typecheck
```

**Step 3: Commit**

```
feat(farms): add TanStack Query hooks for farms and pools
```

---

## Task 7: DeleteConfirmDialog Component

**Files:**
- Create: `src/features/farms/components/DeleteConfirmDialog.tsx`

Reusable confirmation dialog for both farm and pool deletion.

**Step 1: Create the component**

```tsx
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

interface DeleteConfirmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly onConfirm: () => void;
  readonly isLoading?: boolean;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isLoading = false,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify**

```bash
bun run typecheck
```

**Step 3: Commit**

```
feat(farms): add delete confirmation dialog
```

---

## Task 8: Farm Form Modal (Create + Edit)

**Files:**
- Create: `src/features/farms/components/FarmFormModal.tsx`

Single component handles both create and edit via an optional `farm` prop.

**Step 1: Create the component**

```tsx
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { zodFieldErrors } from "@/shared/lib/form-utils";
import { createFarmSchema } from "@/shared/schemas/farm.schema";

interface FarmFormModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (data: { name: string; location?: string }) => void;
  readonly isLoading?: boolean;
  readonly farm?: { readonly name: string; readonly location?: string | null } | null;
}

export function FarmFormModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  farm = null,
}: FarmFormModalProps) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(farm?.name ?? "");
      setLocation(farm?.location ?? "");
      setErrors({});
    }
  }, [open, farm]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = createFarmSchema.safeParse({
      name,
      location: location || undefined,
    });

    if (!result.success) {
      setErrors(zodFieldErrors(result.error));
      return;
    }

    onSubmit(result.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{farm ? "Editar Granja" : "Crear Granja"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="farm-name">Nombre de la granja</Label>
            <Input
              id="farm-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
            />
            <FieldError message={errors.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="farm-location">Ubicación</Label>
            <Input
              id="farm-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {farm ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify**

```bash
bun run typecheck
```

**Step 3: Commit**

```
feat(farms): add farm form modal for create and edit
```

---

## Task 9: Pool Form Modal (Create + Edit)

**Files:**
- Create: `src/features/farms/components/PoolFormModal.tsx`

Same pattern as FarmFormModal but with pool_type select and capacity number input.

**Step 1: Create the component**

```tsx
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { zodFieldErrors } from "@/shared/lib/form-utils";
import { createPoolSchema } from "@/shared/schemas/pool.schema";

interface PoolFormModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (data: {
    name: string;
    pool_type: "crianza" | "reproductor";
    capacity: number;
    code?: string;
  }) => void;
  readonly isLoading?: boolean;
  readonly pool?: {
    readonly name: string;
    readonly pool_type: "crianza" | "reproductor";
    readonly capacity?: number | null;
    readonly code?: string | null;
  } | null;
}

export function PoolFormModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  pool = null,
}: PoolFormModalProps) {
  const [name, setName] = useState("");
  const [poolType, setPoolType] = useState<"crianza" | "reproductor">("crianza");
  const [capacity, setCapacity] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(pool?.name ?? "");
      setPoolType(pool?.pool_type ?? "crianza");
      setCapacity(pool?.capacity != null ? String(pool.capacity) : "");
      setErrors({});
    }
  }, [open, pool]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = createPoolSchema.safeParse({
      name,
      pool_type: poolType,
      capacity: Number(capacity),
    });

    if (!result.success) {
      setErrors(zodFieldErrors(result.error));
      return;
    }

    onSubmit(result.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pool ? "Editar Estanque" : "Crear Estanque"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pool-name">Nombre del estanque</Label>
            <Input
              id="pool-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
            />
            <FieldError message={errors.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pool-type">Tipo de estanque</Label>
            <Select
              value={poolType}
              onValueChange={(v) => {
                if (v) setPoolType(v as "crianza" | "reproductor");
              }}
            >
              <SelectTrigger id="pool-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="crianza">Crianza</SelectItem>
                <SelectItem value="reproductor">Reproductor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pool-capacity">Capacidad</Label>
            <Input
              id="pool-capacity"
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              aria-invalid={!!errors.capacity}
            />
            <FieldError message={errors.capacity} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {pool ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify**

```bash
bun run typecheck
```

**Step 3: Commit**

```
feat(farms): add pool form modal for create and edit
```

---

## Task 10: FarmsPage

**Files:**
- Create: `src/features/farms/pages/FarmsPage.tsx`
- Modify: `src/app/router.tsx` — replace placeholder import

**Step 1: Create FarmsPage**

```tsx
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";
import { FarmFormModal } from "../components/FarmFormModal";
import { useDeleteFarm, useCreateFarm, useUpdateFarm } from "../hooks/useFarmMutations";
import { useFarms } from "../hooks/useFarms";

export function FarmsPage() {
  const { data: farms, isLoading } = useFarms();
  const createFarm = useCreateFarm();
  const updateFarm = useUpdateFarm();
  const deleteFarmMutation = useDeleteFarm();

  const [createOpen, setCreateOpen] = useState(false);
  const [editFarm, setEditFarm] = useState<{
    id: string;
    name: string;
    location?: string | null;
  } | null>(null);
  const [deleteFarmTarget, setDeleteFarmTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Granjas</h1>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <PlusIcon className="mr-1 size-4" />
          Crear Granja
        </Button>
      </div>

      {farms && farms.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {farms.map((farm) => (
            <li key={farm.id} className="flex items-center justify-between px-4 py-3">
              <Link
                to={`/farms/${farm.id}`}
                className="text-sm font-medium hover:underline"
              >
                {farm.name}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <MoreHorizontalIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setEditFarm({ id: farm.id, name: farm.name, location: farm.location })}
                  >
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteFarmTarget({ id: farm.id, name: farm.name })}
                  >
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No hay granjas creadas.</p>
      )}

      <FarmFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        isLoading={createFarm.isPending}
        onSubmit={(data) => {
          createFarm.mutate(data, { onSuccess: () => setCreateOpen(false) });
        }}
      />

      <FarmFormModal
        open={!!editFarm}
        onOpenChange={(open) => { if (!open) setEditFarm(null); }}
        farm={editFarm}
        isLoading={updateFarm.isPending}
        onSubmit={(data) => {
          if (!editFarm) return;
          updateFarm.mutate(
            { farmId: editFarm.id, input: data },
            { onSuccess: () => setEditFarm(null) },
          );
        }}
      />

      <DeleteConfirmDialog
        open={!!deleteFarmTarget}
        onOpenChange={(open) => { if (!open) setDeleteFarmTarget(null); }}
        title="Eliminar Granja"
        description={`¿Estás seguro de eliminar "${deleteFarmTarget?.name}"? Esta acción se puede revertir.`}
        isLoading={deleteFarmMutation.isPending}
        onConfirm={() => {
          if (!deleteFarmTarget) return;
          deleteFarmMutation.mutate(deleteFarmTarget.id, {
            onSuccess: () => setDeleteFarmTarget(null),
          });
        }}
      />
    </div>
  );
}
```

**Step 2: Update router**

In `src/app/router.tsx`, replace the placeholder:

```tsx
// Remove: const FarmsPage = () => <div>Farms</div>;
// Add import at the top:
import { FarmsPage } from "@/features/farms/pages/FarmsPage";
```

Keep the other placeholders unchanged.

**Step 3: Verify**

```bash
bun run typecheck
```

**Step 4: Commit**

```
feat(farms): add farms list page with CRUD
```

---

## Task 11: FarmDetailPage with Pool Table

**Files:**
- Create: `src/features/farms/pages/FarmDetailPage.tsx`
- Modify: `src/app/router.tsx` — replace FarmDetailPage placeholder

**Step 1: Create FarmDetailPage**

```tsx
import { ArrowLeftIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { ROUTES } from "@/shared/constants/routes";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";
import { FarmFormModal } from "../components/FarmFormModal";
import { PoolFormModal } from "../components/PoolFormModal";
import { useFarm } from "../hooks/useFarm";
import { useDeleteFarm, useUpdateFarm } from "../hooks/useFarmMutations";
import { useCreatePool, useDeletePool, useUpdatePool } from "../hooks/usePoolMutations";
import { usePools } from "../hooks/usePools";

type SortKey = "name" | "pool_type" | "capacity";
type SortDir = "asc" | "desc";

export function FarmDetailPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { data: farm, isLoading: farmLoading } = useFarm(farmId!);
  const { data: pools, isLoading: poolsLoading } = usePools(farmId!);

  const updateFarm = useUpdateFarm();
  const deleteFarmMutation = useDeleteFarm();
  const createPool = useCreatePool(farmId!);
  const updatePool = useUpdatePool(farmId!);
  const deletePoolMutation = useDeletePool(farmId!);

  const [editFarmOpen, setEditFarmOpen] = useState(false);
  const [deleteFarmOpen, setDeleteFarmOpen] = useState(false);
  const [createPoolOpen, setCreatePoolOpen] = useState(false);
  const [editPool, setEditPool] = useState<{
    id: string;
    name: string;
    pool_type: "crianza" | "reproductor";
    capacity?: number | null;
    code?: string | null;
  } | null>(null);
  const [deletePoolTarget, setDeletePoolTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedPools = pools
    ? [...pools].sort((a, b) => {
        const aVal = a[sortKey] ?? "";
        const bVal = b[sortKey] ?? "";
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      })
    : [];

  if (farmLoading || poolsLoading) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  if (!farm) {
    return <div className="text-sm text-destructive">Granja no encontrada.</div>;
  }

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to={ROUTES.FARMS}>
          <Button variant="ghost" size="icon-sm">
            <ArrowLeftIcon className="size-4" />
          </Button>
        </Link>
        <h1 className="flex-1 text-xl font-bold">{farm.name}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditFarmOpen(true)}>
              Editar Granja
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeleteFarmOpen(true)}>
              Eliminar Granja
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Estanques ({sortedPools.length})
        </h2>
        <Button onClick={() => setCreatePoolOpen(true)} size="sm">
          <PlusIcon className="mr-1 size-4" />
          Crear Estanque
        </Button>
      </div>

      {sortedPools.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("name")}
              >
                Nombre{sortIndicator("name")}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("pool_type")}
              >
                Tipo{sortIndicator("pool_type")}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("capacity")}
              >
                Capacidad{sortIndicator("capacity")}
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPools.map((pool) => (
              <TableRow key={pool.id}>
                <TableCell className="font-medium">{pool.name}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      pool.pool_type === "reproductor"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {pool.pool_type === "reproductor" ? "Reproductor" : "Crianza"}
                  </span>
                </TableCell>
                <TableCell>{pool.capacity ?? "—"}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          setEditPool({
                            id: pool.id,
                            name: pool.name,
                            pool_type: pool.pool_type,
                            capacity: pool.capacity,
                            code: pool.code,
                          })
                        }
                      >
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletePoolTarget({ id: pool.id, name: pool.name })}
                      >
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">No hay estanques creados.</p>
      )}

      {/* Farm modals */}
      <FarmFormModal
        open={editFarmOpen}
        onOpenChange={setEditFarmOpen}
        farm={farm}
        isLoading={updateFarm.isPending}
        onSubmit={(data) => {
          updateFarm.mutate(
            { farmId: farmId!, input: data },
            { onSuccess: () => setEditFarmOpen(false) },
          );
        }}
      />

      <DeleteConfirmDialog
        open={deleteFarmOpen}
        onOpenChange={setDeleteFarmOpen}
        title="Eliminar Granja"
        description={`¿Estás seguro de eliminar "${farm.name}"? Esta acción se puede revertir.`}
        isLoading={deleteFarmMutation.isPending}
        onConfirm={() => {
          deleteFarmMutation.mutate(farmId!, {
            onSuccess: () => navigate(ROUTES.FARMS),
          });
        }}
      />

      {/* Pool modals */}
      <PoolFormModal
        open={createPoolOpen}
        onOpenChange={setCreatePoolOpen}
        isLoading={createPool.isPending}
        onSubmit={(data) => {
          createPool.mutate(data, { onSuccess: () => setCreatePoolOpen(false) });
        }}
      />

      <PoolFormModal
        open={!!editPool}
        onOpenChange={(open) => { if (!open) setEditPool(null); }}
        pool={editPool}
        isLoading={updatePool.isPending}
        onSubmit={(data) => {
          if (!editPool) return;
          updatePool.mutate(
            { poolId: editPool.id, input: data },
            { onSuccess: () => setEditPool(null) },
          );
        }}
      />

      <DeleteConfirmDialog
        open={!!deletePoolTarget}
        onOpenChange={(open) => { if (!open) setDeletePoolTarget(null); }}
        title="Eliminar Estanque"
        description={`¿Estás seguro de eliminar "${deletePoolTarget?.name}"? Esta acción se puede revertir.`}
        isLoading={deletePoolMutation.isPending}
        onConfirm={() => {
          if (!deletePoolTarget) return;
          deletePoolMutation.mutate(deletePoolTarget.id, {
            onSuccess: () => setDeletePoolTarget(null),
          });
        }}
      />
    </div>
  );
}
```

**Step 2: Update router**

In `src/app/router.tsx`:

```tsx
// Remove: const FarmDetailPage = () => <div>Farm Detail</div>;
// Add import:
import { FarmDetailPage } from "@/features/farms/pages/FarmDetailPage";
```

**Step 3: Verify**

```bash
bun run typecheck
```

**Step 4: Commit**

```
feat(farms): add farm detail page with pool table
```

---

## Task 12: Tests — API Functions

**Files:**
- Create: `src/features/farms/api/__tests__/farms.api.test.ts`
- Create: `src/features/farms/api/__tests__/pools.api.test.ts`

Write tests that mock Supabase and verify Dexie fallback behavior. Follow the pattern in `src/shared/lib/__tests__/sync.test.ts`.

**Step 1: Write farms API tests**

Test cases:
- `getFarms` returns data from Supabase and populates Dexie
- `getFarms` falls back to Dexie when Supabase errors
- `createFarm` writes to Supabase and Dexie
- `createFarm` adds to outbox when Supabase fails
- `deleteFarm` sets `is_active = false`

**Step 2: Write pools API tests**

Same pattern for pool CRUD operations.

**Step 3: Run tests**

```bash
bun run test:run
```

**Step 4: Commit**

```
test(farms): add API tests for farms and pools
```

---

## Task 13: Tests — Components

**Files:**
- Create: `src/features/farms/components/__tests__/FarmFormModal.test.tsx`
- Create: `src/features/farms/components/__tests__/DeleteConfirmDialog.test.tsx`

**Step 1: Write FarmFormModal tests**

Test cases:
- Renders "Crear Granja" title when no farm prop
- Renders "Editar Granja" title when farm prop provided
- Shows validation error when name is empty
- Calls onSubmit with form data when valid
- Pre-fills fields in edit mode

**Step 2: Write DeleteConfirmDialog tests**

Test cases:
- Renders title and description
- Calls onConfirm when Eliminar clicked
- Calls onOpenChange(false) when Cancelar clicked

**Step 3: Run tests**

```bash
bun run test:run
```

**Step 4: Commit**

```
test(farms): add component tests for modals
```

---

## Task 14: Final Verification

**Step 1: Run full CI suite**

```bash
bun run lint
bun run typecheck
bun run test:run
bun run build
```

All must pass.

**Step 2: Verify no stale .gitkeep files remain in farms/**

Delete any `.gitkeep` files in `src/features/farms/` subdirectories that now contain real files. Keep `.gitkeep` in empty directories like `src/features/farms/stores/` and `src/features/farms/types/`.

**Step 3: Final commit if needed**

```
chore(farms): cleanup gitkeep files
```

---

## Verification Checklist

```bash
bun run lint        # Biome passes
bun run typecheck   # No type errors
bun run test:run    # All tests pass
bun run build       # Production build succeeds
```

## File Summary

| Action | File |
|--------|------|
| Create | `src/shared/components/ui/dropdown-menu.tsx` |
| Create | `src/shared/components/ui/table.tsx` |
| Create | `src/features/farms/api/farms.api.ts` |
| Create | `src/features/farms/api/pools.api.ts` |
| Create | `src/features/farms/hooks/useFarms.ts` |
| Create | `src/features/farms/hooks/useFarm.ts` |
| Create | `src/features/farms/hooks/usePools.ts` |
| Create | `src/features/farms/hooks/useFarmMutations.ts` |
| Create | `src/features/farms/hooks/usePoolMutations.ts` |
| Create | `src/features/farms/components/DeleteConfirmDialog.tsx` |
| Create | `src/features/farms/components/FarmFormModal.tsx` |
| Create | `src/features/farms/components/PoolFormModal.tsx` |
| Create | `src/features/farms/pages/FarmsPage.tsx` |
| Create | `src/features/farms/pages/FarmDetailPage.tsx` |
| Create | `src/features/farms/api/__tests__/farms.api.test.ts` |
| Create | `src/features/farms/api/__tests__/pools.api.test.ts` |
| Create | `src/features/farms/components/__tests__/FarmFormModal.test.tsx` |
| Create | `src/features/farms/components/__tests__/DeleteConfirmDialog.test.tsx` |
| Modify | `src/shared/schemas/farm.schema.ts` |
| Modify | `src/shared/schemas/pool.schema.ts` |
| Modify | `src/app/router.tsx` |
