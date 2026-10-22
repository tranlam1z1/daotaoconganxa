/**
 * Trang đầu khu quản trị: vài con số về cán bộ trong phạm vi quản lý và ba danh sách cán bộ cần chú
 * ý (chưa học lần nào, còn đề chưa nộp, có đề chưa đạt). Bấm tên để mở hồ sơ của người đó; danh
 * sách đầy đủ nằm ở trang Báo cáo. Số liệu do API tính trên báo cáo tiến độ học, không lọc ngày.
 */
import { Link } from "react-router";

import { TomTat } from "../components/quan-tri/BangBaoCao";
import { Notice } from "../components/ui/Field";
import { duongHoSoCanBo, type NhomCanChuY, soVn, type TongQuanCanBo } from "../lib/bao-cao";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import type { Route } from "./+types/quan-tri._index";

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "lanh_dao");
  try {
    return { tongQuan: await goiApiQuanTri<TongQuanCanBo>(token, "/v1/bao-cao/tong-quan"), loi: null };
  } catch (err) {
    // Tài khoản chưa gắn đơn vị (ví dụ Admin quản lý) không có phạm vi báo cáo: API trả 403. Vẫn
    // hiện trang với lời báo, để menu quản trị dùng được.
    if (err instanceof Response && err.status === 403) return { tongQuan: null, loi: await err.text() };
    if (err instanceof LoiApi) return { tongQuan: null, loi: err.message };
    throw err;
  }
}

export default function QuanTriIndex({ loaderData }: Route.ComponentProps) {
  const { tongQuan: t, loi } = loaderData;
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">Tổng quan</h2>
        {t ? <p className="text-sm text-ink-3">Phạm vi: {t.don_vi}</p> : null}
      </div>

      {loi ? <Notice className="mt-4">{loi}</Notice> : null}

      {t ? (
        <>
          <TomTat
            muc={[
              { nhan: "Cán bộ", giaTri: soVn(t.so_can_bo), phu: "xem danh sách", to: "/quan-tri/bao-cao" },
              {
                nhan: "Có học trong 7 ngày",
                giaTri: `${soVn(t.hoc_7_ngay)}/${soVn(t.so_can_bo)}`,
              },
              {
                nhan: "Tỷ lệ đạt bài thi",
                giaTri: soVn(t.bai_thi.ty_le_dat, "%"),
                phu: `đã nộp ${soVn(t.bai_thi.da_nop)}/${soVn(t.bai_thi.duoc_giao)} lượt giao`,
              },
              {
                nhan: "Chờ xác minh",
                giaTri: soVn(t.cho_xac_minh),
                phu: "tài khoản tự đăng ký",
                to: "/quan-tri/nguoi-dung?xac_minh=cho_duyet",
                canhBao: t.cho_xac_minh > 0,
              },
            ]}
          />

          <h3 className="mt-8 font-sans text-lg font-semibold">Cán bộ cần chú ý</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <TheCanChuY tieuDe="Chưa học lần nào" nhom={t.can_chu_y.chua_hoc} />
            <TheCanChuY tieuDe="Còn đề chưa nộp" nhom={t.can_chu_y.chua_lam_bai} donVi="đề" />
            <TheCanChuY tieuDe="Có đề chưa đạt" nhom={t.can_chu_y.khong_dat} donVi="đề" />
          </div>
        </>
      ) : null}
    </section>
  );
}

function TheCanChuY({ tieuDe, nhom, donVi }: { tieuDe: string; nhom: NhomCanChuY; donVi?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h4 className="flex items-baseline justify-between gap-2 font-sans text-base font-semibold">
        {tieuDe}
        <span className="tabular-nums text-ink-2">{soVn(nhom.tong)}</span>
      </h4>
      {nhom.tong === 0 ? (
        <p className="mt-2 text-sm text-ink-3">Không có ai.</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-line">
            {nhom.dong.map((d) => (
              <li key={d.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <Link to={duongHoSoCanBo(d.id)} className="font-semibold text-ink hover:underline">
                    {d.ho_ten}
                  </Link>
                  <span className="block text-ink-3">{d.don_vi}</span>
                </span>
                {d.so !== null && donVi ? (
                  <span className="shrink-0 tabular-nums text-ink-2">
                    {d.so} {donVi}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {nhom.tong > nhom.dong.length ? (
            <p className="mt-2 text-sm">
              <Link to="/quan-tri/bao-cao" className="text-primary underline">
                Xem cả {soVn(nhom.tong)} người ở trang Báo cáo
              </Link>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
