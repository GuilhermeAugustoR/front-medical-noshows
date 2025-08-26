<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# MVP “Agenda Anti No‑show” – Especificação técnica detalhada

Abaixo vai um escopo direto para implementar o MVP com Node.js + Express + TypeScript, Postgres + Prisma, e frontend Next.js. Foca no core: agendar, confirmar/reagendar via link mágico, lembretes automatizados e sinal via Pix, com um painel simples de métricas.

## Objetivo do MVP (v1)

- Coletar agendamentos (tipos de consulta, horários).
- Enviar lembretes e coletar confirmação/reagendamento via link mágico.
- Opcional: cobrar sinal via Pix para determinados tipos de consulta.
- Painel com taxa de confirmação, no‑show e reagendamentos.
- Exportação CSV e PDF simples.
- Multi‑clínica e multi‑profissional desde o schema, ainda que com um tenant “simples”.

***

## Arquitetura e Stack

- Frontend: Next.js 14 (App Router), TypeScript, Tailwind, TanStack Table, Recharts, React Hook Form + Zod, NextAuth (e‑mail link/credenciais), PWA (Workbox) opcional para recepção.
- Backend: Node.js 20+, Express, TypeScript, Zod para validação, Prisma ORM, PostgreSQL.
- Mensageria/agendador: BullMQ (Redis) ou node-cron + filas simples (preferível BullMQ para retries e delay).
- Integrações:
    - Calendário: Google Calendar/Outlook (pode começar com “agenda interna” no MVP e deixar OAuth para v1.1).
    - WhatsApp oficial: provedor (Zenvia, Gupshup, Infobip, Cloud API Meta) – MVP pode simular com SMS/e‑mail enquanto negocia WABA.
    - Pix: Gerencianet, Mercado Pago ou Pagar.me (comece com um provedor).
- Infra: Docker Compose (api, db, redis), Prisma Migrate, .env, logs com Pino, Sentry opcional.
- Segurança/LGPD: mínimo necessário – termos de uso, consentimento para mensagens, opt-out, criptografia em repouso para dados sensíveis (ex.: telefone com pgcrypto, se desejado), RBAC simples.

***

## Modelagem de dados (Prisma – sugestão)

Entidades principais:

- Clinic (tenant), User (papel: admin, recepcionista, profissional)
- Professional (médico/fisio), ServiceType (tipo de consulta/procedimento)
- Room (opcional, p/ bloqueios por sala/equipamento)
- Patient
- Appointment (estado: scheduled, confirmed, rescheduled, cancelled, no_show, paid_deposit)
- Reminder (log de envios), MessageTemplate (personalização)
- Payment (Pix), WebhookEvent (logs de callbacks)
- Setting (parâmetros por clínica: janelas, textos, política de cancelamento)

Exemplo (trechos) do schema.prisma:

