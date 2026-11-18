/**
 * Hiển thị một câu hỏi đúng như người học thấy (docs/PLAN.md GĐ3). Dùng chung cho xem trước ở
 * quản trị, luyện tập (GĐ4) và thi (GĐ6), nên chỉ nhận `DeCauHoi` — phần không có đáp án.
 *
 * Component có điều khiển: trang giữ `traLoi` và nhận thay đổi qua `onChange`. Khi có `ketQua`
 * (sau khi chấm), các lựa chọn khóa lại và được tô đúng/sai, kèm giải thích và căn cứ.
 *
 * Vùng bấm cao tối thiểu 48px, chữ nội dung 16px trở lên (bảng kiểm §0.4 của PLAN).
 * Sắp xếp dùng nút lên/xuống thay cho kéo thả để bấm được bằng ngón cái và bằng bàn phím.
 */
import { Link } from "react-router";

import { dieuHrefFromUrn, nhanVienDan } from "../../lib/citation";
import { cn } from "../../lib/cn";
import { urlAnhBienBao } from "../../lib/du-lieu-tra-cuu";
import type { DeCauHoi, KetQuaCauHoi, TraLoiCauHoi } from "../../lib/ngan-hang";
import { DO_DAI_BAI_VIET, tachDeDienKhuyet } from "../../lib/ngan-hang";
import { Icon } from "../ui/Icon";

const CHU = "ABCDEFGHIJKL";

export function HienThiCauHoi({
  de,
  traLoi,
  onChange,
  ketQua,
  khoa = false,
  idGoc = "cau-hoi",
  anPhanHoi = false,
}: {
  de: DeCauHoi;
  traLoi: TraLoiCauHoi;
  onChange?: (t: TraLoiCauHoi) => void;
  ketQua?: KetQuaCauHoi | null;
  /** Chỉ xem: không cho chọn (xem trước khi đang soạn). */
  khoa?: boolean;
  /** Tiền tố id cho các ô nhập, khi một trang có nhiều câu. */
  idGoc?: string;
  /** true khi trang tự hiện phản hồi (luyện tập có ngăn kéo căn cứ); vẫn tô đúng/sai trên phương án. */
  anPhanHoi?: boolean;
}) {
  const dongBang = khoa || Boolean(ketQua) || !onChange;
  const doi = (t: TraLoiCauHoi) => {
    if (!dongBang) onChange?.(t);
  };

  return (
    <div className="space-y-4">
      {de.kind === "dien_khuyet" ? (
        <DeDienKhuyet de={de} traLoi={traLoi} doi={doi} dongBang={dongBang} ketQua={ketQua} idGoc={idGoc} />
      ) : (
        <p className="text-lg leading-relaxed font-semibold whitespace-pre-line text-pretty">{de.stem}</p>
      )}
      {de.image_uris?.length ? (
        <ul className="flex flex-wrap items-end gap-3">
          {de.image_uris.map((uri, i, ds) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: ảnh xác định theo thứ tự, một ảnh có thể lặp
            <li key={i} className="grid justify-items-center gap-1 text-sm text-ink-2">
              {/* Chữ thay thế không nêu tên biển: tên biển có thể chính là đáp án. */}
              <img
                src={urlAnhBienBao(uri)}
                alt={`Hình ${i + 1} của câu hỏi`}
                className="max-h-40 w-auto max-w-full rounded-btn border border-line bg-white p-2"
              />
              {ds.length > 1 ? `Hình ${i + 1}` : null}
            </li>
          ))}
        </ul>
      ) : null}

      {de.kind === "mot_dap_an" || de.kind === "dung_sai" || de.kind === "nhieu_dap_an" ? (
        <LuaChon de={de} traLoi={traLoi} doi={doi} dongBang={dongBang} ketQua={ketQua} />
      ) : null}
      {de.kind === "sap_xep" ? (
        <SapXep de={de} traLoi={traLoi} doi={doi} dongBang={dongBang} ketQua={ketQua} />
      ) : null}
      {de.kind === "ghep_cap" ? (
        <GhepCap de={de} traLoi={traLoi} doi={doi} dongBang={dongBang} ketQua={ketQua} idGoc={idGoc} />
      ) : null}
      {de.kind === "tu_luan" ? <BaiViet traLoi={traLoi} doi={doi} dongBang={dongBang} idGoc={idGoc} /> : null}

      {ketQua && !anPhanHoi ? (
        de.kind === "tu_luan" ? (
          <DapAnGoiY ketQua={ketQua} />
        ) : (
          <PhanHoi ketQua={ketQua} />
        )
      ) : null}
    </div>
  );
}

