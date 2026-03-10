import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { z } from "zod";
import { Button } from "@/shared/components/ui/button";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { ROUTES } from "@/shared/constants/routes";
import { zodFieldErrors } from "@/shared/lib/form-utils";

const loginSchema = z.object({
  email: z.email("Correo electrónico inválido"),
  password: z.string().min(6, "Debe tener al menos 6 caracteres"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  readonly onSubmit: (data: LoginFormData) => void;
  readonly isLoading?: boolean;
}

export function LoginForm({ onSubmit, isLoading = false }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setErrors(zodFieldErrors(result.error));
      return;
    }

    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
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

      <Button type="submit" className="w-full" disabled={isLoading}>
        Ingresar
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes una cuenta?{" "}
        <Link to={ROUTES.REGISTER} className="text-primary hover:underline">
          Regístrate aquí
        </Link>
      </p>
    </form>
  );
}
