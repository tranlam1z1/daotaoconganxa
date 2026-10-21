/**
 * Biểu mẫu sửa một khối nội dung bài giảng (/quan-tri/chuyen-de/:slug/bai/:id).
 *
 * Chín loại khối trang bài giảng dựng đầy đủ có biểu mẫu riêng, sửa thẳng trên `data` nên không
 * phải đoán cú pháp. Loại khác (dữ liệu nạp từ seed) sửa dạng JSON. Dưới biểu mẫu là bản xem trước
 * vẽ bằng đúng component của trang học viên.
 */
import { type ReactNode, useId, useState } from "react";
import { Form } from "react-router";

import type { KhoiBaiGiang } from "../../lib/bai-giang";
import { cn } from "../../lib/cn";
import { KHOI_SOAN_THEO_KIND, type KhoiQuanTri, LOAI_CANH_BAO, tenKhoi } from "../../lib/soan-bai-giang";
import { KhoiNoiDung } from "../bai-giang/KhoiNoiDung";
import { Button } from "../ui/Button";
import { Input, inputClass, Label, Notice } from "../ui/Field";

type DuLieu = Record<string, unknown>;
type Dong = Record<string, string>;

const chuoi = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const mangDong = (v: unknown): Dong[] =>
  Array.isArray(v)
    ? v.map((x) =>
        Object.fromEntries(
          Object.entries((x ?? {}) as Record<string, unknown>).map(([k, val]) => [k, chuoi(val)]),
        ),
      )
    : [];
const mangChuoi = (v: unknown): string[] => (Array.isArray(v) ? v.map(chuoi) : []);
const demTu = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/**
 * Dọn dữ liệu trước khi lưu và xem trước: bỏ dòng trống, đánh lại mã bước của sơ đồ trình tự.
 * Giữ nguyên các trường khác của `data` mà biểu mẫu không sửa.
 */
export function chuanHoaDuLieu(kind: string, d: DuLieu): DuLieu {
  switch (kind) {
    case "tom_tat":
      return { ...d, y: mangChuoi(d.y).filter((y) => y.trim()) };
    case "so_do_trinh_tu": {
      const buoc = mangDong(d.buoc)
        .filter((b) => b.nhan?.trim())
        .map((b, i) => ({ ...b, ma: `b${i + 1}` }));
      const canh = buoc.slice(1).map((b, i) => ({ tu: buoc[i]?.ma, den: b.ma }));
      return { ...d, buoc, canh };
    }
    case "the_lat":
      return { ...d, the: mangDong(d.the).filter((t) => t.truoc?.trim() || t.sau?.trim()) };
    case "kich_ban":
      return { ...d, luot: mangDong(d.luot).filter((l) => l.loi?.trim()) };
    case "hoi_nhanh":
      return { ...d, phuong_an: mangDong(d.phuong_an).filter((p) => p.text?.trim()) };
    case "bang_tra": {
      const cot = mangChuoi(d.cot);
      const dong = (Array.isArray(d.dong) ? d.dong : [])
        .map((r) => cot.map((_, j) => chuoi(Array.isArray(r) ? r[j] : "")))
        .filter((r) => r.some((o) => o.trim()));
      return { ...d, cot, dong };
    }
    default:
      return d;
  }
}

