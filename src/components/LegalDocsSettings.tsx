"use client";

// Вкладка «Документы» проекта: реквизиты оператора, состав обработки персональных
// данных, публикация политики / оферты / согласия и галочка согласия в формах сайта.
//
// Данные уходят в /api/projects/[id]/legal (PUT), публикация — в .../legal/publish,
// тумблер галочки — в PATCH проекта (Project.consentEnabled). Списки целей и третьих
// лиц редактируются построчно в textarea: так проще конструктора чипов, а на сервер
// уходит массив строк.

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface LegalFormValues {
  operatorType: string;
  operatorName: string;
  inn: string;
  ogrn: string;
  address: string;
  email: string;
  phone: string;
  siteUrl: string;
  collectsName: boolean;
  collectsEmail: boolean;
  collectsPhone: boolean;
  collectsAddress: boolean;
  collectsPayment: boolean;
  collectsCookies: boolean;
  purposes: string; // по строке на цель
  thirdParties: string; // по строке на получателя
  usesMetrika: boolean;
  usesGa: boolean;
  usesMailing: boolean;
  rknNotifiedAt: string; // YYYY-MM-DD либо пусто
  consentMode: string;
  consentText: string;
}

export interface LegalDocLink {
  type: string;
  title: string;
  version: number | null;
  url: string;
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand dark:border-slate-700";
const cardCls =
  "mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900";
const labelCls = "block text-xs font-medium text-slate-500";

/** Пустая строка → null: у необязательных полей сервер ждёт именно null, а не "". */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Построчный список из textarea: без пустых строк, не длиннее 15 позиций. */
function lines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 15);
}

function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-brand"
      />
      <span>{children}</span>
    </label>
  );
}