```prisma
model Clinic {
  id            String   @id @default(uuid())
  name          String
  timezone      String   @default("America/Sao_Paulo")
  settings      Json?
  users         User[]
  professionals Professional[]
  serviceTypes  ServiceType[]
  patients      Patient[]
  appointments  Appointment[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model User {
  id        String  @id @default(uuid())
  clinicId  String
  clinic    Clinic  @relation(fields: [clinicId], references: [id])
  email     String  @unique
  name      String
  role      UserRole
  password  String? // se usar credenciais
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum UserRole {
  ADMIN
  RECEPTION
  PROFESSIONAL
}

model Professional {
  id        String  @id @default(uuid())
  clinicId  String
  clinic    Clinic  @relation(fields: [clinicId], references: [id])
  name      String
  email     String?
  phone     String?
  calendars Json?   // refs externos (Google/Outlook) futura integração
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ServiceType {
  id              String  @id @default(uuid())
  clinicId        String
  clinic          Clinic  @relation(fields: [clinicId], references: [id])
  name            String
  durationMin     Int
  requiresDeposit Boolean  @default(false)
  depositAmount   Int?     // em centavos
  instructions    String?
}

model Patient {
  id          String  @id @default(uuid())
  clinicId    String
  clinic      Clinic  @relation(fields: [clinicId], references: [id])
  name        String
  email       String?
  phone       String?
  documentId  String? // CPF/RG
  birthDate   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Appointment {
  id              String   @id @default(uuid())
  clinicId        String
  clinic          Clinic   @relation(fields: [clinicId], references: [id])
  professionalId  String
  professional    Professional @relation(fields: [professionalId], references: [id])
  serviceTypeId   String
  serviceType     ServiceType  @relation(fields: [serviceTypeId], references: [id])
  patientId       String
  patient         Patient  @relation(fields: [patientId], references: [id])
  startTime       DateTime
  endTime         DateTime
  status          AppointmentStatus @default(SCHEDULED)
  confirmationAt  DateTime?
  rescheduleLink  String?  @unique
  confirmLink     String?  @unique
  cancelLink      String?  @unique
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  payments        Payment[]
}

enum AppointmentStatus {
  SCHEDULED
  CONFIRMED
  RESCHEDULED
  CANCELLED
  NO_SHOW
  PAID_DEPOSIT
}

model Reminder {
  id            String  @id @default(uuid())
  appointmentId String
  appointment   Appointment @relation(fields: [appointmentId], references: [id])
  channel       ReminderChannel
  templateKey   String
  sendAt        DateTime
  sentAt        DateTime?
  status        ReminderStatus @default(PENDING)
  response      Json?
  createdAt     DateTime @default(now())
}

enum ReminderChannel {
  WHATSAPP
  SMS
  EMAIL
}

enum ReminderStatus {
  PENDING
  SENT
  FAILED
}

model Payment {
  id            String  @id @default(uuid())
  clinicId      String
  clinic        Clinic  @relation(fields: [clinicId], references: [id])
  appointmentId String
  appointment   Appointment @relation(fields: [appointmentId], references: [id])
  provider      String
  amount        Int
  currency      String @default("BRL")
  status        PaymentStatus @default(PENDING)
  qrCode        String?
  payload       Json?
  externalId    String? // id do provedor
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  EXPIRED
}

model WebhookEvent {
  id        String   @id @default(uuid())
  source    String
  payload   Json
  createdAt DateTime @default(now())
}
```


***

## Fluxos principais

1) Agendamento

- Escolha de profissional + tipo de serviço + slot disponível.
- Criação do Patient (ou matching por telefone/e‑mail).
- Criação do Appointment com links mágicos (confirm, reschedule, cancel) – assine com token curto e expiração controlada.
- Se requiresDeposit: gerar Payment (Pix), mostrar QR e ouvir webhook para marcar “PAID” e atualizar Appointment para PAID_DEPOSIT.
- Geração de jobs “lembretes” para T‑48h, T‑24h, T‑3h (configurável por clínica).

2) Confirmação/Reagendamento/Cancelamento

- Acesso via link mágico (sem login).
- Confirm: seta status CONFIRMED e confirmationAt.
- Reagendar: abre seletor de novos slots; ao confirmar novo horário, marca RESCHEDULED e atualiza start/end.
- Cancel: seta CANCELLED (aplicar política – ex.: impedir cancelamentos tardios).
- Feedback visual simples e possibilidade de salvar no calendário (ics).

3) Lembretes

- Worker verifica fila e dispara via provedor (WhatsApp/SMS/Email).
- Log em Reminder com status e resposta do provedor.
- Links encurtados com tracking (ex.: /a/{token}).

4) No‑show

- Regra operacional no painel: recepção marca NO_SHOW quando passa X minutos do horário sem confirmação/comparecimento (ou automatizável no futuro).

5) Painel e Exportações

- KPIs: taxa de confirmação, no‑show, reagendamentos, consultas com depósito, receita de depósitos.
- Filtros por período, profissional, serviço.
- Export CSV e geração de PDF via endpoint.

***

## Disponibilidade de horários (slots)

Para v1, implemente um “Scheduler interno”:

