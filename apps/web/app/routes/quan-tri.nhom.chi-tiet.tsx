/**
 * Một nhóm học cùng cho cán bộ quản lý (docs/PLAN.md GĐ16c): thành viên trong phạm vi và tiến độ
 * từng mục, kết quả đề ôn tập, lần học gần nhất; số thành viên ngoài phạm vi. Quản lý lưu trữ được
 * nhóm có trưởng nhóm trong phạm vi (N11); API ghi nhật ký. Không sửa nội dung nhóm từ đây.
 *
 * GĐ16d: khối "Tóm tắt tiến độ" (AI-2) đặt trên bảng, luôn kèm câu cảnh báo đối chiếu với bảng.
 * Tóm tắt bị hậu kiểm loại thì chỉ hiện câu cố định; AI chưa bật thì không hiện khối.
 */
import { Form, Link, useFetcher, useNavigation } from "react-router";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Notice } from "../components/ui/Field";
import { soVn } from "../lib/bao-cao";
import { cn } from "../lib/cn";
import { formatDate, formatNgayGio } from "../lib/format";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/quan-tri.nhom.chi-tiet";

export function meta({ data }: Route.MetaArgs) {
  return pageMeta(data?.nhom.ten ?? "Nhóm học cùng", { index: false });
}

type TrangThaiMuc = "tinh" | "khong_con_xuat_ban" | "khong_du_cau";

/** Chép theo `ChiTietNhomQuanLy` ở packages/db/src/nhom-hoc.ts. */
interface ChiTietNhom {
  id: string;
  ten: string;
  mo_ta: string | null;
  trang_thai: "hoat_dong" | "luu_tru";
  tao_luc: string;
  luu_tru_luc: string | null;
  truong_nhom: string | null;
  so_trong_pham_vi: number;
  so_ngoai_pham_vi: number;
  trung_binh_trong_pham_vi: number | null;
  luu_tru_duoc: boolean;
  muc: Array<{
    id: string;
    loai: "bai_hoc" | "de_on_tap";
    ten: string;
    chu_de: string | null;
    so_cau: number | null;
    han_goi_y: string | null;
    trang_thai: TrangThaiMuc;
  }>;
  thanh_vien: Array<{
    id: string;
    ho_ten: string;
    cap_bac: string | null;
    don_vi: string | null;
    vai_tro: "truong_nhom" | "thanh_vien";
    phan_tram: number | null;
    muc: Record<string, number | null>;
    ket_qua_de: Record<string, { so_cau_dung: number; so_cau: number } | null>;
    lan_hoc_gan_nhat: string | null;
  }>;
  /** GĐ16d: false khi provider là mock ngoài môi trường test. */
  ai_bat?: boolean;
}

/** Kết quả `POST /v1/quan-tri/nhom/:id/ai/tom-tat`; họ tên, tên mục do máy chủ thay sau hậu kiểm. */
type TomTatAi =
  | {
      dat: true;
      tu_bo_nho_dem: boolean;
      canh_bao: string;
      nhan_xet: string[];
      muc_can_chu_y: Array<{ id: string; ten: string }>;
    }
  | { dat: false };

type KetQuaAction = { loi?: string; ok?: string; tomTat?: TomTatAi };

const MUC_KHONG_TINH: Record<Exclude<TrangThaiMuc, "tinh">, string> = {
  khong_con_xuat_ban: "Nội dung không còn được xuất bản",
  khong_du_cau: "Nội dung không còn đủ câu",
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  try {
    return { nhom: await goiApiQuanTri<ChiTietNhom>(token, `/v1/quan-tri/nhom/${params.id}`) };
  } catch (e) {
    if (e instanceof LoiApi && e.status === 404) throw new Response(e.message, { status: 404 });
    throw e;
  }
}

