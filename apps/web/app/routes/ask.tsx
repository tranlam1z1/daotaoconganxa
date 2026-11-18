/**
 * Hỏi đáp: một ô hỏi, câu gợi ý, câu trả lời kèm thẻ căn cứ mở được (docs/PLAN.md GĐ1).
 * Gọi API bằng phiên của người đang hỏi; API trả 401 khi bắt buộc đăng nhập và 429 khi hết
 * lượt hỏi trong ngày (GĐ0 S2) — hai trường hợp này hiện thông báo, không rơi về trang lỗi.
 */
import { useRef } from "react";
import { Form, Link, redirect, useNavigation } from "react-router";
import { NutMicro } from "../components/giong-noi/NutMicro";
import { TheCanCu } from "../components/tra-cuu/TheCanCu";
import { Button, ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { KhungTrang } from "../components/ui/KhungTrang";
import { ask, LoiHoiDap } from "../lib/api";
import { layToken } from "../lib/auth.server";
import { formatDate, isIsoDate, todayIso } from "../lib/format";
import { urlTrang } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { AskResponse } from "../lib/types";
import type { Route } from "./+types/ask";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Hỏi trợ lý AI", { index: false });
}

type KetQua =
  | { loai: "tra-loi"; data: AskResponse }
  | { loai: "can-dang-nhap" }
  | { loai: "het-luot"; message: string }
  | { loai: "chua-cau-hinh"; message: string }
  | null;

export async function loader({ request }: Route.LoaderArgs) {
  const url = urlTrang(request);
  const q = (url.searchParams.get("q") ?? "").trim();
  const homNay = todayIso();
  const asOfRaw = url.searchParams.get("asOf");
  const asOf = isIsoDate(asOfRaw) ? asOfRaw : homNay;
  const tiep = encodeURIComponent(url.pathname + url.search);

  const token = layToken(request);
  // Chưa đăng nhập mà đã gửi câu hỏi: sang trang đăng nhập, xong quay lại đúng câu hỏi này.
  if (q && !token) throw redirect(`/dang-nhap?tiep=${tiep}`);

  let ketQua: KetQua = null;
  if (q) {
    try {
      ketQua = { loai: "tra-loi", data: await ask(q, asOf, token) };
    } catch (err) {
      if (!(err instanceof LoiHoiDap)) throw err;
      ketQua =
        err.status === 401
          ? { loai: "can-dang-nhap" }
          : err.status === 503
            ? { loai: "chua-cau-hinh", message: err.message }
            : { loai: "het-luot", message: err.message };
    }
  }
  return { q, asOf, homNay, tiep, ketQua, daDangNhap: Boolean(token) };
}

const GOI_Y = [
  "Tìm căn cứ về đánh giá, xếp loại công chức.",
  "Quy định về hợp đồng làm việc của viên chức nằm trong văn bản nào?",
  "Tìm văn bản hướng dẫn sinh hoạt chi bộ.",
];

