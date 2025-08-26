"use client";

import * as React from "react";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { login } from "@/service/loginService";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const SignInSchema = z.object({
  email: z.string({ error: "Informe seu e-mail" }).email("E-mail inválido"),
  password: z
    .string({ error: "Informe sua senha" })
    .min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type FieldErrors = {
  email?: string;
  password?: string;
};

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  const validate = (): boolean => {
    const parsed = SignInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const formatted = parsed.error.format();
      const fe: FieldErrors = {
        email: formatted.email?._errors?.[0],
        password: formatted.password?._errors?.[0],
      };
      const first =
        fe.email ||
        fe.password ||
        "Verifique os dados informados e tente novamente.";
      setFieldErrors(fe);
      toast.error(first);
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    const data = { email, password };
    try {
      const response = await login(data);
      toast.success(
        response.message || `Bem-vindo, ${response.data.user.name}!`
      );
      router.push("/dashboard");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro ao fazer login";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-gradient-to-b from-background to-muted">
      {/* Coluna visual */}
      <div className="relative hidden lg:flex items-center justify-center p-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.25),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.2),transparent_50%)]" />
        <div className="relative z-10 max-w-md text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Bem-vindo(a) ao painel
          </h1>
          <p className="text-muted-foreground">
            Acesse sua conta para gerenciar a agenda, confirmações e indicadores
            da clínica.
          </p>
        </div>
      </div>
      {/* Coluna do formulário */}
      <div className="flex items-center justify-center px-6 py-10">
        <Card className="w-full max-w-md shadow-lg border-border/60">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Entrar</CardTitle>
            <CardDescription>Acesse o painel da clínica</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* {errorMsg ? (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2 text-sm"
                role="alert"
                aria-live="assertive"
              >
                {errorMsg}
              </div>
            ) : null} */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={
                    fieldErrors.email ? "email-error" : undefined
                  }
                  className={fieldErrors.email ? "border-destructive" : ""}
                />
                {fieldErrors.email ? (
                  <p id="email-error" className="text-sm text-destructive">
                    {fieldErrors.email}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={
                      fieldErrors.password ? "password-error" : undefined
                    }
                    className={`pr-10 ${
                      fieldErrors.password ? "border-destructive" : ""
                    }`}
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p id="password-error" className="text-sm text-destructive">
                    {fieldErrors.password}
                  </p>
                ) : null}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Entrar
              </Button>
            </form>

            <div className="text-sm text-muted-foreground flex items-center justify-between">
              <Link href="/forgot-password" className="hover:underline">
                Esqueci minha senha
              </Link>
              <span>
                Novo por aqui?{" "}
                <Link href="/sign-up" className="text-primary hover:underline">
                  Criar conta
                </Link>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
