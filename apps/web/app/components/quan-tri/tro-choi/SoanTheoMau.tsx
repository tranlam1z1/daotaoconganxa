/**
 * Trình soạn theo mẫu, cho các trò chưa có trình soạn riêng. Người soạn không gõ JSON: nội dung bắt
 * đầu từ một nội dung đã có của cùng trò, mỗi trường thành một ô nhập (chữ, số, ngày, ô đánh dấu, danh
 * sách thêm bớt được), ô mức phạt là ô chọn. Kiểu của ô đang trống và các giá trị gợi ý suy từ nội dung
 * đã có (lib/soan-theo-mau.ts).
 *
 * Dữ liệu liên quan (tham chiếu) chọn từ danh sách thay cho gõ `loai:ma`; mức phạt đã chọn trong bài
 * được ghi tự động. Kết quả ghi vào các ô ẩn `payload`, `answer`, `refs` như các trình soạn riêng.
 * "Sửa dạng mã" giữ lại hai ô JSON cho bộ phận kỹ thuật (thêm trường mới, trò chưa có nội dung mẫu).
 *
 * shortcut: không chạy bộ kiểm riêng của từng trò, nên giá trị sai (ví dụ loại xe không có) vẫn lưu
 * được và nội dung không vào lượt; trò nào soạn nhiều thì viết trình soạn riêng như SoanKichBanXe.
 */
import { useState } from "react";

import { cn } from "../../../lib/cn";
import { type GoiYTruong, LA_NGAY, nhanTruong } from "../../../lib/soan-theo-mau";
import { Button } from "../../ui/Button";
import { inputClass, Notice } from "../../ui/Field";
import type { MucPhatSoan } from "./SoanKichBanXe";

type GiaTri = null | boolean | number | string | GiaTri[] | { [k: string]: GiaTri };

export interface ThamChieuSoan {
  loai: string;
  ma: string;
}

interface NguCanh {
  goiY: Record<string, GoiYTruong>;
  mucPhat: readonly MucPhatSoan[];
}

/** Trường chứa mã mức phạt: soạn bằng ô chọn và tự ghi vào dữ liệu liên quan. */
const KHOA_MUC_PHAT = new Set(["ma_muc_phat", "vi_pham"]);

export const TEN_LOAI: Record<string, string> = {
  violation: "Mức phạt",
  traffic_sign: "Biển báo",
  procedure: "Quy trình",
  question: "Câu hỏi",
  speed_limit: "Tốc độ tối đa",
};
/** Loại thêm được ở đây; tốc độ tối đa chưa duyệt được qua tham chiếu nên không cho thêm mới. */
const LOAI_THEM = ["violation", "traffic_sign", "procedure", "question"] as const;

const o = (cls?: string) => cn(inputClass, "min-h-11", cls);
const laDoiTuong = (v: unknown): v is Record<string, GiaTri> =>
  !!v && typeof v === "object" && !Array.isArray(v);

function docThu(s: string): Record<string, GiaTri> {
  try {
    const v = JSON.parse(s);
    return laDoiTuong(v) ? v : {};
  } catch {
    return {};
  }
}

function maMucPhatTrong(v: GiaTri, khoa = ""): string[] {
  if (Array.isArray(v)) return v.flatMap((x) => maMucPhatTrong(x, khoa));
  if (laDoiTuong(v)) return Object.entries(v).flatMap(([k, x]) => maMucPhatTrong(x, k));
  return typeof v === "string" && v && KHOA_MUC_PHAT.has(khoa) ? [v] : [];
}

