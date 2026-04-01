import { FileIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const ACCEPTED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png";

interface AvalFileInputProps {
  readonly label?: string;
  readonly file: File | undefined;
  readonly onChange: (file: File | undefined) => void;
  readonly error?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AvalFileInput({
  label = "Documento aval (opcional)",
  file,
  onChange,
  error,
}: AvalFileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalError, setInternalError] = useState<string | undefined>();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setInternalError("Solo se permiten archivos PDF, JPG o PNG.");
      onChange(undefined);
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setInternalError("El archivo no puede superar los 10 MB.");
      onChange(undefined);
      return;
    }

    setInternalError(undefined);
    onChange(selected);
  }

  function handleClear() {
    setInternalError(undefined);
    onChange(undefined);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  const displayError = error ?? internalError;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {file ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
          <FileIcon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleClear}
            aria-label="Quitar archivo"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      ) : (
        <Input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleChange}
          className="cursor-pointer"
          aria-invalid={!!displayError}
        />
      )}
      <p className="text-xs text-muted-foreground">PDF, JPG o PNG. Máximo 10 MB.</p>
      <FieldError message={displayError} />
    </div>
  );
}