- Tabela de janelas por profissional (ex.: seg–sex 09:00–18:00).
- Bloqueios pontuais (feriados/ausências).
- Duração do serviço define slots; aplique buffers.
- Ao agendar, verifique conflito no banco (transação serializable ou unique index por intervalo via lock lógico).
- Estruture um futuro adapter para Google/Outlook (v1.1).

***

## Endpoints (API Express – sugestão)

Base: /api

Autenticação painel:

- POST /auth/login
- POST /auth/logout
- GET /auth/me

Clínica e configurações:

- GET /clinics/:id
- PATCH /clinics/:id/settings

Profissionais e serviços:

- GET /professionals
- POST /professionals
- GET /service-types
- POST /service-types

Pacientes:

- GET /patients
- POST /patients

Agenda/Slots:

- GET /availability?professionalId=\&serviceTypeId=\&date=
- POST /appointments
- GET /appointments/:id
- PATCH /appointments/:id (status, notas)

Links mágicos (público):

- GET /public/confirm/:token
- GET /public/reschedule/:token
- POST /public/reschedule/:token (novo horário)
- GET /public/cancel/:token
- GET /public/payment/:token (status do depósito, exibe QR se pendente)

Lembretes:

- POST /reminders/schedule (gerar jobs para faixa de datas)
- POST /webhooks/messaging (callback provedor)
- GET /reminders?appointmentId=

Pagamentos (Pix):

- POST /payments/:appointmentId/deposit
- GET /payments/:id
- POST /webhooks/pix

Relatórios:

- GET /reports/kpis?from=\&to=\&professionalId=
- GET /reports/export.csv
- GET /reports/export.pdf

Observações:

- Use Zod nos DTOs; rate limit nos públicos.
- Todos os endpoints internos com auth + scoping por clinicId.

***

## Mensagens e Templates

Templates parametrizados por clínica e por procedimento:

- Placeholders: {paciente}, {profissional}, {data}, {hora}, {endereco}, {deposito}, {link_confirmar}, {link_reagendar}, {link_cancelar}.
- Fluxo padrão:
    - T‑48h: “Sua consulta em {data} {hora} com {profissional}. Confirmar: {link_confirmar}. Reagendar: {link_reagendar}.”
    - T‑24h: reforço.
    - T‑3h: lembrete curto com mapa (opcional).
- Regras de janela silenciosa (não enviar fora de 08:00–21:00) e retry exponencial.

***

## Frontend – Telas (MVP)

Público (sem login):

- Widget de Agendamento: seleção de serviço, profissional, data/hora, dados do paciente, resumo e (se aplicável) depósito via Pix. Após criar, mostra status e link para gerenciar.
- Página de Confirmação/Reagendamento/Cancelamento: vistas limpas, mobile‑first, feedback claro, CTA “Adicionar ao calendário”.

Painel (Next.js + NextAuth):

- Dashboard: KPIs, gráfico semanal, cards de “envios hoje”, “pendências de depósito”.
- Agenda: visão por dia/semana, filtro por profissional/serviço/sala; ações: confirmar, reagendar, cancelar, marcar no‑show.
- Pacientes: lista com busca, histórico de consultas.
- Lembretes: log com status (enviado/falhou).
- Configurações: templates de mensagens, janelas de envio, política de cancelamento, valor de depósito por serviço.

UX dicas:

- Ações 1‑clique (confirmar, reagendar).
- Estados vazios com instruções curtas.
- Alto contraste, componentes grandes para recepção.

***

## Jobs e Agendamento

- Use BullMQ + Redis:
    - Fila “reminders”: payload {appointmentId, templateKey, channel, sendAt}.
    - Fila “payment-status”: checar expiração do QR/atualização.
- Worker separado do servidor web.
- Timezone por clínica (luxon/dayjs‑tz) para calcular T‑48/T‑24/T‑3.

***

## Integração Pix (linha de corte do MVP)

- POST /payments/:appointmentId/deposit cria intenção no provedor e retorna:
    - amount, qrCode (imagem/base64 ou payload), externalId.
- Webhook do provedor:
    - Se status = paid: atualizar Payment -> PAID, Appointment -> PAID_DEPOSIT (ou manter CONFIRMED se já confirmado).
    - Se expirou: Payment -> EXPIRED e notificar recepção (opcional).
