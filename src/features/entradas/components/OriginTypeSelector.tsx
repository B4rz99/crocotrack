import { BuildingIcon, EggIcon, HomeIcon, UserIcon } from "lucide-react";
import { FieldError } from "@/shared/components/ui/field-error";
import type { EntradaOriginType } from "@/shared/schemas/entrada.schema";

interface OriginOption {
  readonly value: EntradaOriginType;
  readonly label: string;
  readonly description: string;
  readonly icon: React.ReactNode;
}

const ORIGIN_OPTIONS: readonly OriginOption[] = [
  {
    value: "proveedor_persona",
    label: "Proveedor Persona",
    description: "Persona natural con aval ANLA",
    icon: <UserIcon className="size-5" />,
  },
  {
    value: "proveedor_empresa",
    label: "Proveedor Empresa",
    description: "Empresa con NIT y aval ANLA",
    icon: <BuildingIcon className="size-5" />,
  },
  {
    value: "finca_propia",
    label: "Finca Propia",
    description: "Traslado desde otra pileta",
    icon: <HomeIcon className="size-5" />,
  },
  {
    value: "incubador",
    label: "Incubador",
    description: "Nacimiento en nido propio",
    icon: <EggIcon className="size-5" />,
  },
];

interface OriginTypeSelectorProps {
  readonly value: EntradaOriginType | undefined;
  readonly onChange: (value: EntradaOriginType) => void;
  readonly error?: string;
}

export function OriginTypeSelector({ value, onChange, error }: OriginTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        {ORIGIN_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <span
                className={`mt-0.5 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`}
              >
                {option.icon}
              </span>
              <div>
                <p className="text-sm font-medium">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </button>
          );
        })}
      </div>
      <FieldError message={error} />
    </div>
  );
}