/** Câu tự luận: ô viết bài kèm bộ đếm ký tự theo giới hạn máy chủ nhận. */
function BaiViet({
  traLoi,
  doi,
  dongBang,
  idGoc,
}: Pick<PhanProps, "traLoi" | "doi" | "dongBang"> & { idGoc: string }) {
  const bai = traLoi.bai_viet ?? "";
  const ngan = bai.trim().length > 0 && bai.trim().length < DO_DAI_BAI_VIET.toiThieu;
  return (
    <div>
      <label htmlFor={`${idGoc}-bai-viet`} className="mb-2 block text-sm text-ink-2">
        Bài làm. Nêu rõ căn cứ (điều, khoản, văn bản) rồi trình bày hướng xử lý.
      </label>
      <textarea
        id={`${idGoc}-bai-viet`}
        value={bai}
        disabled={dongBang}
        maxLength={DO_DAI_BAI_VIET.toiDa}
        rows={10}
        onChange={(e) => doi({ bai_viet: e.target.value })}
        className="block min-h-48 w-full rounded-btn border border-line-strong bg-surface px-3 py-2 text-base leading-relaxed disabled:bg-surface-2"
      />
      <p className={cn("mt-1 text-right text-sm", ngan ? "text-warn" : "text-ink-3")} aria-live="polite">
        {bai.length.toLocaleString("vi-VN")} / {DO_DAI_BAI_VIET.toiDa.toLocaleString("vi-VN")} ký tự
        {ngan ? ` (nên viết ít nhất ${DO_DAI_BAI_VIET.toiThieu} ký tự)` : ""}
      </p>
    </div>
  );
}

/** Sau khi chấm câu tự luận: đáp án gợi ý và căn cứ, không tô đúng/sai (điểm hiện ở trang kết quả). */
function DapAnGoiY({ ketQua }: { ketQua: KetQuaCauHoi }) {
  if (!ketQua.giai_thich && !ketQua.can_cu.length) return null;
  return (
    <div className="border-t border-line pt-4">
      <p className="flex items-center gap-2 font-semibold text-info">
        <Icon name="book" kieu="net" className="size-5 shrink-0" />
        Đáp án gợi ý
      </p>
      {ketQua.giai_thich ? (
        <p className="mt-1 text-base leading-relaxed whitespace-pre-line text-ink">{ketQua.giai_thich}</p>
      ) : null}
      <DanhSachCanCu urns={ketQua.can_cu} />
    </div>
  );
}

