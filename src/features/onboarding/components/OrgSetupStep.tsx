import { type FormEvent, useState } from "react";
import { Button } from "@/shared/components/ui/button";
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
import { COUNTRIES, COUNTRY_CURRENCY_MAP, CURRENCIES } from "@/shared/constants/countries";
import { zodFieldErrors } from "@/shared/lib/form-utils";
import { type CreateOrgInput, createOrgSchema } from "@/shared/schemas/org.schema";

interface OrgSetupStepProps {
  readonly onNext: (data: CreateOrgInput) => void;
}

export function OrgSetupStep({ onNext }: OrgSetupStepProps) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("CO");
  const [currency, setCurrency] = useState("COP");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleCountryChange(value: string | null) {
    if (!value) return;
    setCountry(value);
    const mapped = COUNTRY_CURRENCY_MAP[value];
    if (mapped) {
      setCurrency(mapped);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = createOrgSchema.safeParse({ name, country, currency });
    if (!result.success) {
      setErrors(zodFieldErrors(result.error));
      return;
    }

    onNext(result.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="org-name">Nombre de la organización</Label>
        <Input
          id="org-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!errors.name}
        />
        <FieldError message={errors.name} />
      </div>

      <div className="space-y-2">
        <Label>País</Label>
        <Select value={country} onValueChange={handleCountryChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errors.country} />
      </div>

      <div className="space-y-2">
        <Label>Moneda</Label>
        <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errors.currency} />
      </div>

      <div className="flex justify-end">
        <Button type="submit">Siguiente</Button>
      </div>
    </form>
  );
}