export async function action({ request, params }: Route.ActionArgs): Promise<KetQuaAction> {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const f = await request.formData();
  if (f.get("intent") === "tom_tat") {
    try {
      return {
        tomTat: await goiApiQuanTri<TomTatAi>(token, `/v1/quan-tri/nhom/${params.id}/ai/tom-tat`, {
          method: "POST",
        }),
      };
    } catch (e) {
      if (e instanceof LoiApi) return { loi: e.message };
      throw e;
    }
  }
  if (f.get("intent") !== "luu_tru") return { loi: "Thao tác không hợp lệ." };
  try {
    await goiApiQuanTri(token, `/v1/quan-tri/nhom/${params.id}/luu-tru`, { method: "POST" });
    return { ok: "Đã lưu trữ nhóm. Thành viên vẫn xem được nhóm nhưng không thao tác thêm được." };
  } catch (e) {
    if (e instanceof LoiApi) return { loi: e.message };
    throw e;
  }
}

/**
 * Khối "Tóm tắt tiến độ" (AI-2). Gửi bằng fetcher để không chung trạng thái với biểu mẫu lưu trữ.
 * Chỉ hiện câu nhận xét khi hậu kiểm đạt, luôn kèm câu cảnh báo cố định của máy chủ.
 */
function KhoiTomTatAi({ soThanhVien }: { soThanhVien: number }) {
  const f = useFetcher<KetQuaAction>();
  const dangGui = f.state !== "idle";
  const tt = f.data?.tomTat;

  return (
    <section
      aria-labelledby="tom-tat-ai"
      className="mt-6 rounded-xl border border-line bg-surface p-4"
      data-tom-tat-ai=""
    >
      <h3 id="tom-tat-ai" className="font-semibold">
        Tóm tắt tiến độ
      </h3>
      <div aria-busy={dangGui}>
        {tt?.dat ? (
          <div role="status">
            <p className="mt-2 text-sm font-medium text-warn">{tt.canh_bao}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {tt.nhan_xet.map((c) => (
                <li key={c} className="[overflow-wrap:anywhere]">
                  {c}
                </li>
              ))}
            </ul>
            {tt.muc_can_chu_y.length ? (
              <p className="mt-2 text-sm [overflow-wrap:anywhere]">
                <span className="font-medium">Mục cần chú ý:</span>{" "}
                {tt.muc_can_chu_y.map((m) => m.ten).join("; ")}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-2">
              Hệ thống dùng AI tóm tắt số liệu của {soThanhVien} thành viên trong phạm vi quản lý. Dữ liệu gửi
              đi chỉ có mã thay cho họ tên, không có đơn vị, cấp bậc.
            </p>
            {tt && !tt.dat ? (
              <Notice className="mt-3">
                Hệ thống chưa tóm tắt được tiến độ của nhóm này. Số liệu trong bảng dưới đây vẫn đầy đủ.
              </Notice>
            ) : null}
            {f.data?.loi ? (
              <Notice tone="danger" className="mt-3">
                {f.data.loi}
              </Notice>
            ) : null}
            {tt ? null : (
              <f.Form method="post" className="mt-3">
                <input type="hidden" name="intent" value="tom_tat" />
                <Button type="submit" variant="secondary" disabled={dangGui}>
                  {dangGui ? "Đang soạn tóm tắt" : "Tóm tắt tiến độ bằng AI"}
                </Button>
              </f.Form>
            )}
          </>
        )}
      </div>
    </section>
  );
}

const TH = "py-2 pr-3 font-medium";
const TD = "py-2 pr-3 align-top";
const SO = "text-right tabular-nums";

export default function QuanTriNhomChiTiet({ loaderData, actionData }: Route.ComponentProps) {
  const { nhom } = loaderData;
  const busy = useNavigation().state !== "idle";

  return (
    <section>
      <Link
        to="/quan-tri/nhom"
        className="hidden min-h-11 items-center text-sm text-primary hover:underline md:inline-flex"
      >
        Về danh sách nhóm
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold [overflow-wrap:anywhere]">{nhom.ten}</h2>
        <Badge tone={nhom.trang_thai === "hoat_dong" ? "ok" : "muted"}>
          {nhom.trang_thai === "hoat_dong" ? "Đang hoạt động" : "Đã lưu trữ"}
        </Badge>
      </div>
      {nhom.mo_ta ? (
        <p className="mt-2 whitespace-pre-line text-sm text-ink-2 [overflow-wrap:anywhere]">{nhom.mo_ta}</p>
      ) : null}
      <p className="mt-2 text-sm text-ink-2">
        Lập ngày {formatDate(nhom.tao_luc)}. Trưởng nhóm:{" "}
        {nhom.truong_nhom ?? "thuộc đơn vị ngoài phạm vi quản lý của tài khoản"}.
        {nhom.luu_tru_luc ? ` Lưu trữ ngày ${formatDate(nhom.luu_tru_luc)}.` : ""}
      </p>

      {actionData?.loi ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
        </Notice>
      ) : null}
      {actionData?.ok ? <Notice className="mt-4">{actionData.ok}</Notice> : null}

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Thành viên trong phạm vi", soVn(nhom.so_trong_pham_vi)],
            ["Thành viên ngoài phạm vi", soVn(nhom.so_ngoai_pham_vi)],
            ["Tiến độ trung bình", soVn(nhom.trung_binh_trong_pham_vi, "%")],
            ["Số mục", soVn(nhom.muc.length)],
          ] as const
        ).map(([nhan, giaTri]) => (
          <div key={nhan} className="rounded-xl border border-line bg-surface p-3">
            <dt className="text-sm text-ink-2">{nhan}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{giaTri}</dd>
          </div>
        ))}
      </dl>
      {nhom.so_ngoai_pham_vi > 0 ? (
        <p className="mt-3 text-sm text-ink-2">
          {nhom.so_ngoai_pham_vi} thành viên thuộc đơn vị ngoài phạm vi quản lý hoặc chưa gắn đơn vị: hệ thống
          chỉ hiện số lượng, không tính vào tiến độ trung bình.
        </p>
      ) : null}

      {nhom.ai_bat && nhom.thanh_vien.length > 0 ? (
        <KhoiTomTatAi soThanhVien={nhom.thanh_vien.length} />
      ) : null}

      <h3 className="mt-6 text-lg font-semibold">Mục trong nhóm</h3>
      {nhom.muc.length === 0 ? (
        <EmptyState gon icon="book" title="Nhóm chưa có bài học hay đề ôn tập nào" className="mt-2" />
      ) : (
        <ol className="mt-2 space-y-2">
          {nhom.muc.map((m, i) => (
            <li key={m.id} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
              <span className="font-semibold">Mục {i + 1}.</span>{" "}
              <span className="[overflow-wrap:anywhere]">{m.ten}</span>
              <span className="block text-ink-3">
                {m.loai === "bai_hoc" ? "Bài học" : `Đề ôn tập ${m.so_cau} câu`}
                {m.chu_de ? `, chủ đề ${m.chu_de}` : ""}
                {m.han_goi_y ? `. Hạn gợi ý ${formatDate(m.han_goi_y)}` : ""}
              </span>
              {m.trang_thai !== "tinh" ? (
                <span className="mt-1 block">
                  <Badge tone="warn">{MUC_KHONG_TINH[m.trang_thai]}</Badge>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      <h3 className="mt-6 text-lg font-semibold">Tiến độ thành viên trong phạm vi</h3>
      {nhom.thanh_vien.length === 0 ? (
        <div className="mt-2">
          <EmptyState icon="user" title="Không có thành viên nào trong phạm vi" />
        </div>
      ) : (
        <div className="bang-cuon mt-2 rounded-xl border border-line p-3">
          <table
            className="w-full text-left text-sm"
            style={{ minWidth: `${Math.max(36, 26 + nhom.muc.length * 5.5)}rem` }}
          >
            <thead className="text-ink-3">
              <tr>
                <th scope="col" className={cn(TH, "cot-dinh min-w-32 pl-1")}>
                  Họ tên
                </th>
                <th scope="col" className={cn(TH, SO)}>
                  Chung
                </th>
                {nhom.muc.map((m, i) => (
                  <th key={m.id} scope="col" className={cn(TH, SO, "whitespace-nowrap")}>
                    <abbr title={m.ten} className="no-underline">
                      Mục {i + 1}
                    </abbr>
                  </th>
                ))}
                <th scope="col" className={TH}>
                  Học gần nhất
                </th>
              </tr>
            </thead>
            <tbody>
              {nhom.thanh_vien.map((t) => (
                <tr key={t.id} className="border-t border-line">
                  <td className={cn(TD, "cot-dinh min-w-32 pl-1")}>
                    {t.ho_ten}
                    {t.vai_tro === "truong_nhom" ? (
                      <span className="ml-2">
                        <Badge tone="info">Trưởng nhóm</Badge>
                      </span>
                    ) : null}
                    <span className="block text-ink-3">
                      {[t.cap_bac, t.don_vi ?? "Chưa gắn đơn vị"].filter(Boolean).join(", ")}
                    </span>
                  </td>
                  <td className={cn(TD, SO, "font-semibold")}>{soVn(t.phan_tram, "%")}</td>
                  {nhom.muc.map((m) => {
                    const kq = t.ket_qua_de[m.id];
                    return (
                      <td key={m.id} className={cn(TD, SO)}>
                        {soVn(t.muc[m.id], "%")}
                        {kq ? (
                          <span className="block whitespace-nowrap text-ink-3">
                            {kq.so_cau_dung}/{kq.so_cau} đúng
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                  <td className={TD}>{formatNgayGio(t.lan_hoc_gan_nhat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-sm text-ink-2">
        Phần trăm tính lúc xem, từ tiến độ bài học và phiên đề ôn tập; mục không còn được tính để trống. Số
        câu đúng lấy phiên đã kết thúc có tỷ lệ đúng cao nhất. Lần học gần nhất gồm cả bài học, luyện tập và
        thi ngoài nhóm.{" "}
        <Link
          to={`/quan-tri/bao-cao?tab=tien-do-hoc&nhom=${nhom.id}`}
          className="text-primary hover:underline"
        >
          Xem báo cáo tiến độ học của nhóm
        </Link>
      </p>

      {nhom.trang_thai === "hoat_dong" ? (
        <div className="mt-6 rounded-xl border border-line bg-surface p-4">
          <h3 className="font-semibold">Lưu trữ nhóm</h3>
          {nhom.luu_tru_duoc ? (
            <Form
              method="post"
              className="mt-2"
              onSubmit={(e) => {
                if (
                  !confirm(
                    `Lưu trữ nhóm "${nhom.ten}"? Thành viên chỉ còn xem được nhóm: không chia sẻ bài, không làm đề mới trong nhóm, không cổ vũ, không nhận thêm thành viên. Hệ thống chưa có chức năng mở lại nhóm đã lưu trữ.`,
                  )
                )
                  e.preventDefault();
              }}
            >
              <p className="text-sm text-ink-2">
                Nhóm đã lưu trữ chỉ còn xem được. Việc lưu trữ được ghi vào nhật ký quản trị.
              </p>
              <input type="hidden" name="intent" value="luu_tru" />
              <Button type="submit" variant="secondary" className="mt-3" disabled={busy}>
                {busy ? "Đang lưu trữ" : "Lưu trữ nhóm"}
              </Button>
            </Form>
          ) : (
            <p className="mt-2 text-sm text-ink-2">
              Trưởng nhóm thuộc đơn vị ngoài phạm vi quản lý của tài khoản, nên tài khoản này không lưu trữ
              được nhóm.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