function DanhSachCanCu({ urns }: { urns: string[] }) {
  if (!urns.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {urns.map((urn) => (
        <li key={urn}>
          <Link
            to={dieuHrefFromUrn(urn)}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4"
          >
            <Icon name="book" className="size-4 shrink-0" />
            Căn cứ: {nhanVienDan(urn)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

interface PhanProps {
  de: DeCauHoi;
  traLoi: TraLoiCauHoi;
  doi: (t: TraLoiCauHoi) => void;
  dongBang: boolean;
  ketQua?: KetQuaCauHoi | null;
}

function LuaChon({ de, traLoi, doi, dongBang, ketQua }: PhanProps) {
  const nhieu = de.kind === "nhieu_dap_an";
  const chon = traLoi.chon ?? [];
  const dung = new Set(ketQua?.dap_an.dung ?? []);
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-ink-2">
        {nhieu ? "Chọn tất cả đáp án đúng." : "Chọn một đáp án."}
      </legend>
      <ul className="grid gap-2">
        {(de.options.phuong_an ?? []).map((pa, i) => {
          const daChon = chon.includes(pa.id);
          const laDung = ketQua && dung.has(pa.id);
          const laSai = ketQua && daChon && !dung.has(pa.id);
          return (
            <li key={pa.id}>
              <button
                type="button"
                aria-pressed={daChon}
                disabled={dongBang}
                onClick={() =>
                  doi({
                    chon: nhieu ? (daChon ? chon.filter((x) => x !== pa.id) : [...chon, pa.id]) : [pa.id],
                  })
                }
                className={cn(
                  "flex min-h-14 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-btn border px-3 py-2.5 text-left text-base leading-snug",
                  "disabled:cursor-default",
                  // cn() không gộp lớp trùng thuộc tính, nên chọn đúng MỘT bộ màu viền và nền.
                  laDung
                    ? "border-ok bg-ok-soft"
                    : laSai
                      ? "border-danger bg-danger-soft"
                      : daChon
                        ? "border-primary bg-primary-soft"
                        : "border-line-strong bg-surface",
                  !dongBang && "dong-bam",
                )}
              >
                <span
                  aria-hidden="true"
                  // Ô chữ cái 32px như bản mẫu "Công văn"; sau khi chấm tô theo kết quả.
                  className={cn(
                    "grid size-8 shrink-0 place-items-center border text-sm font-bold",
                    nhieu ? "rounded-btn" : "rounded-full",
                    laDung
                      ? "border-ok bg-ok text-surface"
                      : laSai
                        ? "border-danger bg-danger text-surface"
                        : daChon
                          ? "border-primary bg-primary text-on-primary"
                          : "border-line-strong text-ink-2",
                  )}
                >
                  {de.kind === "dung_sai" ? "" : CHU[i]}
                </span>
                <span className="min-w-0 grow basis-40">
                  {pa.image_uri ? (
                    <img
                      src={urlAnhBienBao(pa.image_uri)}
                      alt={`Hình của phương án ${CHU[i]}`}
                      className="mb-1 block max-h-28 w-auto max-w-full rounded border border-line bg-white p-1"
                    />
                  ) : null}
                  {pa.text}
                </span>
                {laDung ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ok">
                    <Icon name="check" kieu="net" className="size-4" />
                    Đáp án đúng
                  </span>
                ) : null}
                {laSai ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-danger">
                    <Icon name="x" kieu="net" className="size-4" />
                    Chưa đúng
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function DeDienKhuyet({ de, traLoi, doi, dongBang, ketQua, idGoc }: PhanProps & { idGoc: string }) {
  const doan = tachDeDienKhuyet(de.stem);
  const o = traLoi.o_trong ?? {};
  const chiTiet = new Map((ketQua?.chi_tiet ?? []).map((c) => [c.ma, c.dung]));
  return (
    <div>
      <p className="text-lg leading-loose font-medium">
        {doan.map((chu, i) => {
          const ma = String(i + 1);
          const trangThai = chiTiet.get(ma);
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: đoạn đề cố định theo vị trí ô trống
            <span key={i}>
              {chu}
              {i < doan.length - 1 ? (
                <>
                  <label htmlFor={`${idGoc}-o-${ma}`} className="sr-only">
                    Ô trống {ma}
                  </label>
                  <input
                    id={`${idGoc}-o-${ma}`}
                    value={o[ma] ?? ""}
                    disabled={dongBang}
                    onChange={(e) => doi({ o_trong: { ...o, [ma]: e.target.value } })}
                    placeholder={`(${ma})`}
                    className={cn(
                      "mx-1 inline-block min-h-11 w-32 rounded-btn border bg-surface px-2 text-base",
                      trangThai === true && "border-ok bg-ok-soft",
                      trangThai === false && "border-danger bg-danger-soft",
                      trangThai === undefined && "border-line-strong",
                    )}
                  />
                </>
              ) : null}
            </span>
          );
        })}
      </p>
      {ketQua?.dap_an.o_trong ? (
        <p className="mt-2 text-sm text-ink-2">
          Đáp án:{" "}
          {Object.entries(ketQua.dap_an.o_trong)
            .map(([k, v]) => `(${k}) ${v.join(" hoặc ")}`)
            .join("; ")}
        </p>
      ) : null}
    </div>
  );
}

function SapXep({ de, traLoi, doi, dongBang, ketQua }: PhanProps) {
  const theoId = new Map((de.options.phuong_an ?? []).map((m) => [m.id, m]));
  const thuTu = traLoi.thu_tu?.length ? traLoi.thu_tu : [...theoId.keys()];
  const dung = ketQua?.dap_an.thu_tu;
  const doiCho = (i: number, j: number) => {
    const moi = [...thuTu];
    [moi[i], moi[j]] = [moi[j]!, moi[i]!];
    doi({ thu_tu: moi });
  };
  return (
    <div>
      <p className="mb-2 text-sm text-ink-2">Dùng nút Lên, Xuống để xếp theo đúng thứ tự.</p>
      <ol className="grid gap-2">
        {thuTu.map((id, i) => (
          <li
            key={id}
            className={cn(
              "flex min-h-12 items-center gap-2 rounded-btn border bg-surface py-1 pr-1 pl-4 text-base",
              dung
                ? dung[i] === id
                  ? "border-ok bg-ok-soft"
                  : "border-danger bg-danger-soft"
                : "border-line-strong",
            )}
          >
            <span className="w-5 shrink-0 font-semibold text-ink-3">{i + 1}.</span>
            <span className="min-w-0 flex-1">{theoId.get(id)?.text}</span>
            {!dongBang ? (
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => doiCho(i, i - 1)}
                  className="min-h-11 min-w-11 rounded-btn border border-line px-2 text-sm disabled:opacity-40"
                  aria-label={`Đưa "${theoId.get(id)?.text}" lên`}
                >
                  Lên
                </button>
                <button
                  type="button"
                  disabled={i === thuTu.length - 1}
                  onClick={() => doiCho(i, i + 1)}
                  className="min-h-11 min-w-11 rounded-btn border border-line px-2 text-sm disabled:opacity-40"
                  aria-label={`Đưa "${theoId.get(id)?.text}" xuống`}
                >
                  Xuống
                </button>
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      {dung ? (
        <p className="mt-2 text-sm text-ink-2">
          Thứ tự đúng: {dung.map((id, i) => `${i + 1}. ${theoId.get(id)?.text ?? id}`).join("; ")}
        </p>
      ) : null}
    </div>
  );
}

function GhepCap({ de, traLoi, doi, dongBang, ketQua, idGoc }: PhanProps & { idGoc: string }) {
  const cap = traLoi.cap ?? {};
  const phai = de.options.phai ?? [];
  const tenPhai = new Map(phai.map((p) => [p.id, p.text]));
  const dung = ketQua?.dap_an.cap;
  return (
    <div>
      <p className="mb-2 text-sm text-ink-2">Chọn nội dung tương ứng cho từng dòng.</p>
      <ul className="grid gap-3">
        {(de.options.trai ?? []).map((t) => {
          const ok = dung ? dung[t.id] === cap[t.id] : undefined;
          return (
            <li
              key={t.id}
              className={cn(
                "rounded-btn border bg-surface p-3",
                ok === true && "border-ok bg-ok-soft",
                ok === false && "border-danger bg-danger-soft",
                ok === undefined && "border-line-strong",
              )}
            >
              <label htmlFor={`${idGoc}-cap-${t.id}`} className="block text-base font-medium">
                {t.text}
              </label>
              <select
                id={`${idGoc}-cap-${t.id}`}
                value={cap[t.id] ?? ""}
                disabled={dongBang}
                onChange={(e) => doi({ cap: { ...cap, [t.id]: e.target.value } })}
                className="mt-2 min-h-12 w-full rounded-btn border border-line-strong bg-surface px-2 text-base"
              >
                <option value="">Chọn…</option>
                {phai.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.text}
                  </option>
                ))}
              </select>
              {ok === false && dung ? (
                <p className="mt-1 text-sm text-ink-2">Đúng là: {tenPhai.get(dung[t.id] ?? "") ?? ""}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PhanHoi({ ketQua }: { ketQua: KetQuaCauHoi }) {
  return (
    // Hướng "Công văn": phản hồi tách bằng kẻ mảnh, không thanh màu bên trái; màu chỉ ở dòng kết luận.
    <div role="status" className="border-t border-line pt-4">
      <p className={cn("flex items-center gap-2 font-bold", ketQua.dung ? "text-ok" : "text-danger")}>
        <Icon name={ketQua.dung ? "check" : "x"} kieu="net" className="size-5 shrink-0" />
        {ketQua.dung ? "Đúng." : "Chưa đúng."}
      </p>
      {ketQua.giai_thich ? (
        <p className="mt-1 text-base leading-relaxed text-ink-2">{ketQua.giai_thich}</p>
      ) : null}
      <DanhSachCanCu urns={ketQua.can_cu} />
    </div>
  );
}
