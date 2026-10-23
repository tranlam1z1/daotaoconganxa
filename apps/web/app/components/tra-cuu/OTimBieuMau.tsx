/**
 * Khung tìm của trang Quy trình, Biểu mẫu: ô từ khóa (kính lúp bên trái, micro bên phải), ô chọn loại
 * tài liệu, liên kết "Tra cứu nâng cao" mở thêm hai ô lọc phương tiện và loại vi phạm, và nút "Tra cứu
 * biểu mẫu" rộng hết khung như ở trang Tra cứu văn bản (OTimVanBan).
 * Mọi ô cùng một cỡ: rộng hết khung, cao bằng ô từ khóa.
 * Thu gọn phần nâng cao là bỏ hai bộ lọc đó ở lần tra kế tiếp.
 */
import { type ReactNode, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";

import { cn } from "../../lib/cn";
import { LOAI_TAI_LIEU } from "../../lib/tai-lieu";
import { CHU_DE_MUC_PHAT, LOAI_XE } from "../../lib/tra-cuu-nhanh";
import { useNhanDangGiong } from "../giong-noi/useNhanDangGiong";
import { Icon } from "../ui/Icon";

const DUONG_DAN = "/tra-cuu-nhanh/quy-trinh";
/** Khung chung của ô từ khóa và các ô chọn, để mọi ô cao và rộng như nhau. */
const KHUNG_O =
  "h-14 w-full rounded-2xl border border-line-strong bg-surface text-base text-ink focus:border-primary focus:outline-none";

/**
 * Ô chọn cùng cỡ với ô từ khóa. Bỏ kiểu vẽ mặc định của trình duyệt (appearance-none): Safari trên
 * iPhone vẽ ô chọn gốc thấp hơn và không theo chiều cao đặt sẵn; mũi tên tự vẽ ở mép phải.
 */
function OChon({
  id,
  name,
  nhan,
  giaTri,
  children,
}: {
  id: string;
  name: string;
  /** Nhãn cho trình đọc màn hình. */
  nhan: string;
  giaTri: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {nhan}
      </label>
      <div className="relative">
        <select
          id={id}
          name={name}
          defaultValue={giaTri}
          className={cn(KHUNG_O, "appearance-none pr-11 pl-4 text-ellipsis")}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-3">
          <Icon name="chevronDown" sac="trung" className="size-5" />
        </span>
      </div>
    </div>
  );
}

export function OTimBieuMau({ q, loai, xe, nhom }: { q: string; loai: string; xe: string; nhom: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const g = useNhanDangGiong((text) => {
    if (!inputRef.current) return;
    inputRef.current.value = text;
    inputRef.current.focus();
  });
  const nav = useNavigation();
  const dangTra = nav.state !== "idle" && nav.location?.pathname === DUONG_DAN;
  const [nangCao, setNangCao] = useState(Boolean(xe || nhom));

  return (
    <div className="tra-cuu-form">
      {/* Đổi khóa theo bộ lọc trên URL để các ô lấy lại giá trị khi bấm "Xem tất cả" hoặc lùi trang. */}
      <Form
        method="get"
        action={DUONG_DAN}
        role="search"
        className="mt-3 grid gap-3"
        key={`${q}|${loai}|${xe}|${nhom}`}
      >
        <div>
          <label htmlFor="o-tim-bieu-mau" className="sr-only">
            Từ khóa tên quy trình, biểu mẫu
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-3">
              <Icon name="search" sac="trung" className="size-6" />
            </span>
            <input
              ref={inputRef}
              id="o-tim-bieu-mau"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Nhập từ khóa"
              autoComplete="off"
              enterKeyHint="search"
              className={cn(
                KHUNG_O,
                "pl-11 text-ellipsis placeholder:text-ink-3",
                g.hoTro ? "pr-12" : "pr-3",
              )}
            />
            {g.hoTro ? (
              <button
                type="button"
                aria-pressed={g.dangNghe}
                aria-label={g.dangNghe ? "Đang nghe, bấm để dừng" : "Tìm bằng giọng nói"}
                onClick={g.dangNghe ? g.dung : g.batDau}
                className={cn(
                  "lun absolute inset-y-1.5 right-1 grid w-11 place-items-center rounded-xl",
                  g.dangNghe
                    ? "bg-danger-soft text-danger motion-safe:animate-pulse"
                    : "text-ink-2 hover:bg-surface-2",
                )}
              >
                <Icon name="mic" sac="trung" className="size-6" />
              </button>
            ) : null}
          </div>
          {g.loi || g.tamThoi ? (
            <p aria-live="polite" className="mt-1 text-sm text-ink-2">
              {g.loi ? <span className="text-danger">{g.loi}</span> : `Đang nghe: ${g.tamThoi}`}
            </p>
          ) : null}
        </div>

        <OChon id="bm-loai" name="loai" nhan="Loại tài liệu" giaTri={loai}>
          <option value="">Tất cả loại tài liệu</option>
          {LOAI_TAI_LIEU.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </OChon>

        {nangCao ? (
          <div id="bm-nang-cao" className="grid gap-3">
            <OChon id="bm-xe" name="xe" nhan="Phương tiện" giaTri={xe}>
              <option value="">Mọi phương tiện</option>
              {LOAI_XE.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </OChon>
            <OChon id="bm-nhom" name="nhom" nhan="Loại vi phạm" giaTri={nhom}>
              <option value="">Mọi loại vi phạm</option>
              {CHU_DE_MUC_PHAT.map((c) => (
                <option key={c.ma} value={c.ma}>
                  {c.ten}
                </option>
              ))}
            </OChon>
          </div>
        ) : null}

        <p className="text-center">
          <button
            type="button"
            aria-expanded={nangCao}
            aria-controls="bm-nang-cao"
            onClick={() => setNangCao((v) => !v)}
            className="inline-flex min-h-11 items-center px-2 text-base font-medium text-primary underline"
          >
            {nangCao ? "Thu gọn tra cứu nâng cao" : "Tra cứu nâng cao"}
          </button>
        </p>

        <button
          type="submit"
          disabled={dangTra}
          className="lun mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-base font-semibold text-on-primary shadow-card hover:bg-primary-hover disabled:opacity-70"
        >
          <Icon name="search" kieu="net" className="size-5" />
          {dangTra ? "Đang tra…" : "Tra cứu biểu mẫu"}
        </button>
      </Form>
    </div>
  );
}
