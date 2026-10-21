/**
 * Nhóm học cùng của tôi (docs/PLAN.md GĐ16b). Hai việc chính: "Tạo nhóm" và "Nhập mã mời", cả hai
 * mở hộp thoại. Mỗi nhóm hiện số thành viên, phần trăm của tôi và phần trăm trung bình nhóm.
 */
import { Link, redirect } from "react-router";

import { HopTaoNhom } from "../components/nhom/HopTaoNhom";
import { HopThamGia } from "../components/nhom/HopThamGia";
import { ThanhPhanTram } from "../components/nhom/ThanhPhanTram";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { useHop } from "../components/ui/HopThoai";
import { Icon } from "../components/ui/Icon";
import type { KetQuaThaoTacNhom } from "../lib/nhom";
import { nhomCuaToi, taoNhom, thamGiaNhom, xemTruocNhom } from "../lib/nhom.server";
import { LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/nhom";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Nhóm học cùng", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  const { items } = await nhomCuaToi(token);
  return { nhom: items };
}

/** Chuẩn hóa mã người dùng gõ như API: bỏ khoảng trắng và gạch nối, viết hoa. */
const chuanHoaMa = (s: string) => s.replace(/[\s-]/g, "").toUpperCase();

export async function action({ request }: Route.ActionArgs): Promise<KetQuaThaoTacNhom | Response> {
  const { token } = await yeuCauDangNhap(request);
  const f = await request.formData();
  const intent = String(f.get("intent") ?? "");
  try {
    if (intent === "tao") {
      const moTa = String(f.get("mo_ta") ?? "").trim();
      const taoXong = await taoNhom(token, {
        ten: String(f.get("ten") ?? ""),
        ...(moTa ? { mo_ta: moTa } : {}),
      });
      return { intent, ok: true, taoXong };
    }
    if (intent === "xem-truoc") {
      const ma = chuanHoaMa(String(f.get("ma") ?? ""));
      if (!ma) return { intent, loi: "Nhập mã mời gồm 8 ký tự." };
      return { intent, ok: true, xemTruoc: await xemTruocNhom(token, ma), ma };
    }
    if (intent === "tham-gia") {
      const { id } = await thamGiaNhom(token, chuanHoaMa(String(f.get("ma") ?? "")));
      return redirect(`/nhom/${id}`);
    }
    return { intent, loi: "Thao tác không hợp lệ." };
  } catch (err) {
    if (err instanceof LoiApi) return { intent, loi: err.message };
    throw err;
  }
}

export default function NhomCuaToi({ loaderData }: Route.ComponentProps) {
  const { nhom } = loaderData;
  const hop = useHop<"tao" | "tham-gia">();

  const nutChinh = (
    <div className="grid gap-2 sm:flex">
      <Button size="lg" onClick={() => hop.mo("tao")} aria-haspopup="dialog">
        Tạo nhóm
      </Button>
      <Button size="lg" variant="secondary" onClick={() => hop.mo("tham-gia")} aria-haspopup="dialog">
        Nhập mã mời
      </Button>
    </div>
  );

  return (
    <div className="wrap max-w-3xl py-8 lg:max-w-7xl" data-nhom="">
      <p className="hidden text-sm md:block">
        <Link to="/luyen-tap" className="inline-flex min-h-11 items-center text-primary hover:underline">
          Học & luyện tập
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold lg:text-4xl">Nhóm học cùng</h1>
      <p className="mt-2 text-base leading-relaxed text-ink-2 lg:max-w-3xl">
        Học cùng đồng đội: chia sẻ bài học và đề ôn tập vào nhóm, theo dõi phần trăm tiến độ của từng người.
        Thành viên không thấy điểm của nhau.
      </p>

      {nhom.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon="nhom" title="Bạn chưa ở trong nhóm nào">
            <p>Tạo một nhóm rồi gửi mã mời cho đồng đội, hoặc nhập mã mời đồng đội gửi cho bạn.</p>
            <div className="mt-4">{nutChinh}</div>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-6">{nutChinh}</div>
          <ul className="mt-6 grid gap-3 lg:grid-cols-2">
            {nhom.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/nhom/${g.id}`}
                  className="block min-h-12 rounded-xl border border-line bg-surface p-4 the-bam"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words text-base font-semibold">{g.ten}</span>
                    <Icon name="nhom" className="size-6 shrink-0 text-primary" />
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
                    {g.so_thanh_vien} thành viên
                    {g.trung_binh_nhom !== null ? ` · Trung bình nhóm ${g.trung_binh_nhom}%` : ""}
                    {g.vai_tro === "truong_nhom" ? <Badge tone="info">Trưởng nhóm</Badge> : null}
                    {g.trang_thai === "luu_tru" ? <Badge>Đã lưu trữ</Badge> : null}
                  </span>
                  <div className="mt-3">
                    <ThanhPhanTram
                      giaTri={g.phan_tram_cua_toi}
                      nhan={`Tiến độ của tôi trong nhóm ${g.ten}`}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <HopTaoNhom key={`tao-${hop.lan}`} mo={hop.la("tao")} onDong={hop.dong} />
      <HopThamGia key={`tham-gia-${hop.lan}`} mo={hop.la("tham-gia")} onDong={hop.dong} />
    </div>
  );
}