function Truong({
  khoa,
  nhan,
  v,
  dat,
  cx,
}: {
  khoa: string;
  nhan: string;
  v: GiaTri;
  dat: (v: GiaTri) => void;
  cx: NguCanh;
}) {
  const g = cx.goiY[khoa];

  if (Array.isArray(v)) {
    return (
      <fieldset className="grid gap-2 rounded-lg border border-line p-3 sm:col-span-2">
        <legend className="px-1 text-sm font-semibold">
          {nhan} ({v.length})
        </legend>
        {v.map((x, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: dòng chỉ định danh theo thứ tự.
          <div key={i} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Truong
                khoa={khoa}
                nhan={`${nhan} ${i + 1}`}
                v={x}
                dat={(m) => dat(v.map((y, j) => (j === i ? m : y)))}
                cx={cx}
              />
            </div>
            <Button variant="secondary" onClick={() => dat(v.filter((_, j) => j !== i))}>
              Xóa
            </Button>
          </div>
        ))}
        <div>
          {/* Dòng mới chép từ dòng cuối để giữ đúng các trường; danh sách trống thì thêm một ô chữ. */}
          <Button variant="secondary" onClick={() => dat([...v, structuredClone(v.at(-1) ?? "")])}>
            Thêm dòng
          </Button>
        </div>
      </fieldset>
    );
  }

  if (laDoiTuong(v)) {
    const con = Object.entries(v).map(([k, x]) => (
      <Truong key={k} khoa={k} nhan={nhanTruong(k)} v={x} dat={(m) => dat({ ...v, [k]: m })} cx={cx} />
    ));
    if (!nhan) return <div className="grid gap-3 sm:grid-cols-2">{con}</div>;
    return (
      <fieldset className="grid gap-3 rounded-lg border border-line p-3 sm:col-span-2 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">{nhan}</legend>
        {con}
      </fieldset>
    );
  }

  if (typeof v === "boolean") {
    return (
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="size-5" checked={v} onChange={(e) => dat(e.target.checked)} />
        {nhan}
      </label>
    );
  }

  // Ô đang trống lấy kiểu từ nội dung đã có của cùng trò.
  const kieu = typeof v === "number" ? "so" : v ? (LA_NGAY.test(v) ? "ngay" : "chu") : (g?.kieu ?? "chu");
  if (kieu === "khac") {
    return (
      <p className="text-sm text-ink-2 sm:col-span-2">
        {nhan}: nội dung mẫu này không có. Cần phần này thì soạn dựa trên một nội dung khác đã có sẵn.
      </p>
    );
  }
  const trong: GiaTri = v === null || g?.coRong ? null : kieu === "so" ? 0 : "";
  const doi = (s: string) => dat(s === "" ? trong : kieu === "so" ? Number(s) : s);

  let oNhap: React.ReactNode;
  if (kieu === "chu" && KHOA_MUC_PHAT.has(khoa)) {
    const co = cx.mucPhat.some((m) => m.ma === v);
    oNhap = (
      <select className={o()} value={v ?? ""} onChange={(e) => doi(e.target.value)}>
        <option value="">Chưa chọn</option>
        {v && !co ? <option value={v}>{v} (không có trong bảng mức phạt)</option> : null}
        {cx.mucPhat.map((m) => (
          <option key={m.ma} value={m.ma}>
            {m.ten.slice(0, 70) || m.ma}
            {m.da_duyet ? "" : " (chưa duyệt)"}
          </option>
        ))}
      </select>
    );
  } else if (kieu === "chu" && g?.dai) {
    oNhap = (
      <textarea
        rows={3}
        className={cn(inputClass, "py-2")}
        value={v ?? ""}
        onChange={(e) => doi(e.target.value)}
      />
    );
  } else {
    oNhap = (
      <input
        type={kieu === "so" ? "number" : kieu === "ngay" ? "date" : "text"}
        inputMode={kieu === "so" ? "decimal" : undefined}
        step={kieu === "so" ? "any" : undefined}
        list={kieu === "chu" && g?.giaTri.length ? `goi-y-${khoa}` : undefined}
        placeholder={trong === null ? "Để trống nếu không có" : undefined}
        className={o()}
        value={v ?? ""}
        onChange={(e) => doi(e.target.value)}
      />
    );
  }
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: ô nhập nằm trong nhãn, qua biến oNhap
    <label className={cn("grid content-start gap-1 text-sm", g?.dai && "sm:col-span-2")}>
      {nhan}
      {oNhap}
    </label>
  );
}

