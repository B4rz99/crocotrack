import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

interface IncubadorFieldsProps {
  readonly nidoNumber: string;
  readonly eclosionDate: string;
  readonly onNidoNumberChange: (v: string) => void;
  readonly onEclosionDateChange: (v: string) => void;
  readonly errors?: Record<string, string>;
}

export function IncubadorFields({
  nidoNumber,
  eclosionDate,
  onNidoNumberChange,
  onEclosionDateChange,
  errors,
}: IncubadorFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nido-number">Número de nido</Label>
        <Input
          id="nido-number"
          type="text"
          value={nidoNumber}
          onChange={(e) => onNidoNumberChange(e.target.value)}
          placeholder="Ej. N-042"
          aria-invalid={!!errors?.nido_number}
        />
        <FieldError message={errors?.nido_number} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="eclosion-date">Fecha de eclosión</Label>
        <Input
          id="eclosion-date"
          type="date"
          value={eclosionDate}
          onChange={(e) => onEclosionDateChange(e.target.value)}
          aria-invalid={!!errors?.eclosion_date}
        />
        <FieldError message={errors?.eclosion_date} />
      </div>
    </div>
  );
}
