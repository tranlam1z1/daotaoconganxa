/**
 * Bài tập ngay trong bài giảng (ke-hoach/09-a §4): câu tự luận AI chấm theo rubric và câu trắc
 * nghiệm máy chấm. Chấm luôn chạy ở máy chủ; đề gửi xuống không kèm đáp án hay rubric.
 *
 * Mỗi bài tập nộp bằng một fetcher riêng, nên nộp bài này không xóa chữ đang gõ ở bài khác. Kết
 * quả lấy từ phản hồi vừa nộp, hoặc từ lần nộp gần nhất mà trang bài trả về khi mở lại.
 */
import { useState } from "react";
import { useFetcher } from "react-router";

import { BAI_TAP_TRONG_BAI, DO_DAI_BAI_VIET, type HoatDongHoc, type KetQuaBaiTap } from "../../lib/bai-giang";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { inputClass, Label, Notice } from "../ui/Field";

/** Phản hồi của action trang bài cho các thao tác bài tập. */
export type KetQuaThaoTacBaiTap =
  | { intent: "nop-bai-tap"; hoatDongId: string; ketQua: KetQuaBaiTap }
  | { intent: "phuc-khao"; hoatDongId: string; ok: true }
  | { intent: "nop-bai-tap" | "phuc-khao"; hoatDongId: string; loi: string };

