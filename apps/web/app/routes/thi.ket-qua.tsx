/**
 * Kết quả một lượt thi (docs/PLAN.md GĐ6): đạt hay chưa đạt in to, điểm, số câu đúng, thời
 * gian làm. Xem lại từng câu kèm đáp án chỉ khi cấu hình đề cho phép.
 *
 * Đề có tự luận: điểm từng câu theo thang của đề, nhận xét theo tiêu chí chấm. Câu mô hình chưa
 * chấm được thì lượt ở trạng thái chờ chấm, điểm hiện khi giảng viên chấm xong.
 */
import { HienThiCauHoi } from "../components/cau-hoi/HienThiCauHoi";
import { ButtonLink } from "../components/ui/Button";
import { Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { KhungTrang } from "../components/ui/KhungTrang";
import { cn } from "../lib/cn";
import { formatNgayGio } from "../lib/format";
import { goiApiQuanTri, khongTimThay } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import { diemSo, dinhDangThoiLuong, type KetQuaThi, type NhanXetTuLuan } from "../lib/thi";
import type { Route } from "./+types/thi.ket-qua";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Kết quả bài thi", { index: false });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  return {
    kq: await goiApiQuanTri<KetQuaThi>(token, `/v1/thi/luot/${params.id}/ket-qua`).catch(khongTimThay),
  };
}

