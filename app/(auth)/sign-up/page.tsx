/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { register } from "@/service/loginService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Clinic = { id: string; name: string };

// Enum conforme Swagger
const RoleEnum = z.enum(["ADMIN", "PROFESSIONAL", "RECEPTIONIST"]);

// Agora “clinica” é exibido no UI e enviaremos “clinicId” no payload.
const SignUpSchema = z
  .object({
    name: z.string({ error: "Informe o nome" }).min(2, "Informe o nome"),
    email: z.string({ error: "Informe o e-mail" }).email("E-mail inválido"),
    password: z
      .string({ error: "Informe a senha" })
      .min(6, "Mínimo de 6 caracteres"),
    confirmPassword: z
      .string({ error: "Confirme a senha" })
      .min(6, "Confirme a senha"),
    role: RoleEnum,
    clinica: z
      .string({ error: "Selecione a clínica" })
      .min(1, "Selecione a clínica"), // id não-vazio
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  role?: string;
  clinica?: string;
};

export default function SignUpPage() {
  const [clinicas, setClinicas] = React.useState<Clinic[]>([]);
  const [clinicasLoading, setClinicasLoading] = React.useState(true);
  const [clinicasError, setClinicasError] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [role, setRole] =
    React.useState<z.infer<typeof RoleEnum>>("PROFESSIONAL");
  const [clinica, setClinica] = React.useState(""); // guarda o id selecionado

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  // Carrega a lista de clínicas
  React.useEffect(() => {
    let cancelled = false;

    async function getClinics() {
      try {
        setClinicasLoading(true);
        setClinicasError(null);
        // Troque pela sua API local/proxy. Exemplo: /api/v1/clinics
        const res = await fetch("/api/v1/clinics", { cache: "no-store" });
        if (!res.ok) throw new Error("Falha ao carregar clínicas");
        const data = await res.json();
        // Esperado: data = [{ id: string, name: string }, ...]
        if (!cancelled) {
          setClinicas(Array.isArray(data) ? data : data?.items ?? []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setClinicasError(e?.message || "Erro ao listar clínicas");
        }
      } finally {
        if (!cancelled) setClinicasLoading(false);
      }
    }

    getClinics();
    return () => {
      cancelled = true;
    };
  }, []);

  const validate = (): boolean => {
    const parsed = SignUpSchema.safeParse({
      name,
      email,
      password,
      confirmPassword,
      role,
      clinica, // valida id selecionado
    });
    if (!parsed.success) {
      const f = parsed.error.format();
      const fe: FieldErrors = {
        name: f.name?._errors?.[0],
        email: f.email?._errors?.[0],
        password: f.password?._errors?.[0],
        confirmPassword: f.confirmPassword?._errors?.[0],
        role: f.role?._errors?.[0],
        clinica: f.clinica?._errors?.[0],
      };
      setFieldErrors(fe);
      toast.error(
        fe.name ||
          fe.email ||
          fe.password ||
          fe.confirmPassword ||
          fe.role ||
          fe.clinica ||
          "Verifique os dados informados."
      );
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!validate()) return;

    const payload = {
      name,
      email,
      password,
      role,
      clinicId: clinica, // usa o id selecionado
    };

    try {
      setIsSubmitting(true);
      const response = await register(payload);
      toast.success(
        response?.message || `Cadastro realizado com sucesso!`
      );
      window.location.href = "/";
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        (error instanceof Error
          ? error.message
          : "Erro inesperado ao cadastrar");
      setErrorMsg(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-gradient-to-b from-background to-muted">
      {/* Coluna visual (desktop) */}
      <div className="relative hidden lg:flex items-center justify-center p-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.22),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(20,184,166,0.18),transparent_50%)]" />
        <div className="relative z-10 max-w-md text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Crie sua conta
          </h1>
          <p className="text-muted-foreground">
            Configure sua clínica, personalize mensagens e acompanhe KPIs em um
            só lugar.
          </p>
        </div>
      </div>

      {/* Coluna do formulário */}
      <div className="flex items-center justify-center px-6 py-10">
        <Card className="w-full max-w-md shadow-lg border-border/60">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Criar conta</CardTitle>
            <CardDescription>Gerencie a agenda da sua clínica</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMsg ? (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2 text-sm"
                role="alert"
                aria-live="assertive"
              >
                {errorMsg}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                  className={fieldErrors.name ? "border-destructive" : ""}
                />
                {fieldErrors.name ? (
                  <p id="name-error" className="text-sm text-destructive">
                    {fieldErrors.name}
                  </p>
                ) : null}
              </div>

              {/* E-mail */}
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

              {/* Senha */}
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={
                    fieldErrors.password ? "password-error" : undefined
                  }
                  className={fieldErrors.password ? "border-destructive" : ""}
                />
                {fieldErrors.password ? (
                  <p id="password-error" className="text-sm text-destructive">
                    {fieldErrors.password}
                  </p>
                ) : null}
              </div>

              {/* Confirmar Senha */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={!!fieldErrors.confirmPassword}
                  aria-describedby={
                    fieldErrors.confirmPassword ? "confirm-error" : undefined
                  }
                  className={
                    fieldErrors.confirmPassword ? "border-destructive" : ""
                  }
                />
                {fieldErrors.confirmPassword ? (
                  <p id="confirm-error" className="text-sm text-destructive">
                    {fieldErrors.confirmPassword}
                  </p>
                ) : null}
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label htmlFor="role">Papel</Label>
                <Select
                  value={role}
                  onValueChange={(e) => setRole(e as z.infer<typeof RoleEnum>)}
                  aria-invalid={!!fieldErrors.role}
                  aria-describedby={fieldErrors.role ? "role-error" : undefined}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={"Selecione o papel"} />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="PROFESSIONAL">PROFESSIONAL</SelectItem>
                    <SelectItem value="RECEPTIONIST">RECEPTIONIST</SelectItem>
                  </SelectContent>
                </Select>
                {fieldErrors.role ? (
                  <p id="role-error" className="text-sm text-destructive">
                    {fieldErrors.role}
                  </p>
                ) : null}
              </div>

              {/* Clínica (select) */}
              <div className="space-y-2">
                <Label htmlFor="clinica">Clínica</Label>
                <Select
                  value={clinica}
                  onValueChange={(e) => setClinica(e)}
                  aria-invalid={!!fieldErrors.clinica}
                  aria-describedby={
                    fieldErrors.clinica ? "clinica-error" : undefined
                  }
                  disabled={clinicasLoading || !!clinicasError}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        clinicasLoading
                          ? "Carregando clínicas..."
                          : clinicasError
                          ? "Erro ao carregar clínicas"
                          : "Selecione uma clínica"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent>
                    {/* <SelectItem value="">
                      {clinicasLoading
                        ? "Carregando clínicas..."
                        : clinicasError
                        ? "Erro ao carregar clínicas"
                        : "Selecione uma clínica"}
                    </SelectItem> */}

                    {!clinicasLoading &&
                      !clinicasError &&
                      clinicas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {clinicasError ? (
                  <button
                    type="button"
                    onClick={() => {
                      // simples refresh; se preferir, extraia o fetch e reutilize
                      location.reload();
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Tentar novamente
                  </button>
                ) : null}
                {fieldErrors.clinica ? (
                  <p id="clinica-error" className="text-sm text-destructive">
                    {fieldErrors.clinica}
                  </p>
                ) : null}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Criar conta
              </Button>

              <p className="text-sm text-muted-foreground">
                Já tem conta?{" "}
                <Link href="/sign-in" className="text-primary hover:underline">
                  Entrar
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