- Regras: permitir reagendar/cancelar com depósito conforme política (ex.: perde sinal com <24h).

***

## Segurança e LGPD (essencial no MVP)

- Consentimento explícito para receber mensagens (checkbox no agendamento).
- Opt‑out rápido em mensagens (“Responder SAIR para parar” – para SMS; no WhatsApp, instruir canal).
- Logs de acesso por usuário; trilha de ações de agenda.
- Minimizar dados sensíveis no payload de mensagens (use tokens curtos).

***

## Observabilidade e qualidade

- Logs estruturados (Pino) com correlationId por request.
- Healthcheck e readiness endpoints.
- Testes: unitários para serviços (slots, regras), e2e leve para rotas públicas.
- Rate limit em links públicos (ex.: 10 req/min/IP).

***

Dias 1–2
Backend

Inicialização do projeto: Express + TypeScript + Zod, configuração de .env, logger e middlewares (CORS, Helmet, JSON).

Postgres + Prisma: definição inicial do schema (Clinic, Professional, ServiceType, Patient, Appointment, Payment, Reminder), geração e aplicação de migrações.

Seed básico: criar 1 clínica, 1 profissional, 2 serviços e horários base.

(Opcional) Configuração de Redis se for usar filas já nesta fase.

Estruturar rotas base e padrão de erro/respostas (envelopes).

Frontend

Inicialização do Next.js + TypeScript + Tailwind + shadcn/ui.

Design System: tokens básicos (cores, espaçamentos) e componentes UI reutilizáveis (Button, Input, Select, Dialog, Toast).

Setup de estrutura de pastas, provider de tema, layout base, tipografia e ícones.

Cliente HTTP e camadas de validação (Zod) para os DTOs combinados com o backend.

Dias 3–4
Backend

Lógica de disponibilidade interna de slots:

Serviços: duração, buffers; agenda do profissional; bloqueios.

Endpoint GET /availability com filtros por profissional, serviço e data.

Agendamento:

Endpoint POST /appointments criando Patient (ou match) e Appointment.

Regras de conflito e transação; geração de tokens/links para fluxos públicos.

Retornar payload consistente para o Front consumir.

Frontend

Widget público de agendamento (MVP, sem Pix):

Seleção de serviço e profissional, busca de disponibilidade, formulário do paciente.

Chamada ao POST /appointments e tela de confirmação do agendamento.

Estados de loading/erro e validações com Zod.

UX mobile-first e CTA de adicionar ao calendário (ics simples se já disponível do back).

Dias 5–6
Backend

Links mágicos:

Geração/validação de tokens para confirmar/reagendar/cancelar.

Endpoints públicos: GET /public/confirm/:token, GET/POST /public/reschedule/:token, GET /public/cancel/:token.

Lembretes:

Configurar filas (BullMQ) e jobs para T‑48h, T‑24h, T‑3h.

Modelagem e armazenamento de templates de mensagens; endpoint para listar/alterar templates por clínica.

Frontend

Páginas públicas:

Confirmar, reagendar, cancelar por token (rotas do App Router).

Fluxo de reagendamento com busca de slots e confirmação do novo horário.

Gestão de templates (se necessário do lado do painel mais tarde) e feedback de ações com toasts/estados.

Dias 7–8
Backend

KPIs e logs:

Endpoints de relatório: GET /reports/kpis e GET /reminders (log de envios).

Ações na agenda via API: confirmar manualmente, marcar no-show, cancelar.

Exportação CSV: GET /reports/export.csv com filtros (período, profissional, serviço).

Frontend

Painel interno:

Dashboard com KPIs (taxa de confirmação, no-show, reagendamentos).

Tela de Agenda (lista/semana) com filtros e ações rápidas (confirmar, reagendar, cancelar, no-show).

Tela de Lembretes com log de envios e status.

Exportar CSV a partir do painel (botão que chama o endpoint e baixa o arquivo).

Dias 9–10
Backend

Pix depósito:

Endpoint POST /payments/:appointmentId/deposit para criar intenção e retornar QR/payload.