export function BaiTapTrongBai({
  hoatDong,
  ghiDanhId,
}: {
  hoatDong: HoatDongHoc[];
  ghiDanhId: string | null;
}) {
  const ds = hoatDong.filter((h) => (BAI_TAP_TRONG_BAI as readonly string[]).includes(h.kind));
  if (!ds.length) return null;
  return (
    <section aria-labelledby="bai-tap" className="rounded-xl border border-line bg-surface p-4">
      <h2 id="bai-tap" className="text-lg font-semibold">
        Bài tập
      </h2>
      <ol className="mt-4 grid gap-6">
        {ds.map((h, i) => (
          <li key={h.id} className={cn(i > 0 && "border-t border-line pt-6")}>
            {h.kind === "viet_co_can_cu" ? (
              <TuLuan hd={h} ghiDanhId={ghiDanhId} />
            ) : (
              <TracNghiem hd={h} ghiDanhId={ghiDanhId} />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function DeBai({ hd }: { hd: HoatDongHoc }) {
  return (
    <>
      {hd.title ? <p className="text-sm font-semibold text-primary">{hd.title}</p> : null}
      <p className="mt-1 text-base font-semibold leading-relaxed">{hd.prompt.cau_hoi}</p>
      {hd.prompt.huong_dan ? <p className="mt-1 text-base text-ink-2">{hd.prompt.huong_dan}</p> : null}
    </>
  );
}

function TuLuan({ hd, ghiDanhId }: { hd: HoatDongHoc; ghiDanhId: string | null }) {
  const nop = useFetcher<KetQuaThaoTacBaiTap>();
  const cu = hd.luotGanNhat;
  const [baiViet, setBaiViet] = useState(cu?.traLoi.bai_viet ?? "");
  const dangCham = nop.state !== "idle";
  const vua = nop.data && "ketQua" in nop.data ? nop.data.ketQua : undefined;
  const loi = nop.data && "loi" in nop.data ? nop.data.loi : undefined;
  const ketQua: KetQuaBaiTap | undefined = vua ?? cu ?? undefined;
  const doDai = baiViet.trim().length;
  const idO = `bai-viet-${hd.id}`;

  return (
    <div>
      <DeBai hd={hd} />
      <nop.Form method="post" className="mt-3">
        <input type="hidden" name="intent" value="nop-bai-tap" />
        <input type="hidden" name="hoat_dong_id" value={hd.id} />
        <input type="hidden" name="loai" value="viet_co_can_cu" />
        {ghiDanhId ? <input type="hidden" name="ghi_danh_id" value={ghiDanhId} /> : null}
        <Label htmlFor={idO}>Bài làm của bạn</Label>
        <textarea
          id={idO}
          name="bai_viet"
          rows={8}
          required
          minLength={DO_DAI_BAI_VIET.toiThieu}
          maxLength={DO_DAI_BAI_VIET.toiDa}
          value={baiViet}
          onChange={(e) => setBaiViet(e.target.value)}
          className={cn(inputClass, "py-2 text-base leading-relaxed")}
          aria-describedby={`${idO}-dem`}
        />
        <p id={`${idO}-dem`} className="mt-1 text-sm text-ink-2">
          {doDai.toLocaleString("vi-VN")}/{DO_DAI_BAI_VIET.toiDa.toLocaleString("vi-VN")} ký tự
          {doDai < DO_DAI_BAI_VIET.toiThieu ? `, cần ít nhất ${DO_DAI_BAI_VIET.toiThieu}` : ""}. Nhớ ghi rõ
          điều, khoản bạn dựa vào.
        </p>
        <Button
          type="submit"
          disabled={dangCham || doDai < DO_DAI_BAI_VIET.toiThieu}
          className="mt-3 min-h-12 w-full text-base sm:w-auto"
        >
          {dangCham ? "AI đang chấm, khoảng nửa phút" : cu ? "Nộp lại để chấm" : "Nộp bài để chấm"}
        </Button>
      </nop.Form>

      {loi ? (
        <Notice tone="danger" className="mt-3">
          {loi}
        </Notice>
      ) : null}
      {ketQua && !dangCham ? (
        <KetQuaTuLuan hd={hd} kq={ketQua} cu={vua ? null : cu} ghiDanhId={ghiDanhId} />
      ) : null}
    </div>
  );
}

function KetQuaTuLuan({
  hd,
  kq,
  cu,
  ghiDanhId,
}: {
  hd: HoatDongHoc;
  kq: KetQuaBaiTap;
  /** Lần nộp cũ trang bài trả về; null khi `kq` là kết quả vừa nộp. */
  cu: HoatDongHoc["luotGanNhat"];
  ghiDanhId: string | null;
}) {
  const choCham = kq.choCham || (cu?.gradedBy === "nguoi" && cu.diemGiangVien === null);
  // Giảng viên đã chấm thì điểm, đạt/chưa đạt và nhận xét đều theo giảng viên.
  const diemGiangVien = cu?.diemGiangVien ?? null;
  const nhanXet = kq.feedback.giang_vien ?? kq.feedback;
  return (
    <div className="mt-4 rounded-xl bg-surface-2 p-4" role="status">
      {choCham ? (
        <p className="text-base font-semibold">Bài đang chờ giảng viên chấm.</p>
      ) : (
        <p className={cn("text-base font-semibold", kq.passed ? "text-ok" : "text-danger")}>
          {kq.passed ? "Đạt" : "Chưa đạt"}: {(diemGiangVien ?? kq.score).toLocaleString("vi-VN")}/
          {kq.maxScore} điểm
        </p>
      )}
      {diemGiangVien !== null ? (
        <p className="mt-1 text-base font-semibold">
          Giảng viên đã chấm. Đây là điểm cuối cùng.
          {cu?.gradedBy === "ai"
            ? ` Điểm AI chấm trước đó: ${kq.score.toLocaleString("vi-VN")}/${kq.maxScore}.`
            : ""}
        </p>
      ) : null}
      {nhanXet.tom_tat ? <p className="mt-2 text-base leading-relaxed">{nhanXet.tom_tat}</p> : null}
      {nhanXet.tieu_chi?.length ? (
        <ul className="mt-3 space-y-3">
          {nhanXet.tieu_chi.map((t) => (
            <li key={t.ma}>
              <p className="font-semibold">
                {t.ten}: {t.diem}/{t.diem_toi_da}
              </p>
              {t.nhan_xet ? <p className="text-ink-2">{t.nhan_xet}</p> : null}
              {t.bang_chung ? (
                <blockquote className="mt-1 border-l-4 border-line-strong pl-3 text-sm text-ink-2">
                  {t.bang_chung}
                </blockquote>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!choCham ? <PhucKhao hd={hd} kq={kq} cu={cu} ghiDanhId={ghiDanhId} /> : null}
    </div>
  );
}

/** Đề nghị giảng viên chấm lại lượt AI chấm gần nhất. Một lượt chỉ đề nghị được một lần. */
function PhucKhao({
  hd,
  kq,
  cu,
  ghiDanhId,
}: {
  hd: HoatDongHoc;
  kq: KetQuaBaiTap;
  cu: HoatDongHoc["luotGanNhat"];
  ghiDanhId: string | null;
}) {
  const gui = useFetcher<KetQuaThaoTacBaiTap>();
  const daGui = (gui.data && "ok" in gui.data) || Boolean(kq.feedback.phuc_khao) || Boolean(cu?.choGiangVien);
  if (cu?.diemGiangVien != null) return null;
  if (daGui) {
    // Lượt có thể vào hàng đối chiếu do hệ thống lấy mẫu, không chỉ do người học đề nghị.
    return (
      <p className="mt-3 text-sm text-ink-2">
        Giảng viên sẽ chấm lại bài này. Khi có, điểm của giảng viên là điểm cuối cùng.
      </p>
    );
  }
  const loi = gui.data && "loi" in gui.data ? gui.data.loi : undefined;
  return (
    <details className="mt-3 text-sm">
      <summary className="flex min-h-11 cursor-pointer items-center text-primary">
        Điểm do AI chấm. Thấy chưa thỏa đáng? Đề nghị giảng viên chấm lại
      </summary>
      <gui.Form method="post" className="mt-2">
        <input type="hidden" name="intent" value="phuc-khao" />
        <input type="hidden" name="hoat_dong_id" value={hd.id} />
        {ghiDanhId ? <input type="hidden" name="ghi_danh_id" value={ghiDanhId} /> : null}
        <Label htmlFor={`ly-do-${hd.id}`}>Lý do</Label>
        <textarea
          id={`ly-do-${hd.id}`}
          name="ly_do"
          rows={3}
          required
          minLength={5}
          maxLength={1000}
          className={cn(inputClass, "py-2 text-base")}
          placeholder="Ví dụ: bài đã viện dẫn đúng khoản 1 Điều 2 nhưng tiêu chí căn cứ bị 0 điểm."
        />
        {loi ? (
          <Notice tone="danger" className="mt-2">
            {loi}
          </Notice>
        ) : null}
        <Button type="submit" variant="secondary" disabled={gui.state !== "idle"} className="mt-2 min-h-12">
          Gửi đề nghị
        </Button>
      </gui.Form>
    </details>
  );
}

function TracNghiem({ hd, ghiDanhId }: { hd: HoatDongHoc; ghiDanhId: string | null }) {
  const nop = useFetcher<KetQuaThaoTacBaiTap>();
  const vua = nop.data && "ketQua" in nop.data ? nop.data.ketQua : undefined;
  const loi = nop.data && "loi" in nop.data ? nop.data.loi : undefined;
  const ketQua = vua ?? hd.luotGanNhat ?? undefined;
  const daChon = hd.luotGanNhat?.traLoi.chon ?? [];
  return (
    <div>
      <DeBai hd={hd} />
      <nop.Form method="post" className="mt-3">
        <input type="hidden" name="intent" value="nop-bai-tap" />
        <input type="hidden" name="hoat_dong_id" value={hd.id} />
        <input type="hidden" name="loai" value="trac_nghiem" />
        {ghiDanhId ? <input type="hidden" name="ghi_danh_id" value={ghiDanhId} /> : null}
        <fieldset className="grid gap-2">
          <legend className="sr-only">Chọn phương án</legend>
          {(hd.prompt.phuong_an ?? []).map((p) => (
            <label
              key={p.id}
              className="flex min-h-12 items-start gap-3 rounded-lg border border-line px-3 py-2 text-base leading-relaxed"
            >
              <input
                type="radio"
                name="chon"
                value={p.id}
                required
                defaultChecked={daChon.includes(p.id)}
                className="mt-1 size-5 shrink-0"
              />
              {p.text}
            </label>
          ))}
        </fieldset>
        <Button
          type="submit"
          disabled={nop.state !== "idle"}
          className="mt-3 min-h-12 w-full text-base sm:w-auto"
        >
          {ketQua ? "Trả lời lại" : "Trả lời"}
        </Button>
      </nop.Form>
      {loi ? (
        <Notice tone="danger" className="mt-3">
          {loi}
        </Notice>
      ) : null}
      {ketQua && nop.state === "idle" ? (
        <div className="mt-3 text-base leading-relaxed" role="status">
          <p className={cn("font-semibold", ketQua.passed ? "text-ok" : "text-danger")}>
            {ketQua.passed ? "Đúng." : "Chưa đúng."}
          </p>
          {ketQua.feedback.tom_tat ? <p className="mt-1">{ketQua.feedback.tom_tat}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
