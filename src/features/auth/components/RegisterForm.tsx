import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { z } from "zod";
import { Button } from "@/shared/components/ui/button";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { ROUTES } from "@/shared/constants/routes";
import { zodFieldErrors } from "@/shared/lib/form-utils";

const registerSchema = z.object({
  full_name: z.string().min(1, "Este campo es obligatorio"),
  email: z.email("Correo electrónico inválido"),
  password: z.string().min(6, "Debe tener al menos 6 caracteres"),
  org_name: z.string().min(1, "Este campo es obligatorio"),
});

export type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  readonly onSubmit: (data: RegisterFormData) => void;
  readonly isLoading?: boolean;
}

export function RegisterForm({ onSubmit, isLoading = false }: RegisterFormProps) {
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
      setErrors(zodFieldErrors(result.error));
      return;
    }

    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Nombre completo</Label>
        <Input
          id="full_name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          aria-invalid={!!errors.full_name}
        />
        <FieldError message={errors.full_name} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
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
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
        />
        <FieldError message={errors.password} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="org_name">Nombre de la organización</Label>
        <Input
          id="org_name"
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          aria-invalid={!!errors.org_name}
        />
        <FieldError message={errors.org_name} />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        Registrarse
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes una cuenta?{" "}
        <Link to={ROUTES.LOGIN} className="text-primary hover:underline">
          Inicia sesión aquí
        </Link>
      </p>
    </form>
  );
}