export function SuaKhoi({ khoi, ban, onDong }: { khoi: KhoiQuanTri; ban: boolean; onDong: () => void }) {
  const id = useId();
  const coBieuMau = KHOI_SOAN_THEO_KIND.has(khoi.kind);
  const mo = KHOI_SOAN_THEO_KIND.get(khoi.kind);
  const [data, setData] = useState<DuLieu>(khoi.data ?? {});
  const [json, setJson] = useState(() => JSON.stringify(khoi.data ?? {}, null, 2));
  const [canCu, setCanCu] = useState(khoi.citations.join("\n"));

  let duLieu: DuLieu | null = data;
  let loiJson: string | null = null;
  if (!coBieuMau) {
    try {
      const v = JSON.parse(json) as unknown;
      if (v && typeof v === "object" && !Array.isArray(v)) duLieu = v as DuLieu;
      else throw new Error();
    } catch {
      duLieu = null;
      loiJson = "Dữ liệu phải là một đối tượng JSON hợp lệ.";
    }
  }
  const sach = duLieu ? chuanHoaDuLieu(khoi.kind, duLieu) : null;
  const dsCanCu = canCu
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  // Thẻ căn cứ: URN của thẻ luôn là một viện dẫn của khối.
  const urn = khoi.kind === "can_cu" ? chuoi(data.urn).trim() : "";
  const viendan = urn && !dsCanCu.includes(urn) ? [urn, ...dsCanCu] : dsCanCu;
  const sua = (k: string, v: unknown) => setData((d) => ({ ...d, [k]: v }));

  const xemTruoc: KhoiBaiGiang | null = sach
    ? {
        id: khoi.id,
        ordinal: khoi.ordinal,
        kind: khoi.kind,
        data: sach,
        citations: viendan,
        citationHealth: "ok",
      }
    : null;

  return (
    <Form method="post" className="space-y-4" onSubmit={(e) => loiJson && e.preventDefault()}>
      <input type="hidden" name="intent" value="luu_khoi" />
      <input type="hidden" name="id" value={khoi.id} />
      <input type="hidden" name="ordinal" value={khoi.ordinal} />
      <input type="hidden" name="kind" value={khoi.kind} />
      <input type="hidden" name="source" value={khoi.source} />
      <input type="hidden" name="modes" value={JSON.stringify(khoi.modes)} />
      <input type="hidden" name="note" value={khoi.note ?? ""} />
      <input type="hidden" name="data" value={sach ? JSON.stringify(sach) : ""} />
      <input type="hidden" name="citations" value={JSON.stringify(viendan)} />

      {coBieuMau ? (
        <BieuMauKhoi kind={khoi.kind} data={data} sua={sua} id={id} />
      ) : (
        <div>
          <Label htmlFor={`${id}-json`}>Dữ liệu khối {tenKhoi(khoi.kind)} (JSON)</Label>
          <textarea
            id={`${id}-json`}
            rows={14}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
            className={cn(inputClass, "py-2 font-mono text-sm", loiJson && "border-danger")}
          />
          {loiJson ? <p className="mt-1 text-sm text-danger">{loiJson}</p> : null}
        </div>
      )}

      <div>
        <Label htmlFor={`${id}-can-cu`}>
          Viện dẫn (mỗi dòng một mã văn bản){mo?.canCanCu ? " — bắt buộc với loại khối này" : ""}
        </Label>
        <textarea
          id={`${id}-can-cu`}
          rows={2}
          value={canCu}
          onChange={(e) => setCanCu(e.target.value)}
          placeholder="vn:vbqppl:l:36/2024/QH15"
          spellCheck={false}
          className={cn(inputClass, "py-2 font-mono text-sm")}
          aria-describedby={`${id}-can-cu-goi-y`}
        />
        <p id={`${id}-can-cu-goi-y`} className="mt-1 text-xs text-ink-3">
          Dạng vn:vbqppl:loại:số-ký-hiệu. Trỏ tới điều, khoản bằng phần sau dấu #, ví dụ
          vn:vbqppl:l:36/2024/QH15#dieu-5.khoan-1.
        </p>
      </div>

      {xemTruoc ? (
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-2">Xem trước</p>
          <div className="rounded-xl border border-dashed border-line-strong bg-canvas p-3">
            <KhoiNoiDung khoi={xemTruoc} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={ban || Boolean(loiJson)}>
          Lưu khối
        </Button>
        <Button variant="secondary" onClick={onDong} disabled={ban}>
          Đóng, không lưu
        </Button>
      </div>
    </Form>
  );
}

function BieuMauKhoi({
  kind,
  data,
  sua,
  id,
}: {
  kind: string;
  data: DuLieu;
  sua: (k: string, v: unknown) => void;
  id: string;
}) {
  switch (kind) {
    case "giang": {
      const md = chuoi(data.md);
      const tu = demTu(md);
      return (
        <div>
          <Label htmlFor={`${id}-md`}>Nội dung</Label>
          <textarea
            id={`${id}-md`}
            rows={10}
            value={md}
            onChange={(e) => sua("md", e.target.value)}
            className={cn(inputClass, "py-2 leading-relaxed")}
            aria-describedby={`${id}-md-goi-y`}
          />
          <p id={`${id}-md-goi-y`} className={cn("mt-1 text-xs", tu > 320 ? "text-warn" : "text-ink-3")}>
            {tu} từ{tu > 320 ? " — dài hơn 320 từ, nên tách thành hai khối" : ""}. In đậm bằng **chữ**, xuống
            đoạn bằng một dòng trống.
          </p>
        </div>
      );
    }

    case "can_cu":
      return (
        <div className="grid gap-4">
          <div>
            <Label htmlFor={`${id}-nhan`}>Tên điều khoản trích</Label>
            <Input
              id={`${id}-nhan`}
              value={chuoi(data.nhan)}
              onChange={(e) => sua("nhan", e.target.value)}
              placeholder="Khoản 1 Điều 5 Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15"
            />
          </div>
          <div>
            <Label htmlFor={`${id}-urn`}>Mã văn bản (URN) của điều khoản</Label>
            <Input
              id={`${id}-urn`}
              value={chuoi(data.urn)}
              onChange={(e) => sua("urn", e.target.value)}
              placeholder="vn:vbqppl:l:36/2024/QH15#dieu-5.khoan-1"
              spellCheck={false}
              className="font-mono"
            />
          </div>
          <div>
            <Label htmlFor={`${id}-nv`}>Nguyên văn</Label>
            <textarea
              id={`${id}-nv`}
              rows={6}
              value={chuoi(data.nguyen_van)}
              onChange={(e) => sua("nguyen_van", e.target.value)}
              className={cn(inputClass, "py-2 leading-relaxed")}
            />
            <p className="mt-1 text-xs text-ink-3">Chép đúng nguyên văn, không tóm tắt, không sửa câu chữ.</p>
          </div>
        </div>
      );

    case "canh_bao":
      return (
        <div className="grid gap-4">
          <div>
            <Label htmlFor={`${id}-loai`}>Loại lưu ý</Label>
            <select
              id={`${id}-loai`}
              value={chuoi(data.loai) || "sai_sot"}
              onChange={(e) => sua("loai", e.target.value)}
              className={inputClass}
            >
              {Object.entries(LOAI_CANH_BAO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`${id}-md`}>Nội dung</Label>
            <textarea
              id={`${id}-md`}
              rows={4}
              value={chuoi(data.md)}
              onChange={(e) => sua("md", e.target.value)}
              className={cn(inputClass, "py-2 leading-relaxed")}
            />
          </div>
        </div>
      );

    case "tom_tat":
      return (
        <DanhSach ten="Ý" items={mangChuoi(data.y)} tao={() => ""} onChange={(v) => sua("y", v)} gioiHan={7}>
          {(y, doi, i) => <Input aria-label={`Ý ${i + 1}`} value={y} onChange={(e) => doi(e.target.value)} />}
        </DanhSach>
      );

    case "so_do_trinh_tu":
      return (
        <DanhSach
          ten="Bước"
          items={mangDong(data.buoc)}
          tao={() => ({ ma: "", nhan: "", mo_ta: "" })}
          onChange={(v) => sua("buoc", v)}
        >
          {(b, doi, i) => (
            <div className="grid gap-2">
              <Input
                aria-label={`Tên bước ${i + 1}`}
                placeholder="Tên bước"
                value={b.nhan ?? ""}
                onChange={(e) => doi({ ...b, nhan: e.target.value })}
              />
              <Input
                aria-label={`Mô tả bước ${i + 1}`}
                placeholder="Mô tả, thời hạn, căn cứ (không bắt buộc)"
                value={b.mo_ta ?? ""}
                onChange={(e) => doi({ ...b, mo_ta: e.target.value })}
              />
            </div>
          )}
        </DanhSach>
      );

    case "the_lat":
      return (
        <DanhSach
          ten="Thẻ"
          items={mangDong(data.the)}
          tao={() => ({ truoc: "", sau: "" })}
          onChange={(v) => sua("the", v)}
        >
          {(t, doi, i) => (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                aria-label={`Mặt trước thẻ ${i + 1}`}
                placeholder="Mặt trước: thuật ngữ"
                value={t.truoc ?? ""}
                onChange={(e) => doi({ ...t, truoc: e.target.value })}
              />
              <textarea
                aria-label={`Mặt sau thẻ ${i + 1}`}
                placeholder="Mặt sau: định nghĩa"
                rows={2}
                value={t.sau ?? ""}
                onChange={(e) => doi({ ...t, sau: e.target.value })}
                className={cn(inputClass, "py-2")}
              />
            </div>
          )}
        </DanhSach>
      );

    case "kich_ban":
      return (
        <DanhSach
          ten="Lượt thoại"
          items={mangDong(data.luot)}
          tao={() => ({ vai: "", loi: "" })}
          onChange={(v) => sua("luot", v)}
        >
          {(l, doi, i) => (
            <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
              <Input
                aria-label={`Người nói lượt ${i + 1}`}
                placeholder="Người nói"
                value={l.vai ?? ""}
                onChange={(e) => doi({ ...l, vai: e.target.value })}
              />
              <textarea
                aria-label={`Lời thoại lượt ${i + 1}`}
                placeholder="Lời thoại"
                rows={2}
                value={l.loi ?? ""}
                onChange={(e) => doi({ ...l, loi: e.target.value })}
                className={cn(inputClass, "py-2")}
              />
            </div>
          )}
        </DanhSach>
      );

    case "hoi_nhanh": {
      const pa = mangDong(data.phuong_an);
      const dapAn = chuoi(data.dap_an);
      return (
        <div className="grid gap-4">
          <div>
            <Label htmlFor={`${id}-cau`}>Câu hỏi</Label>
            <textarea
              id={`${id}-cau`}
              rows={2}
              value={chuoi(data.cau_hoi)}
              onChange={(e) => sua("cau_hoi", e.target.value)}
              className={cn(inputClass, "py-2")}
            />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink-2">Phương án (chọn phương án đúng)</legend>
            <DanhSach
              ten="Phương án"
              items={pa}
              tao={() => ({ id: maMoi(pa), text: "" })}
              onChange={(v) => sua("phuong_an", v)}
              gioiHan={6}
            >
              {(p, doi, i) => (
                <div className="flex items-center gap-3">
                  <label className="flex min-h-11 shrink-0 items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`${id}-dung`}
                      checked={dapAn === p.id}
                      onChange={() => sua("dap_an", p.id)}
                    />
                    Đúng
                  </label>
                  <Input
                    aria-label={`Phương án ${i + 1}`}
                    value={p.text ?? ""}
                    onChange={(e) => doi({ ...p, text: e.target.value })}
                  />
                </div>
              )}
            </DanhSach>
          </fieldset>
          <div>
            <Label htmlFor={`${id}-gt`}>Giải thích sau khi chọn</Label>
            <textarea
              id={`${id}-gt`}
              rows={3}
              value={chuoi(data.giai_thich)}
              onChange={(e) => sua("giai_thich", e.target.value)}
              className={cn(inputClass, "py-2")}
            />
          </div>
        </div>
      );
    }

    case "bang_tra":
      return <SuaBang data={data} sua={sua} id={id} />;

    default:
      return null;
  }
}

/** Mã phương án chưa dùng tiếp theo: a, b, c… */
function maMoi(pa: Dong[]): string {
  const daDung = new Set(pa.map((p) => p.id));
  return "abcdefghijklmnopqrstuvwxyz".split("").find((c) => !daDung.has(c)) ?? `p${pa.length + 1}`;
}

function SuaBang({ data, sua, id }: { data: DuLieu; sua: (k: string, v: unknown) => void; id: string }) {
  const cot = mangChuoi(data.cot);
  const dong = (Array.isArray(data.dong) ? data.dong : []).map((r) =>
    cot.map((_, j) => chuoi(Array.isArray(r) ? r[j] : "")),
  );
  const doiCot = (moi: string[]) => {
    // Thêm, bớt cột thì thêm, bớt ô tương ứng ở mọi dòng.
    if (moi.length > cot.length)
      sua(
        "dong",
        dong.map((r) => [...r, ""]),
      );
    sua("cot", moi);
  };
  return (
    <div className="grid gap-4">
      <div>
        <Label htmlFor={`${id}-td`}>Tiêu đề bảng (không bắt buộc)</Label>
        <Input id={`${id}-td`} value={chuoi(data.tieu_de)} onChange={(e) => sua("tieu_de", e.target.value)} />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink-2">Cột</legend>
        <DanhSach
          ten="Cột"
          items={cot}
          tao={() => ""}
          gioiHan={8}
          onChange={doiCot}
          onXoa={(i) =>
            sua(
              "dong",
              dong.map((r) => r.filter((_, j) => j !== i)),
            )
          }
          onDoiCho={(a, b) =>
            sua(
              "dong",
              dong.map((r) => {
                const m = [...r];
                [m[a], m[b]] = [m[b] ?? "", m[a] ?? ""];
                return m;
              }),
            )
          }
        >
          {(c, doi, i) => (
            <Input aria-label={`Tên cột ${i + 1}`} value={c} onChange={(e) => doi(e.target.value)} />
          )}
        </DanhSach>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink-2">Dòng</legend>
        <DanhSach ten="Dòng" items={dong} tao={() => cot.map(() => "")} onChange={(v) => sua("dong", v)}>
          {(r, doi, i) => (
            <div className="grid gap-2 sm:grid-cols-2">
              {cot.map((c, j) => (
                <Input
                  // biome-ignore lint/suspicious/noArrayIndexKey: ô gắn với vị trí cột
                  key={j}
                  aria-label={`Dòng ${i + 1}, ${c || `cột ${j + 1}`}`}
                  placeholder={c || `Cột ${j + 1}`}
                  value={r[j] ?? ""}
                  onChange={(e) => doi(r.map((o, k) => (k === j ? e.target.value : o)))}
                />
              ))}
            </div>
          )}
        </DanhSach>
      </fieldset>
    </div>
  );
}

/** Danh sách mục sửa được: thêm, xóa, đổi chỗ lên xuống. */
function DanhSach<T>({
  ten,
  items,
  tao,
  onChange,
  onXoa,
  onDoiCho,
  gioiHan = 30,
  children,
}: {
  ten: string;
  items: T[];
  tao: () => T;
  onChange: (items: T[]) => void;
  /** Gọi trước khi xóa mục thứ i (bảng dùng để xóa ô của cột ở mọi dòng). */
  onXoa?: (i: number) => void;
  onDoiCho?: (a: number, b: number) => void;
  gioiHan?: number;
  children: (item: T, doi: (v: T) => void, i: number) => ReactNode;
}) {
  const doiCho = (a: number, b: number) => {
    const m = [...items];
    [m[a], m[b]] = [m[b] as T, m[a] as T];
    onDoiCho?.(a, b);
    onChange(m);
  };
  return (
    <div className="grid gap-2">
      {items.map((it, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: mục không có khóa riêng, sửa theo vị trí
        <div key={i} className="rounded-lg border border-line bg-surface p-2">
          <div className="mb-1 flex items-center gap-1">
            <span className="mr-auto text-xs font-semibold text-ink-3">
              {ten} {i + 1}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={i === 0}
              onClick={() => doiCho(i, i - 1)}
              aria-label={`Đưa ${ten.toLowerCase()} ${i + 1} lên`}
            >
              Lên
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={i === items.length - 1}
              onClick={() => doiCho(i, i + 1)}
              aria-label={`Đưa ${ten.toLowerCase()} ${i + 1} xuống`}
            >
              Xuống
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onXoa?.(i);
                onChange(items.filter((_, j) => j !== i));
              }}
              aria-label={`Xóa ${ten.toLowerCase()} ${i + 1}`}
            >
              Xóa
            </Button>
          </div>
          {children(it, (v) => onChange(items.map((x, j) => (j === i ? v : x))), i)}
        </div>
      ))}
      {items.length < gioiHan ? (
        <Button
          variant="secondary"
          size="sm"
          className="justify-self-start"
          onClick={() => onChange([...items, tao()])}
        >
          Thêm {ten.toLowerCase()}
        </Button>
      ) : null}
    </div>
  );
}

export function ThongBaoLoiBangKiem({
  loi,
}: {
  loi: Array<{ muc: string; thong_diep: string; ordinal?: number }>;
}) {
  if (!loi.length) return null;
  const chan = loi.filter((l) => l.muc === "loi");
  const nhac = loi.filter((l) => l.muc !== "loi");
  return (
    <div className="grid gap-2">
      {chan.length ? (
        <Notice tone="danger">
          <p className="font-semibold">Chưa xuất bản được ({chan.length} lỗi):</p>
          <ul className="mt-1 list-disc pl-5">
            {chan.map((l, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: danh sách chỉ đọc
              <li key={i}>
                {l.ordinal ? `Khối ${l.ordinal}: ` : ""}
                {l.thong_diep}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {nhac.length ? (
        <Notice>
          <p className="font-semibold">Nên sửa:</p>
          <ul className="mt-1 list-disc pl-5">
            {nhac.map((l, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: danh sách chỉ đọc
              <li key={i}>
                {l.ordinal ? `Khối ${l.ordinal}: ` : ""}
                {l.thong_diep}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}
    </div>
  );
}
