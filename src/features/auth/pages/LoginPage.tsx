import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ROUTES } from "@/shared/constants/routes";
import { supabase } from "@/shared/lib/supabase";
import type { LoginFormData } from "../components/LoginForm";
import { LoginForm } from "../components/LoginForm";

const AUTH_ERROR_MAP: Record<string, string> = {
  "Invalid login credentials": "Correo electrónico o contraseña incorrectos",
  "Email not confirmed": "Debes confirmar tu correo electrónico antes de iniciar sesión",
  "User already registered": "Ya existe una cuenta con ese correo electrónico",
  "Password should be at least 6 characters": "La contraseña debe tener al menos 6 caracteres",
};

function translateAuthError(message: string): string {
  return AUTH_ERROR_MAP[message] ?? "Ocurrió un error inesperado. Intenta de nuevo.";
}

export function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: LoginFormData) {
    setIsLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      setError(translateAuthError(authError.message));
      setIsLoading(false);
      return;
    }

    navigate(ROUTES.DASHBOARD);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iniciar Sesión</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {error}
          </p>
        )}
        <LoginForm onSubmit={handleSubmit} isLoading={isLoading} />
      </CardContent>
    </Card>
  );
}