Webhook do provedor Pix: POST /webhooks/pix para atualizar status (PENDING/PAID/EXPIRED) e refletir no Appointment.

Políticas:

Regras de cancelamento tardio, janelas de reagendamento e buffers configuráveis por clínica.

Frontend

Pagamento de depósito (se o serviço exigir):

Ajustes no widget e nas páginas públicas para exibir QR/status do depósito.

Tela de estado de pagamento (pendente/pago/expirado) e refresh de status.

Configurações (painel):

Parâmetros de política (janelas/buffers) e flag de depósito por serviço.

Dias 11–12
Backend

PDF de relatório mensal:

Endpoint GET /reports/export.pdf com layout simples (KPIs, tabelas resumidas).

Segurança e qualidade:

Rate limiting em rotas públicas, logs estruturados, auditoria mínima de ações.

Testes de serviços críticos (slots, agendamento, links, Pix webhook).

Frontend

UX e conteúdo:

Refinar copy das mensagens, estados vazios, mensagens de erro/sucesso.

Melhorias de acessibilidade (foco, contraste, tamanhos).

Botões de exportação (CSV/PDF) integrados e feedback de download.

Dias 13–14
Backend

Preparação para produção piloto:

Variáveis de ambiente, CORS restrito, saneamento de logs.

Scripts de migração e seed de produção mínimo.

Observabilidade básica (healthcheck e logs).

Coleta de métricas operacionais (simples) para medir o piloto.

Frontend

Implantação e ajustes finos:

Página comercial simples (landing) com formulário de contato.

Configuração de ambiente (URL da API de produção).

Ajustes de UX a partir do feedback da clínica piloto.

Pequenos fixes de layout e responsividade nas telas mais usadas (agenda e widget).
***

## Checklists rápidos

Implantação piloto

- Criar clínica, profissionais e serviços; validar durações e buffers.
- Configurar templates e janelas de envio.
- Habilitar Pix (chaves API de teste e produção).
- Colocar widget de agendamento no site (iframe ou componente).
- Treinar recepção (confirmar manualmente, marcar no‑show, usar reagendamento).

Medição de valor

- Métricas base por 2 semanas: no‑show, confirm rate, reagendamentos.
- Após implantação, comparar variação e coletar depoimento.

***

## Snippets úteis (exemplos curtos)

Geração de tokens curtos assinados (link mágico):

```ts
import jwt from "jsonwebtoken";
export function makeLinkToken(payload: { apptId: string; action: "confirm"|"reschedule"|"cancel" }, ttlSec=7*24*3600) {
  return jwt.sign(payload, process.env.LINK_SECRET!, { expiresIn: ttlSec });
}
```

Middleware de scoping por clínica:

```ts
function withClinicScope(handler) {
  return async (req, res, next) => {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(401).end();
    req.clinicId = clinicId;
    return handler(req, res, next);
  };
}
```

Cálculo de slots com buffers:

```ts
function generateSlots({ dayStart, dayEnd, durationMin, bufferMin }) {
  const slots = [];
  let t = dayStart;
  while (t.plus({ minutes: durationMin }).plus({ minutes: bufferMin }) <= dayEnd) {
    slots.push({ start: t.toISO(), end: t.plus({ minutes: durationMin }).toISO() });
    t = t.plus({ minutes: durationMin + bufferMin });
  }
  return slots;
}
```


***

## Próximos degraus (v1.1+)

- OAuth Google/Outlook e sincronização bidirecional de eventos.
- Canal WhatsApp oficial com template aprovado e tracking de respostas.
- Regras de prioridade de lembrete por histórico (otimização de horário).
- Sala de espera digital e check‑in via QR.
- Motor de reviews pós‑consulta (upsell fácil).

***

Se quiser, preparo:

- Estrutura inicial do projeto (pastas, libs, scripts npm).
- Schema Prisma completo e primeira migração.
- Lista de templates de mensagens (pt-BR) para aprovação.
- Documentação curta de implantação para a primeira clínica. Quer que eu gere a estrutura de pastas e os pacotes sugeridos?

