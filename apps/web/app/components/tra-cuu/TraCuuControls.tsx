import { useEffect, useRef, useState } from "react";
import { Link, useNavigation, useRevalidator, useSearchParams, useSubmit } from "react-router";

/** Existing GET forms remain usable without JavaScript. */
export function useTraCuuDebounce() {
  const submit = useSubmit();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (form: HTMLFormElement) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void submit(form, { replace: true });
    }, 400);
  };
}

export function TraCuuControls({
  q,
  kind,
  page,
  total,
}: {
  q: string;
  kind: "signs" | "violations";
  page: number;
  total: number;
}) {
  const [history, setHistory] = useState<string[]>([]);
  const [params] = useSearchParams();
  const busy = useNavigation().state !== "idle";
  useEffect(() => {
    const key = `traffic-history-${kind}`;
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
      const old = Array.isArray(raw)
        ? raw.filter((x): x is string => typeof x === "string" && x.length <= 200)
        : [];
      const next = (q ? [q, ...old.filter((x) => x !== q)] : old).slice(0, 10);
      localStorage.setItem(key, JSON.stringify(next));
      setHistory(next);
    } catch {
      /* Private browsing may disable storage. */
    }
  }, [q, kind]);
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) p.set(k, v);
    p.delete("ma");
    return `?${p}`;
  };
  return (
    <div className="mt-4 text-sm text-ink-2" aria-busy={busy}>
      <p role="status" aria-live="polite">
        {busy ? "Đang tra cứu…" : `${total.toLocaleString("vi-VN")} kết quả`}
      </p>
      {history.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span>Đã tra trên thiết bị:</span>
          {history.map((s) => (
            <Link
              key={s}
              to={href({ q: s, page: "1" })}
              className="rounded-full border border-line px-3 py-2"
            >
              {s}
            </Link>
          ))}
          <button
            type="button"
            className="underline"
            onClick={() => {
              try {
                localStorage.removeItem(`traffic-history-${kind}`);
              } catch {}
              setHistory([]);
            }}
          >
            Xóa lịch sử
          </button>
        </div>
      ) : null}
      {total > 24 ? (
        <nav aria-label="Phân trang" className="mt-3 flex flex-wrap items-center gap-3">
          {page > 1 ? (
            <Link
              className="inline-flex min-h-11 items-center rounded-btn border border-line-strong px-3 text-secondary hover:bg-secondary-soft"
              to={href({ page: String(page - 1) })}
            >
              Trang trước
            </Link>
          ) : null}
          <span>
            Trang {page} / {Math.ceil(total / 24)}
          </span>
          {page * 24 < total ? (
            <Link
              className="inline-flex min-h-11 items-center rounded-btn border border-line-strong px-3 text-secondary hover:bg-secondary-soft"
              to={href({ page: String(page + 1) })}
            >
              Trang sau
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
export function TraCuuError() {
  const revalidator = useRevalidator();
  return (
    <section role="alert" className="mx-auto max-w-3xl rounded-card border border-line bg-surface p-6">
      <h1 className="text-xl font-semibold">Chưa tải được dữ liệu tra cứu</h1>
      <p className="mt-2">Vui lòng kiểm tra kết nối và thử lại.</p>
      <button
        type="button"
        className="mt-3 min-h-11 text-primary underline"
        onClick={() => {
          void revalidator.revalidate();
        }}
        disabled={revalidator.state === "loading"}
      >
        Thử lại
      </button>
    </section>
  );
}