export function SoanTheoMau({
  payload,
  answer,
  refs: refsDau,
  goiY,
  nguon,
  khoa,
}: {
  payload: unknown;
  answer: unknown;
  refs: readonly ThamChieuSoan[];
  goiY: Record<string, GoiYTruong>;
  /** Danh sách chọn cho từng loại dữ liệu liên quan: violation, traffic_sign, procedure. */
  nguon: Record<string, readonly MucPhatSoan[]>;
  khoa: boolean;
}) {
  const [p, datP] = useState<Record<string, GiaTri>>(() => (laDoiTuong(payload) ? payload : {}));
  const [a, datA] = useState<Record<string, GiaTri>>(() => (laDoiTuong(answer) ? answer : {}));
  // Mức phạt đang dùng trong bài thì không giữ ở danh sách tự thêm: đổi mức phạt trong bài là đổi theo.
  const [refs, datRefs] = useState<ThamChieuSoan[]>(() => {
    const trongBai = new Set([...maMucPhatTrong(p), ...maMucPhatTrong(a)]);
    return refsDau
      .filter((r) => r.loai !== "violation" || !trongBai.has(r.ma))
      .map((r) => ({ loai: r.loai, ma: r.ma }));
  });
  const chuaCoMau = !Object.keys(p).length && !Object.keys(a).length;
  // Dạng mã: hai ô JSON. Trò chưa có nội dung mẫu thì chỉ soạn được bằng dạng này.
  const [ma, datMa] = useState<{ p: string; a: string; loi?: string } | null>(() =>
    chuaCoMau ? { p: "{}", a: "{}" } : null,
  );
  const [them, datThem] = useState<ThamChieuSoan>({ loai: "violation", ma: "" });

  const cx: NguCanh = { goiY, mucPhat: nguon.violation ?? [] };
  const co = (r: ThamChieuSoan) => refs.some((x) => x.loai === r.loai && x.ma === r.ma);
  // Đang sửa dạng mã thì đọc mức phạt từ mã đang gõ; mã chưa đúng cú pháp thì máy chủ từ chối lúc lưu.
  const [bp, ba] = ma ? [docThu(ma.p), docThu(ma.a)] : [p, a];
  const tuDong = [...new Set([...maMucPhatTrong(bp), ...maMucPhatTrong(ba)])]
    .map((m) => ({ loai: "violation", ma: m }))
    .filter((r) => !co(r));
  const tenMuc = (r: ThamChieuSoan) => nguon[r.loai]?.find((m) => m.ma === r.ma);

  const veBieuMau = () => {
    if (!ma) return;
    try {
      const [np, na] = [JSON.parse(ma.p || "{}"), JSON.parse(ma.a || "{}")];
      if (!laDoiTuong(np) || !laDoiTuong(na)) throw new Error();
      datP(np);
      datA(na);
      datMa(null);
    } catch {
      datMa({ ...ma, loi: "Mã chưa đúng cú pháp. Kiểm tra dấu ngoặc và dấu phẩy." });
    }
  };

  return (
    <section className="grid gap-4 rounded-xl border border-line bg-surface p-4" aria-label="Nội dung">
      <input type="hidden" name="payload" value={ma ? ma.p : JSON.stringify(p)} />
      <input type="hidden" name="answer" value={ma ? ma.a : JSON.stringify(a)} />
      <input
        type="hidden"
        name="refs"
        value={[...refs, ...tuDong].map((r) => `${r.loai}:${r.ma}`).join("\n")}
      />
      {Object.entries(goiY).map(([k, g]) =>
        g.giaTri.length ? (
          <datalist key={k} id={`goi-y-${k}`}>
            {g.giaTri.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        ) : null,
      )}

      {ma ? (
        <fieldset className="grid gap-3" disabled={khoa}>
          {chuaCoMau ? (
            <Notice>
              Trò này chưa có nội dung nào để làm mẫu. Nhờ bộ phận kỹ thuật soạn nội dung đầu tiên; các nội
              dung sau soạn được bằng biểu mẫu.
            </Notice>
          ) : null}
          <label className="grid gap-1 text-sm">
            Phần người chơi thấy (JSON)
            <textarea
              rows={8}
              className={cn(inputClass, "py-2 font-mono text-sm")}
              value={ma.p}
              onChange={(e) => datMa({ p: e.target.value, a: ma.a })}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Đáp án (JSON, không bao giờ gửi cho người chơi trước khi chấm)
            <textarea
              rows={5}
              className={cn(inputClass, "py-2 font-mono text-sm")}
              value={ma.a}
              onChange={(e) => datMa({ p: ma.p, a: e.target.value })}
            />
          </label>
          {ma.loi ? <p className="text-sm text-danger">{ma.loi}</p> : null}
          <div>
            <Button variant="secondary" onClick={veBieuMau}>
              Soạn bằng biểu mẫu
            </Button>
          </div>
        </fieldset>
      ) : (
        <>
          <fieldset className="grid gap-3" disabled={khoa}>
            <legend className="mb-2 font-semibold">Phần người chơi thấy</legend>
            <Truong khoa="" nhan="" v={p} dat={(m) => datP(m as Record<string, GiaTri>)} cx={cx} />
          </fieldset>
          <fieldset className="grid gap-3" disabled={khoa}>
            <legend className="mb-2 font-semibold">Đáp án (người chơi không thấy trước khi chấm)</legend>
            {Object.keys(a).length ? (
              <Truong khoa="" nhan="" v={a} dat={(m) => datA(m as Record<string, GiaTri>)} cx={cx} />
            ) : (
              <p className="text-sm text-ink-2">
                Không cần nhập: trò chơi tự tính đáp án từ phần ở trên và dữ liệu liên quan.
              </p>
            )}
          </fieldset>
        </>
      )}

      <fieldset className="grid gap-2" disabled={khoa}>
        <legend className="mb-1 font-semibold">Dữ liệu liên quan</legend>
        <p className="text-sm text-ink-2">
          Mức phạt, biển báo, quy trình mà nội dung này dựa vào. Khi một mục ở đây bị sửa, nội dung tự rút
          khỏi trò chơi cho tới khi được duyệt lại.
        </p>
        <ul className="grid gap-1">
          {[...refs, ...tuDong].map((r, i) => {
            const m = tenMuc(r);
            return (
              <li
                key={`${r.loai}:${r.ma}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-1 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium">{TEN_LOAI[r.loai] ?? r.loai}</span> ·{" "}
                  {m?.ten.slice(0, 80) || r.ma}
                  {m && !m.da_duyet ? <span className="text-danger"> (chưa duyệt)</span> : null}
                </span>
                {i < refs.length ? (
                  <Button variant="ghost" size="sm" onClick={() => datRefs(refs.filter((x) => x !== r))}>
                    Xóa
                  </Button>
                ) : (
                  <span className="text-ink-3">tự ghi theo bài</span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <select
            aria-label="Loại dữ liệu"
            className={o("w-auto")}
            value={them.loai}
            onChange={(e) => datThem({ loai: e.target.value, ma: "" })}
          >
            {LOAI_THEM.map((l) => (
              <option key={l} value={l}>
                {TEN_LOAI[l]}
              </option>
            ))}
          </select>
          {nguon[them.loai] ? (
            <select
              aria-label="Mục cần thêm"
              className={o("min-w-0 flex-1")}
              value={them.ma}
              onChange={(e) => datThem({ ...them, ma: e.target.value })}
            >
              <option value="">Chọn {TEN_LOAI[them.loai]?.toLowerCase()}</option>
              {nguon[them.loai]!.map((m) => (
                <option key={m.ma} value={m.ma}>
                  {m.ten.slice(0, 70) || m.ma}
                  {m.da_duyet ? "" : " (chưa duyệt)"}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label="Mã câu hỏi"
              placeholder="Mã câu hỏi, ví dụ CH-00001"
              className={o("min-w-0 flex-1")}
              value={them.ma}
              onChange={(e) => datThem({ ...them, ma: e.target.value.trim() })}
            />
          )}
          <Button
            variant="secondary"
            disabled={!them.ma || co(them)}
            onClick={() => {
              datRefs([...refs, them]);
              datThem({ ...them, ma: "" });
            }}
          >
            Thêm
          </Button>
        </div>
      </fieldset>

      {ma || khoa ? null : (
        <div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center text-sm text-primary underline"
            onClick={() => datMa({ p: JSON.stringify(p, null, 2), a: JSON.stringify(a, null, 2) })}
          >
            Sửa dạng mã (dành cho bộ phận kỹ thuật)
          </button>
        </div>
      )}
    </section>
  );
}
