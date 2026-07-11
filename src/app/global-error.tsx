"use client";

// Глобальный error boundary — ловит ошибки в корневом layout. Обязан
// содержать <html> и <body>, т.к. заменяет корневую разметку.
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Logsy] Глобальная ошибка:", error);
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          background: "#0f172a",
          color: "#e2e8f0",
        }}
      >
        <div style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Что-то пошло не так</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#94a3b8" }}>
            Произошла ошибка приложения.
          </p>
          {error.digest && (
            <p style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
              Код: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Повторить
          </button>
        </div>
      </body>
    </html>
  );
}