export default function KetQua({ loaderData }: Route.ComponentProps) {
  const { kq } = loaderData;
  const choCham = kq.trang_thai === "cho_cham";
  // Đề có điểm câu khác 1 (hoặc có tự luận): hiện thêm điểm theo thang của đề.
  const coDiemTho = kq.co_tu_luan || kq.tong_diem_tho !== kq.tong;
  return (
    <KhungTrang className="wrap max-w-3xl py-8">
      <p className="text-sm text-ink-3">{kq.exam_title}</p>
      {choCham ? (
        <section
          aria-labelledby="ket-luan"
          className="mt-3 rounded-card border border-line bg-surface p-6 text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.06em] text-ink-3">Kết luận</p>
          <h1 id="ket-luan" className="dau-cong-van mt-3 whitespace-nowrap text-xl text-warn sm:text-2xl">
            <Icon name="clock" kieu="net" className="size-6 shrink-0" />
            Đang chờ chấm
          </h1>
          <p className="mt-3 text-sm text-ink-2">
            Bài đã được nộp. Còn {kq.so_cau_cho_cham} câu tự luận chờ giảng viên chấm; điểm sẽ hiện ở đây khi
            chấm xong.
          </p>
        </section>
      ) : (
        // Hướng "Công văn": kết luận in như con dấu (viền đôi) trên nền trắng, không tô cả khối.
        <section
          aria-labelledby="ket-luan"
          className="mt-3 rounded-card border border-line bg-surface p-6 text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.06em] text-ink-3">Kết luận</p>
          <h1
            id="ket-luan"
            className={cn(
              "dau-cong-van mt-3 whitespace-nowrap text-2xl sm:text-4xl",
              kq.dat ? "text-ok" : "text-danger",
            )}
          >
            <Icon name={kq.dat ? "check" : "x"} kieu="net" className="size-6 shrink-0 sm:size-7" />
            {kq.dat ? "Đạt" : "Chưa đạt"}
          </h1>
          <p className="mt-5 font-sans text-3xl font-bold tabular-nums text-ink">
            {diemSo(kq.diem ?? 0)}
            <span className="text-lg font-medium text-ink-2">/100 điểm</span>
          </p>
          {coDiemTho && kq.diem_tho !== null ? (
            <p className="mt-1 text-sm text-ink-2">
              {diemSo(kq.diem_tho)} / {diemSo(kq.tong_diem_tho)} điểm theo thang của đề
            </p>
          ) : null}
          <p className="mt-1 text-sm text-ink-2">Điểm đạt: {kq.diem_dat}</p>
        </section>
      )}

      {/* Ba số liệu trên một hàng kẻ, như dòng thông tin dưới tiêu đề văn bản. */}
      <dl className="mt-6 grid grid-cols-3 divide-x divide-line border-y border-line text-sm">
        <div className="py-3 pr-2 sm:pr-4">
          <dt className="text-sm text-ink-3">{kq.co_tu_luan ? "Số câu đạt" : "Số câu đúng"}</dt>
          <dd className="mt-1 text-base font-semibold tabular-nums">
            {kq.dung === null ? "—" : `${kq.dung}/${kq.tong}`}
          </dd>
        </div>
        <div className="py-3 px-2 sm:px-4">
          <dt className="text-sm text-ink-3">Thời gian làm</dt>
          <dd className="mt-1 text-base font-semibold tabular-nums">
            {kq.giay_lam_bai !== null ? dinhDangThoiLuong(kq.giay_lam_bai) : "—"}
          </dd>
        </div>
        <div className="py-3 px-2 sm:px-4">
          <dt className="text-sm text-ink-3">Lần làm</dt>
          <dd className="mt-1 text-base font-semibold tabular-nums">Lần {kq.lan_thu}</dd>
        </div>
      </dl>

      {kq.kieu_nop === "het_gio" ? (
        <Notice className="mt-4">Bài được hệ thống tự động nộp khi hết giờ làm bài.</Notice>
      ) : null}
      {kq.co_tu_luan && !choCham ? (
        <Notice tone="info" className="mt-4">
          Phần tự luận được chấm tự động theo tiêu chí và có thể được giảng viên đối chiếu. Thấy điểm chưa
          đúng, bạn có thể đề nghị phúc khảo với đơn vị tổ chức thi.
        </Notice>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink to="/thi">Về danh sách bài thi</ButtonLink>
      </div>

      {kq.chi_tiet ? (
        <section aria-labelledby="xem-lai" className="mt-10">
          <h2
            id="xem-lai"
            className="border-b-2 border-ink pb-2 font-sans text-base font-bold uppercase tracking-[0.04em]"
          >
            Xem lại bài làm
          </h2>
          <ol className="grid">
            {kq.chi_tiet.map((c) => {
              const tuLuan = c.de.kind === "tu_luan";
              const nhan = tuLuan
                ? c.trang_thai_cham && c.trang_thai_cham !== "xong"
                  ? "Chờ chấm"
                  : c.tra_loi?.bai_viet?.trim()
                    ? `Tự luận${c.cham_boi === "nguoi" ? ", giảng viên chấm" : c.cham_boi === "ai" ? ", chấm tự động" : ""}`
                    : "Chưa trả lời"
                : c.ket_qua.dung
                  ? "Đúng"
                  : c.tra_loi
                    ? "Sai"
                    : "Chưa trả lời";
              return (
                <li key={c.thu_tu} className="border-b border-line py-6">
                  <p className="mb-3 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold uppercase tracking-[0.06em] text-ink-3">
                    <span>
                      Câu {c.thu_tu} · {nhan}
                    </span>
                    {coDiemTho ? (
                      <span className="tabular-nums">
                        {c.diem === null ? "—" : diemSo(c.diem)} / {diemSo(c.diem_toi_da)} điểm
                      </span>
                    ) : null}
                  </p>
                  <HienThiCauHoi
                    de={c.de}
                    traLoi={c.tra_loi ?? {}}
                    ketQua={c.ket_qua}
                    idGoc={`xem-lai-${c.thu_tu}`}
                  />
                  {tuLuan && c.nhan_xet ? <NhanXet nx={c.nhan_xet} /> : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : (
        <p className="mt-8 text-sm text-ink-2">
          {kq.xem_dap_an_tu
            ? `Đáp án từng câu được mở sau hạn làm bài, từ ${formatNgayGio(kq.xem_dap_an_tu)}.`
            : "Đề thi này không cho xem lại đáp án từng câu."}
        </p>
      )}
    </KhungTrang>
  );
}

/** Nhận xét câu tự luận: tóm tắt, rồi điểm và nhận xét từng tiêu chí kèm đoạn trích làm bằng chứng. */
function NhanXet({ nx }: { nx: NhanXetTuLuan }) {
  return (
    <div className="mt-4 rounded-btn border border-line bg-surface-2 p-4">
      <p className="font-semibold text-ink">Nhận xét</p>
      {nx.tom_tat ? <p className="mt-1 text-base leading-relaxed text-ink">{nx.tom_tat}</p> : null}
      {nx.tieu_chi?.length ? (
        <ul className="mt-3 space-y-3">
          {nx.tieu_chi.map((tc) => (
            <li key={tc.ma} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
              <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{tc.ten}</span>
                <span className="tabular-nums text-ink-2">
                  {diemSo(tc.diem)}/{diemSo(tc.diem_toi_da)}
                </span>
              </p>
              {tc.nhan_xet ? <p className="mt-1 text-sm text-ink-2">{tc.nhan_xet}</p> : null}
              {tc.bang_chung ? (
                <blockquote className="mt-1 border-l-2 border-line-strong pl-3 text-sm text-ink-3 italic">
                  “{tc.bang_chung}”
                </blockquote>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
