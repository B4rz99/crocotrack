import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { z } from "zod";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { ROUTES } from "@/shared/constants/routes";

const registerSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  org_name: z.string().min(1, "Organization name is required"),
});

export type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  readonly onSubmit: (data: RegisterFormData) => void;
  readonly isLoading?: boolean;
}

export function RegisterForm({ onSubmit, isLoading = false }: RegisterFormProps) {
  const { t } = useTranslation("auth");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = registerSchema.safeParse({
      full_name: fullName,
      email,
      password,
      org_name: orgName,
    });

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

    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">{t("register.full_name")}</Label>
        <Input
          id="full_name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          aria-invalid={!!errors.full_name}
        />
        {errors.full_name && (
          <p role="alert" className="text-sm text-destructive">
            {errors.full_name}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t("register.email")}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
        />
        {errors.email && (
          <p role="alert" className="text-sm text-destructive">
            {errors.email}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t("register.password")}</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
        />
        {errors.password && (
          <p role="alert" className="text-sm text-destructive">
            {errors.password}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="org_name">{t("register.org_name")}</Label>
        <Input
          id="org_name"
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          aria-invalid={!!errors.org_name}
        />
        {errors.org_name && (
          <p role="alert" className="text-sm text-destructive">
            {errors.org_name}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {t("register.submit")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("register.has_account")}{" "}
        <Link to={ROUTES.LOGIN} className="text-primary hover:underline">
          {t("register.login_link")}
        </Link>
      </p>
    </form>
  );
}
