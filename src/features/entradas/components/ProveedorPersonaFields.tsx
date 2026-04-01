import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { AvalFileInput } from "./AvalFileInput";

interface ProveedorPersonaFieldsProps {
  readonly fullName: string;
  readonly documentId: string;
  readonly avalCode: string;
  readonly avalFile: File | undefined;
  readonly onFullNameChange: (v: string) => void;
  readonly onDocumentIdChange: (v: string) => void;
  readonly onAvalCodeChange: (v: string) => void;
  readonly onAvalFileChange: (f: File | undefined) => void;
  readonly errors?: Record<string, string>;
}

export function ProveedorPersonaFields({
  fullName,
  documentId,
  avalCode,
  avalFile,
  onFullNameChange,
  onDocumentIdChange,
  onAvalCodeChange,
  onAvalFileChange,
  errors,
}: ProveedorPersonaFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="persona-full-name">Nombre completo</Label>
        <Input
          id="persona-full-name"
          type="text"
          value={fullName}
          onChange={(e) => onFullNameChange(e.target.value)}
          aria-invalid={!!errors?.persona_full_name}
        />
        <FieldError message={errors?.persona_full_name} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="persona-document-id">Número de documento</Label>
        <Input
          id="persona-document-id"
          type="text"
          value={documentId}
          onChange={(e) => onDocumentIdChange(e.target.value)}
          aria-invalid={!!errors?.persona_document_id}
        />
        <FieldError message={errors?.persona_document_id} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="persona-aval-code">Código ANLA (opcional)</Label>
        <Input
          id="persona-aval-code"
          type="text"
          value={avalCode}
          onChange={(e) => onAvalCodeChange(e.target.value)}
        />
      </div>
      <AvalFileInput file={avalFile} onChange={onAvalFileChange} />
    </div>
  );
}
