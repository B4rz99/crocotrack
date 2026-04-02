import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { AvalFileInput } from "./AvalFileInput";

interface ProveedorEmpresaFieldsProps {
  readonly empresaName: string;
  readonly legalRep: string;
  readonly nit: string;
  readonly avalCode: string;
  readonly avalFile: File | undefined;
  readonly onEmpresaNameChange: (v: string) => void;
  readonly onLegalRepChange: (v: string) => void;
  readonly onNitChange: (v: string) => void;
  readonly onAvalCodeChange: (v: string) => void;
  readonly onAvalFileChange: (f: File | undefined) => void;
  readonly errors?: Record<string, string>;
}

export function ProveedorEmpresaFields({
  empresaName,
  legalRep,
  nit,
  avalCode,
  avalFile,
  onEmpresaNameChange,
  onLegalRepChange,
  onNitChange,
  onAvalCodeChange,
  onAvalFileChange,
  errors,
}: ProveedorEmpresaFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="empresa-name">Nombre de la empresa</Label>
        <Input
          id="empresa-name"
          type="text"
          value={empresaName}
          onChange={(e) => onEmpresaNameChange(e.target.value)}
          aria-invalid={!!errors?.empresa_name}
        />
        <FieldError message={errors?.empresa_name} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="empresa-legal-rep">Representante legal</Label>
        <Input
          id="empresa-legal-rep"
          type="text"
          value={legalRep}
          onChange={(e) => onLegalRepChange(e.target.value)}
          aria-invalid={!!errors?.empresa_legal_rep}
        />
        <FieldError message={errors?.empresa_legal_rep} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="empresa-nit">NIT</Label>
        <Input
          id="empresa-nit"
          type="text"
          value={nit}
          onChange={(e) => onNitChange(e.target.value)}
          aria-invalid={!!errors?.empresa_nit}
        />
        <FieldError message={errors?.empresa_nit} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="empresa-aval-code">Código ANLA (opcional)</Label>
        <Input
          id="empresa-aval-code"
          type="text"
          value={avalCode}
          onChange={(e) => onAvalCodeChange(e.target.value)}
        />
      </div>
      <AvalFileInput file={avalFile} onChange={onAvalFileChange} />
    </div>
  );
}