export default function AskPage({ loaderData }: Route.ComponentProps) {
  const { q, asOf, homNay, tiep, ketQua, daDangNhap } = loaderData;
  const busy = useNavigation().state !== "idle";
  // Ô hỏi không điều khiển bằng state; nói câu hỏi (GĐ14) thì ghi thẳng vào ô, người dùng xem lại rồi gửi.
  const oHoi = useRef<HTMLTextAreaElement>(null);

  return (
    <KhungTrang className="wrap max-w-3xl py-8">
      <header className="tieu-de-trang tieu-de-trang-banner relative isolate flex min-w-0 items-center gap-3">
        <span
          className="relative grid size-12 shrink-0 place-items-center rounded-card bg-primary-soft text-primary"
          aria-hidden="true"
        >
          <Icon name="chat" kieu="net" className="size-6" />
        </span>
        <div className="min-w-0 flex-1 sm:max-w-[60%]">
          <h1 className="text-2xl font-bold leading-tight">Hỏi trợ lý AI</h1>
          <p className="mt-1 text-sm text-ink-2">
            Câu trả lời chỉ đưa ra khi tìm được điều, khoản làm căn cứ. Không đủ căn cứ thì hệ thống nói rõ.
          </p>
        </div>
      </header>

      {daDangNhap ? null : (
        <Notice className="mt-4">
          Cần đăng nhập để hỏi trợ lý AI: mỗi câu hỏi gọi mô hình AI có tính phí, nên hệ thống tính lượt hỏi
          theo tài khoản. Câu hỏi bạn nhập được giữ lại sau khi đăng nhập.
        </Notice>
      )}

      <Form method="get" className="mt-6">
        <label htmlFor="cau-hoi" className="mb-1.5 block text-sm font-medium text-ink-2">
          Câu hỏi của bạn
        </label>
        <textarea
          ref={oHoi}
          id="cau-hoi"
          name="q"
          rows={3}
          defaultValue={q}
          required
          maxLength={1000}
          placeholder="Ví dụ: Vượt đèn đỏ bằng xe máy bị phạt bao nhiêu?"
          className="w-full rounded-btn border border-line-strong bg-surface p-3 text-base leading-relaxed placeholder:text-ink-3 focus:border-primary focus:outline-none"
        />
        <NutMicro
          className="mt-2"
          nhan="Nói câu hỏi"
          onKetQua={(text) => {
            if (!oHoi.current) return;
            oHoi.current.value = text;
            oHoi.current.focus();
          }}
        />
        {asOf !== homNay ? <input type="hidden" name="asOf" value={asOf} /> : null}
        <Button type="submit" disabled={busy} className="mt-3 w-full sm:w-auto">
          {busy ? "Đang tìm căn cứ" : daDangNhap ? "Gửi câu hỏi" : "Đăng nhập để gửi câu hỏi"}
        </Button>
      </Form>

      {!q ? (
        <section aria-labelledby="goi-y" className="mt-8">
          <h2 id="goi-y" className="font-sans text-base font-semibold">
            Câu hỏi mẫu
          </h2>
          <ul className="mt-3 grid gap-2">
            {GOI_Y.map((g) => (
              <li key={g}>
                <Link
                  to={`/hoi-dap?q=${encodeURIComponent(g)}`}
                  className="flex min-h-11 items-center rounded-btn border border-line bg-surface px-4 py-2 text-sm dong-bam"
                >
                  {g}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div aria-live="polite" aria-busy={busy} className={busy ? "opacity-60" : undefined}>
        {ketQua?.loai === "can-dang-nhap" ? (
          <div className="mt-8">
            <EmptyState icon="user" title="Cần đăng nhập để hỏi trợ lý AI">
              <p>Mỗi câu hỏi gọi mô hình AI có tính phí, nên hệ thống tính lượt hỏi theo tài khoản.</p>
            </EmptyState>
            <ButtonLink to={`/dang-nhap?tiep=${tiep}`} className="mt-4">
              Đăng nhập
            </ButtonLink>
          </div>
        ) : null}

        {ketQua?.loai === "het-luot" ? (
          <Notice className="mt-8">
            {ketQua.message || "Tài khoản đã dùng hết lượt hỏi trong ngày."} Lượt hỏi được cấp lại từ 0 giờ
            ngày mai. Trong lúc này, bạn vẫn tra cứu văn bản được.
          </Notice>
        ) : null}

        {ketQua?.loai === "chua-cau-hinh" ? (
          <Notice className="mt-8">
            {ketQua.message || "Hỏi đáp AI chưa được cấu hình trên máy chủ này."}{" "}
            <Link to="/tim-kiem" className="underline">
              Tra cứu văn bản
            </Link>
          </Notice>
        ) : null}

        {ketQua?.loai === "tra-loi" ? <CauTraLoi data={ketQua.data} asOf={asOf} /> : null}
      </div>
    </KhungTrang>
  );
}

function CauTraLoi({ data, asOf }: { data: AskResponse; asOf: string }) {
  return (
    <section aria-labelledby="cau-tra-loi" className="mt-8">
      <h2 id="cau-tra-loi" className="font-sans text-base font-semibold">
        Câu trả lời, áp dụng tại ngày {formatDate(asOf)}
      </h2>

      {data.insufficientBasis ? (
        <Notice tone="danger" className="mt-3">
          Kho dữ liệu chưa có đủ căn cứ để trả lời nội dung này. Phần dưới chỉ nêu các quy định liên quan tìm
          được.
        </Notice>
      ) : null}

      {data.warnings.map((w) => (
        <Notice key={w} tone="danger" className="mt-3">
          {w}
        </Notice>
      ))}

      <div className="prose-legal mt-4 font-sans rounded-card border border-line bg-surface p-4">
        {data.answer
          .split(/\n{2,}/)
          .filter((doan) => doan.trim())
          .map((doan, i) => (
            // Đoạn văn không có định danh riêng; thứ tự cố định trong một câu trả lời.
            // biome-ignore lint/suspicious/noArrayIndexKey: danh sách tĩnh, không sắp xếp lại
            <p key={i}>{doan}</p>
          ))}
      </div>
      <p className="mt-2 text-sm text-ink-3">
        Câu trả lời do hệ thống tổng hợp, có tính tham khảo, không thay thế văn bản gốc và không phải ý kiến
        tư vấn pháp lý.
      </p>

      {data.citations.length ? (
        <>
          <h3 className="mt-8 font-sans text-base font-semibold">Căn cứ ({data.citations.length})</h3>
          <ul className="mt-3 grid gap-3">
            {data.citations.map((c) => (
              <TheCanCu key={c.urn || c.label} citation={c} />
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
