import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { zodFieldErrors } from "@/shared/lib/form-utils";
import { type CreateFarmInput, createFarmSchema } from "@/shared/schemas/farm.schema";

interface FarmSetupStepProps {
  readonly onNext: (data: CreateFarmInput) => void;
  readonly onBack: () => void;
}

export function FarmSetupStep({ onNext, onBack }: FarmSetupStepProps) {
  const { t } = useTranslation("onboarding");
  const { t: tc } = useTranslation("common");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

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

    onNext(result.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="farm-name">{t("farm.name")}</Label>
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
        <Label htmlFor="farm-location">{t("farm.location")}</Label>
        <Input
          id="farm-location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          {tc("actions.back")}
        </Button>
        <Button type="submit">{tc("actions.next")}</Button>
      </div>
    </form>
  );
}
