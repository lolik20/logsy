// Переписка с пользователем в рамках задачи.
//
// GET  — вернуть переписку задачи (сообщения TaskMessage в хронологическом порядке).
// POST { body } — отправить ответ пользователю письмом на почту обращения
//        (Task.reporterEmail) и сохранить его в переписке как OUTGOING.
//
// Доступ — только владельцу проекта задачи (или администратору). Отвечать можно лишь
// по задачам, у которых есть почта отправителя (обычно это задачи из обратной формы).

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

type Denied = { error: string; status: number };

async function accessError(projectUserId: string): Promise<Denied | null> {
  const userId = await getUserId();
  if (!userId) return { error: "Не авторизован", status: 401 };
  const admin = await isAdmin();
  if (projectUserId !== userId && !admin) return { error: "Нет доступа", status: 403 };
  return null;
}

/** Задача с данными проекта/владельца, нужными для проверки доступа и отправки письма. */
async function loadTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      reporterEmail: true,
      project: {
        select: { name: true, domain: true, userId: true, user: { select: { email: true } } },
      },
    },
  });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const task = await loadTask(params.id);
  if (!task) return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });

  const denied = await accessError(task.project.userId);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const messages = await prisma.taskMessage.findMany({
    where: { taskId: task.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Введите текст сообщения" }, { status: 400 });
  }

  const task = await loadTask(params.id);
  if (!task) return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });

  const denied = await accessError(task.project.userId);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const to = task.reporterEmail?.trim();
  if (!to) {
    return NextResponse.json(
      { error: "У задачи нет почты пользователя для ответа" },
      { status: 400 },
    );
  }

  const body = parsed.data.body;
  // Ответ уходит с технического SMTP_FROM, но Reply-To ставим на почту владельца
  // проекта — так прямой ответ пользователя придёт ему на почту.
  const ownerEmail = task.project.user.email;
  const subject = `Ответ по вашему обращению · ${task.project.name}`;
  const text =
    `${body}\n\n` +
    `— поддержка проекта ${task.project.name} (${task.project.domain})`;

  try {
    await sendMail({ to, subject, text, replyTo: ownerEmail || undefined });
  } catch (err) {
    console.error("[Logsy] Не удалось отправить письмо пользователю по задаче:", err);
    return NextResponse.json({ error: "Не удалось отправить письмо" }, { status: 502 });
  }

  const message = await prisma.taskMessage.create({
    data: {
      taskId: task.id,
      direction: "OUTGOING",
      body,
      fromEmail: ownerEmail || null,
      toEmail: to,
    },
  });

  return NextResponse.json({ message });
}
