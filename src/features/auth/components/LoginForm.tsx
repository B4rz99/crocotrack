import { type FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { z } from "zod";
import { Button } from "@/shared/components/ui/button";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { ROUTES } from "@/shared/constants/routes";
import { zodFieldErrors } from "@/shared/lib/form-utils";

export type LoginFormData = z.infer<ReturnType<typeof makeLoginSchema>>;

const makeLoginSchema = (t: (key: string, opts?: Record<string, unknown>) => string) =>
  z.object({
    email: z.email(t("validation.invalid_email")),
    password: z.string().min(6, t("validation.min_length", { min: 6 })),
  });

interface LoginFormProps {
  readonly onSubmit: (data: LoginFormData) => void;
  readonly isLoading?: boolean;
}

export function LoginForm({ onSubmit, isLoading = false }: LoginFormProps) {
  const { t } = useTranslation("auth");
  const { t: tc } = useTranslation("common");
  const schema = useMemo(() => makeLoginSchema(tc), [tc]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = schema.safeParse({ email, password });
    if (!result.success) {
      setErrors(zodFieldErrors(result.error));
      return;
    }

    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("login.email")}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
        />
        <FieldError message={errors.email} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t("login.password")}</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
        />
        <FieldError message={errors.password} />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {t("login.submit")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("login.no_account")}{" "}
        <Link to={ROUTES.REGISTER} className="text-primary hover:underline">
          {t("login.register_link")}
        </Link>
      </p>
    </form>
  );
}
