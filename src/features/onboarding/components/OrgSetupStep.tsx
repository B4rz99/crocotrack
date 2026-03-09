import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { type CreateOrgInput, createOrgSchema } from "@/shared/schemas/org.schema";

interface OrgSetupStepProps {
  readonly onNext: (data: CreateOrgInput) => void;
}

export function OrgSetupStep({ onNext }: OrgSetupStepProps) {
  const { t } = useTranslation("onboarding");
  const { t: tc } = useTranslation("common");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("CO");
  const [currency, setCurrency] = useState("COP");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = createOrgSchema.safeParse({ name, country, currency });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    onNext(result.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="org-name">{t("org.name")}</Label>
        <Input
          id="org-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p role="alert" className="text-sm text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-country">{t("org.country")}</Label>
        <Input
          id="org-country"
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          aria-invalid={!!errors.country}
        />
        {errors.country && (
          <p role="alert" className="text-sm text-destructive">
            {errors.country}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-currency">{t("org.currency")}</Label>
        <Input
          id="org-currency"
          type="text"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          aria-invalid={!!errors.currency}
        />
        {errors.currency && (
          <p role="alert" className="text-sm text-destructive">
            {errors.currency}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit">{tc("actions.next")}</Button>
      </div>
    </form>
  );
}