export function LegalDocsSettings({
  projectId,
  domain,
  saved,
  initial,
  docs,
  consentEnabled: initialConsent,
}: {
  projectId: string;
  domain: string;
  saved: boolean; // реквизиты уже сохранялись (есть запись ProjectLegal)
  initial: LegalFormValues;
  docs: LegalDocLink[];
  consentEnabled: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<LegalFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [consent, setConsent] = useState(initialConsent);
  const [consentError, setConsentError] = useState<string | null>(null);

  function set<K extends keyof LegalFormValues>(key: K, value: LegalFormValues[K]) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  const published = docs.some((d) => d.version !== null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/legal`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operatorType: v.operatorType,
        operatorName: v.operatorName,
        inn: orNull(v.inn),
        ogrn: orNull(v.ogrn),
        address: orNull(v.address),
        email: v.email.trim(),
        phone: orNull(v.phone),
        siteUrl: orNull(v.siteUrl),
        collectsName: v.collectsName,
        collectsEmail: v.collectsEmail,
        collectsPhone: v.collectsPhone,
        collectsAddress: v.collectsAddress,
        collectsPayment: v.collectsPayment,
        collectsCookies: v.collectsCookies,
        purposes: lines(v.purposes),
        thirdParties: lines(v.thirdParties),
        usesMetrika: v.usesMetrika,
        usesGa: v.usesGa,
        usesMailing: v.usesMailing,
        // В базе дата со временем, в форме — только день: досылаем полночь UTC.
        rknNotifiedAt: v.rknNotifiedAt
          ? new Date(`${v.rknNotifiedAt}T00:00:00.000Z`).toISOString()
          : null,
        consentMode: v.consentMode,
        consentText: orNull(v.consentText),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Не удалось сохранить");
      return;
    }
    setNotice(
      published
        ? "Реквизиты сохранены. Чтобы правки попали в документы, опубликуйте новую версию."
        : "Реквизиты сохранены. Теперь опубликуйте документы.",
    );
    router.refresh();
  }

  async function publish() {
    setError(null);
    setNotice(null);
    setPublishing(true);
    const res = await fetch(`/api/projects/${projectId}/legal/publish`, { method: "POST" });
    setPublishing(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Не удалось опубликовать документы");
      return;
    }
    setNotice("Документы опубликованы — ссылки ведут на актуальную версию.");
    router.refresh();
  }

  async function toggleConsent(next: boolean) {
    setConsentError(null);
    setConsent(next); // оптимистично
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ consentEnabled: next }),
    });
    if (!res.ok) {
      setConsent(!next); // откат
      const data = await res.json().catch(() => ({}));
      setConsentError(data.error || "Не удалось сохранить");
      return;
    }
    router.refresh();
  }

  return (
    <>
      {/* ---- Галочка согласия в формах сайта ---- */}
      <div className={cardCls}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Галочка согласия в формах сайта</h2>
            <p className="mt-1 text-sm text-slate-500">
              Скрипт Logsy встроит в формы {domain} чекбокс со ссылками на политику и
              текст согласия, а сам факт согласия запишет в журнал — это и есть
              доказательство по ч. 1 ст. 9 152-ФЗ. Нужен подключённый на сайте тег SDK.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={consent}
            onClick={() => toggleConsent(!consent)}
            className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              consent ? "bg-brand" : "bg-slate-300 dark:bg-slate-600"
            }`}
            title={consent ? "Выключить галочку" : "Включить галочку"}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                consent ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        {consentError && <p className="mt-3 text-sm text-red-600">{consentError}</p>}
        {consent && !published && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Галочка включена, но документы ещё не опубликованы — на сайте она не
            появится: ссылка рядом с ней вела бы в пустоту. Заполните реквизиты и
            нажмите «Опубликовать документы».
          </p>
        )}
      </div>

      {/* ---- Документы ---- */}
      <div className={cardCls}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Документы</h2>
            <p className="mt-1 text-sm text-slate-500">
              Политика, оферта и текст согласия собираются из реквизитов ниже. При
              публикации сохраняется снимок текста: в журнале согласий записан номер
              версии, поэтому через год видно, с какой редакцией соглашался посетитель.
            </p>
          </div>
          <button
            type="button"
            onClick={publish}
            disabled={!saved || publishing}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            title={saved ? undefined : "Сначала сохраните реквизиты оператора"}
          >
            {publishing
              ? "Публикуем…"
              : published
                ? "Опубликовать новую версию"
                : "Опубликовать документы"}
          </button>
        </div>

        <div className="mt-4 grid gap-2">
          {docs.map((d) => (
            <div
              key={d.type}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
            >
              <span className="min-w-0">{d.title}</span>
              {d.version ? (
                <span className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">Версия {d.version}</span>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand hover:underline"
                  >
                    Открыть
                  </a>
                </span>
              ) : (
                <span className="text-xs text-slate-400">не опубликован</span>
              )}
            </div>
          ))}
          {docs.length === 0 && (
            <p className="text-sm text-slate-500">
              Заполните реквизиты оператора и сохраните — после этого документы можно
              будет опубликовать.
            </p>
          )}
        </div>
      </div>

      {/* ---- Реквизиты и состав обработки ---- */}
      <form onSubmit={save}>
        <div className={cardCls}>
          <h2 className="font-semibold">Реквизиты оператора</h2>
          <p className="mt-1 text-sm text-slate-500">
            Подставляются в документы как данные оператора персональных данных.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Кто оператор</label>
              <select
                value={v.operatorType}
                onChange={(e) => set("operatorType", e.target.value)}
                className={`${inputCls} mt-1`}
              >
                <option value="COMPANY">Юридическое лицо</option>
                <option value="IP">Индивидуальный предприниматель</option>
                <option value="PERSON">Физлицо / самозанятый</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Наименование</label>
              <input
                required
                value={v.operatorName}
                onChange={(e) => set("operatorName", e.target.value)}
                placeholder="ООО «Ромашка» / ИП Иванов Иван Иванович"
                className={`${inputCls} mt-1`}
              />
            </div>
            <div>
              <label className={labelCls}>ИНН</label>
              <input
                value={v.inn}
                onChange={(e) => set("inn", e.target.value)}
                placeholder="10 цифр у организации, 12 у ИП"
                className={`${inputCls} mt-1`}
              />
            </div>
            <div>
              <label className={labelCls}>ОГРН / ОГРНИП</label>
              <input
                value={v.ogrn}
                onChange={(e) => set("ogrn", e.target.value)}
                placeholder="13 цифр, ОГРНИП — 15"
                className={`${inputCls} mt-1`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Адрес</label>
              <input
                value={v.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Юридический или почтовый адрес"
                className={`${inputCls} mt-1`}
              />
            </div>
            <div>
              <label className={labelCls}>Почта для обращений</label>
              <input
                required
                type="email"
                value={v.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="privacy@example.ru"
                className={`${inputCls} mt-1`}
              />
              <p className="mt-1 text-xs text-slate-400">
                На неё субъекты ПД шлют запросы и отзыв согласия — адрес попадёт в
                документы.
              </p>
            </div>
            <div>
              <label className={labelCls}>Телефон</label>
              <input
                value={v.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+7 900 000-00-00"
                className={`${inputCls} mt-1`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Адрес сайта</label>
              <input
                value={v.siteUrl}
                onChange={(e) => set("siteUrl", e.target.value)}
                placeholder={`https://${domain}`}
                className={`${inputCls} mt-1`}
              />
            </div>
          </div>
        </div>

        <div className={cardCls}>
          <h2 className="font-semibold">Что собирает сайт</h2>
          <p className="mt-1 text-sm text-slate-500">
            От состава зависят разделы политики и перечень данных в тексте согласия.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Check checked={v.collectsName} onChange={(x) => set("collectsName", x)}>
              Имя (ФИО)
            </Check>
            <Check checked={v.collectsEmail} onChange={(x) => set("collectsEmail", x)}>
              Электронная почта
            </Check>
            <Check checked={v.collectsPhone} onChange={(x) => set("collectsPhone", x)}>
              Телефон
            </Check>
            <Check checked={v.collectsAddress} onChange={(x) => set("collectsAddress", x)}>
              Адрес доставки
            </Check>
            <Check checked={v.collectsPayment} onChange={(x) => set("collectsPayment", x)}>
              Сведения о заказе и оплате
            </Check>
            <Check checked={v.collectsCookies} onChange={(x) => set("collectsCookies", x)}>
              Cookie, IP, данные браузера
            </Check>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Цели обработки — по одной в строке</label>
              <textarea
                rows={4}
                value={v.purposes}
                onChange={(e) => set("purposes", e.target.value)}
                placeholder={"обработка заявок с сайта\nоформление и доставка заказа"}
                className={`${inputCls} mt-1`}
              />
              <p className="mt-1 text-xs text-slate-400">
                Если оставить пусто, в документы попадут типовые цели.
              </p>
            </div>
            <div>
              <label className={labelCls}>Кому передаются данные — по одному в строке</label>
              <textarea
                rows={4}
                value={v.thirdParties}
                onChange={(e) => set("thirdParties", e.target.value)}
                placeholder={"хостинг-провайдер сайта\nслужба доставки СДЭК\nCRM Битрикс24"}
                className={`${inputCls} mt-1`}
              />
              <p className="mt-1 text-xs text-slate-400">
                Попадут в раздел политики о передаче данных.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Check checked={v.usesMetrika} onChange={(x) => set("usesMetrika", x)}>
              Яндекс.Метрика
            </Check>
            <Check checked={v.usesGa} onChange={(x) => set("usesGa", x)}>
              Google Analytics и другие зарубежные счётчики
              <span className="block text-xs text-slate-400">
                Это трансграничная передача — в политику добавится раздел по ст. 12 152-ФЗ.
              </span>
            </Check>
            <Check checked={v.usesMailing} onChange={(x) => set("usesMailing", x)}>
              Рекламная рассылка
              <span className="block text-xs text-slate-400">
                Согласие на рекламу отделяется от основного (ч. 1 ст. 18 ФЗ «О рекламе»):
                в форме появится вторая галочка.
              </span>
            </Check>
            <div>
              <label className={labelCls}>Уведомление в Роскомнадзор подано</label>
              <input
                type="date"
                value={v.rknNotifiedAt}
                onChange={(e) => set("rknNotifiedAt", e.target.value)}
                className={`${inputCls} mt-1`}
              />
              <p className="mt-1 text-xs text-slate-400">
                Подаёте вы на портале РКН (ч. 1 ст. 22 152-ФЗ) — здесь только отметка,
                чтобы панель не напоминала.
              </p>
            </div>
          </div>
        </div>

        <div className={cardCls}>
          <h2 className="font-semibold">Поведение галочки</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Режим</label>
              <select
                value={v.consentMode}
                onChange={(e) => set("consentMode", e.target.value)}
                className={`${inputCls} mt-1`}
              >
                <option value="STRICT">Строгий — без галочки форма не отправляется</option>
                <option value="SOFT">Мягкий — согласие фиксируется, отправку не блокируем</option>
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Строгий режим — то, что требует закон; мягкий удобен, пока проверяете, как
                галочка встала в формы.
              </p>
            </div>
            <div>
              <label className={labelCls}>Свой текст рядом с галочкой</label>
              <input
                value={v.consentText}
                onChange={(e) => set("consentText", e.target.value)}
                placeholder="Пусто — текст из шаблона"
                className={`${inputCls} mt-1`}
              />
              <p className="mt-1 text-xs text-slate-400">
                Ссылки на политику и согласие подставляются к тексту автоматически.
              </p>
            </div>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {notice && <p className="mb-3 text-sm text-green-600">{notice}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Сохраняем…" : "Сохранить реквизиты"}
        </button>
      </form>
    </>
  );
}
