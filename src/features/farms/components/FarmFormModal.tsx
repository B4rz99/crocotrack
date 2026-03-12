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
import { createFarmSchema, updateFarmSchema } from "@/shared/schemas/farm.schema";

interface FarmFormModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (data: { name: string; location?: string }) => void;
  readonly isLoading?: boolean;
  readonly farm?: {
    readonly name: string;
    readonly location?: string | null;
  } | null;
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

    const schema = farm ? updateFarmSchema : createFarmSchema;
    const result = schema.safeParse({
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
