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
