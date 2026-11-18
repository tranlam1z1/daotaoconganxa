/**
 * Một nhóm học cùng `/nhom/:id` (docs/PLAN.md GĐ16b).
 *
 * Đầu trang: tên nhóm, tiến độ của tôi, trung bình nhóm, nút "Học tiếp" tới mục đầu tiên chưa xong.
 * Phần "Bài trong nhóm" và "Thành viên". Mọi thao tác đi qua action của trang này; hộp thoại gửi
 * bằng fetcher nên lỗi hiện ngay trong hộp. Nhóm đã lưu trữ chỉ còn xem được.
 */
import { Link, redirect } from "react-router";
import { DanhSachMuc, NutHocMuc } from "../components/nhom/DanhSachMuc";
import { DanhSachThanhVien } from "../components/nhom/DanhSachThanhVien";
import { HopChiaSe } from "../components/nhom/HopChiaSe";
import { type GoiYThuTu, HopGoiYThuTu, type KetQuaGoiYThuTu } from "../components/nhom/HopGoiYThuTu";
import { HopMoiThanhVien } from "../components/nhom/HopMoiThanhVien";
import { HopSuaNhom } from "../components/nhom/HopSuaNhom";
import { HopTienDoThanhVien } from "../components/nhom/HopTienDoThanhVien";
import { HopTuyChonMuc } from "../components/nhom/HopTuyChonMuc";
import { HopXacNhanNhom, type XacNhanNhom } from "../components/nhom/HopXacNhanNhom";
import { ThanhPhanTram } from "../components/nhom/ThanhPhanTram";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Notice } from "../components/ui/Field";
import { useHop } from "../components/ui/HopThoai";
import { KhungTrang, TieuDeTrang } from "../components/ui/KhungTrang";
import type { ChiTietNhom as DuLieuNhom, KetQuaThaoTacNhom, MucNhom, ThanhVienNhom } from "../lib/nhom";
import {
  batDauMuc,
  chiaSeMuc,
  chiTietNhom,
  chuyenTruongNhom,
  coVu,
  datHanGoiY,
  doiMaMoi,
  goMuc,
  luuTruNhom,
  moiRaKhoiNhom,
  roiNhom,
  sapThuTu,
  suaNhom,
} from "../lib/nhom.server";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/nhom.chi-tiet";

export function meta({ data }: Route.MetaArgs) {
  return pageMeta(data?.nhom.ten ?? "Nhóm học cùng", { index: false });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  try {
    // `ai_bat` (GĐ16d): API tắt AI khi provider là mock ngoài môi trường test; khi đó không hiện nút.
    const nhom = (await chiTietNhom(token, params.id)) as DuLieuNhom & { ai_bat?: boolean };
    return { nhom, aiBat: nhom.ai_bat === true };
  } catch (err) {
    // Không phải thành viên (hoặc nhóm không tồn tại): API trả 404, trang báo không tìm thấy.
    if (err instanceof LoiApi && err.status === 404) throw new Response(err.message, { status: 404 });
    throw err;
  }
}

const chu = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function action({
  request,
  params,
}: Route.ActionArgs): Promise<KetQuaThaoTacNhom | KetQuaGoiYThuTu | Response> {
  const { token } = await yeuCauDangNhap(request);
  const f = await request.formData();
  const intent = chu(f, "intent");
  const id = params.id;
  const xong = { intent, ok: true } as const;
  try {
    switch (intent) {
      case "co-vu":
        return { ...xong, coVu: await coVu(token, id, chu(f, "account_id")) };
      case "bat-dau": {
        const kq = await batDauMuc(token, id, chu(f, "item_id"));
        return redirect(kq.loai === "bai_hoc" ? kq.duong_dan : `/luyen-tap/${kq.phien_id}`);
      }
      case "chia-se-bai":
        await chiaSeMuc(token, id, { loai: "bai_hoc", lesson_id: chu(f, "lesson_id") });
        return xong;
      case "chia-se-de":
        await chiaSeMuc(token, id, {
          loai: "de_on_tap",
          topic_id: chu(f, "topic_id"),
          so_cau: Number(chu(f, "so_cau")),
          ten: chu(f, "ten"),
        });
        return xong;
      case "go-muc":
        await goMuc(token, id, chu(f, "item_id"));
        return xong;
      case "thu-tu": {
        const ds = chu(f, "item_ids");
        if (!ds) return { intent, loi: "Mục này không chuyển được theo hướng đó." };
        await sapThuTu(token, id, JSON.parse(ds) as string[]);
        return xong;
      }
      case "goi-y-thu-tu": {
        // Chỉ xem trước; áp dụng đi qua intent `thu-tu` ở trên.
        const goiY = await goiApiQuanTri<GoiYThuTu>(token, `/v1/nhom/${encodeURIComponent(id)}/ai/thu-tu`, {
          method: "POST",
        });
        return { ...xong, goiY };
      }
      case "dat-han":
        await datHanGoiY(token, id, chu(f, "item_id"), f.get("bo_han") ? null : chu(f, "han_goi_y") || null);
        return xong;
      case "roi":
        await roiNhom(token, id);
        return redirect("/nhom");
      case "moi-ra":
        await moiRaKhoiNhom(token, id, chu(f, "account_id"));
        return xong;
      case "truong-nhom":
        await chuyenTruongNhom(token, id, chu(f, "account_id"));
        return xong;
      case "doi-ma":
        await doiMaMoi(token, id);
        return xong;
      case "luu-tru":
        await luuTruNhom(token, id);
        return xong;
      case "sua":
        await suaNhom(token, id, { ten: chu(f, "ten"), mo_ta: chu(f, "mo_ta").trim() || null });
        return xong;
      default:
        return { intent, loi: "Thao tác không hợp lệ." };
    }
  } catch (err) {
    if (err instanceof LoiApi) return { intent, loi: err.message };
    throw err;
  }
}

type TenHop = "chia-se" | "goi-y" | "moi" | "sua" | "tien-do" | "tuy-chon" | "xac-nhan";
interface DuLieuHop {
  thanhVien?: ThanhVienNhom;
  muc?: MucNhom;
  xacNhan?: XacNhanNhom;
}

export default function ChiTietNhom({ loaderData }: Route.ComponentProps) {
  const { nhom, aiBat } = loaderData;
  const hop = useHop<TenHop, DuLieuHop>();
  const choGhi = nhom.trang_thai === "hoat_dong";
  const laTruongNhom = nhom.vai_tro_cua_toi === "truong_nhom";
  const hocTiep = nhom.muc.find((m) => m.trang_thai === "tinh" && (m.phan_tram_cua_toi ?? 0) < 100);
  const tvDangXem = hop.duLieu?.thanhVien ?? null;

  const xacNhan = (x: XacNhanNhom) => hop.mo("xac-nhan", { xacNhan: x });

  return (
    <KhungTrang className="wrap max-w-3xl py-6" data-nhom="">
      <p className="hidden text-sm md:block">
        <Link to="/nhom" className="inline-flex min-h-12 items-center text-primary hover:underline">
          Nhóm học cùng
        </Link>
      </p>
      <TieuDeTrang icon="nhom" className="break-words">
        {nhom.ten}
      </TieuDeTrang>
      {nhom.mo_ta ? (
        <p className="mt-2 whitespace-pre-line break-words text-base leading-relaxed text-ink-2">
          {nhom.mo_ta}
        </p>
      ) : null}
      {!choGhi ? <Notice className="mt-4">Nhóm đã lưu trữ, chỉ còn xem được.</Notice> : null}

      <section
        aria-labelledby="tien-do-cua-toi"
        className="mt-5 rounded-card border border-line bg-surface p-4"
      >
        <h2 id="tien-do-cua-toi" className="font-sans text-base font-semibold">
          Tiến độ của tôi
        </h2>
        <div className="mt-2">
          <ThanhPhanTram giaTri={nhom.phan_tram_cua_toi} nhan="Tiến độ chung của tôi trong nhóm" />
        </div>
        <p className="mt-2 text-sm text-ink-2">
          {nhom.trung_binh_nhom === null
            ? "Nhóm chưa có bài nào."
            : `Trung bình nhóm: ${nhom.trung_binh_nhom}%`}
        </p>
        {choGhi && hocTiep ? (
          <div className="mt-4">
            <NutHocMuc muc={hocTiep} chinh nhan={`Học tiếp: ${hocTiep.ten}`} />
          </div>
        ) : null}
      </section>

      {choGhi ? (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button size="lg" variant="secondary" onClick={() => hop.mo("chia-se")} aria-haspopup="dialog">
            Chia sẻ vào nhóm
          </Button>
          <Button size="lg" variant="secondary" onClick={() => hop.mo("moi")} aria-haspopup="dialog">
            Mời thành viên
          </Button>
        </div>
      ) : null}

      <section aria-labelledby="bai-trong-nhom" className="mt-8">
        <h2 id="bai-trong-nhom" className="font-sans text-lg font-semibold">
          Bài trong nhóm ({nhom.muc.length})
        </h2>
        {choGhi && laTruongNhom && aiBat && nhom.muc.length >= 2 ? (
          <div className="mt-3">
            <Button
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => hop.mo("goi-y")}
              aria-haspopup="dialog"
            >
              Gợi ý thứ tự học
            </Button>
          </div>
        ) : null}
        <div className="mt-3">
          {nhom.muc.length ? (
            <DanhSachMuc
              muc={nhom.muc}
              laTruongNhom={laTruongNhom}
              choGhi={choGhi}
              onTuyChon={(m) => hop.mo("tuy-chon", { muc: m })}
            />
          ) : (
            <EmptyState icon="book" title="Nhóm chưa có bài nào">
              <p>Thành viên nào cũng chia sẻ được bài học đã xuất bản hoặc đề ôn tập từ ngân hàng câu hỏi.</p>
            </EmptyState>
          )}
        </div>
      </section>

      <section aria-labelledby="thanh-vien" className="mt-8">
        <h2 id="thanh-vien" className="font-sans text-lg font-semibold">
          Thành viên ({nhom.thanh_vien.length})
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          Thành viên chỉ thấy phần trăm tiến độ của nhau, không thấy điểm.
        </p>
        <div className="mt-3">
          <DanhSachThanhVien
            thanhVien={nhom.thanh_vien}
            choGhi={choGhi}
            onXemTienDo={(t) => hop.mo("tien-do", { thanhVien: t })}
          />
        </div>
      </section>

      {choGhi ? (
        <section aria-labelledby="quan-ly-nhom" className="mt-8 grid gap-2 border-t border-line pt-6">
          <h2 id="quan-ly-nhom" className="sr-only">
            Thao tác với nhóm
          </h2>
          {laTruongNhom ? (
            <>
              <Button size="lg" variant="secondary" onClick={() => hop.mo("sua")} aria-haspopup="dialog">
                Sửa tên và mô tả
              </Button>
              <Button
                size="lg"
                variant="secondary"
                aria-haspopup="dialog"
                onClick={() =>
                  xacNhan({
                    tieuDe: "Lưu trữ nhóm",
                    noiDung:
                      "Nhóm chuyển sang chỉ xem: không chia sẻ thêm bài, không tham gia thêm, không cổ vũ được. Kết quả học của mọi người vẫn giữ nguyên. Không mở lại được nhóm đã lưu trữ.",
                    nhanNut: "Lưu trữ nhóm",
                    intent: "luu-tru",
                  })
                }
              >
                Lưu trữ nhóm
              </Button>
            </>
          ) : null}
          <Button
            size="lg"
            variant="ghost"
            aria-haspopup="dialog"
            onClick={() =>
              xacNhan({
                tieuDe: "Rời nhóm",
                noiDung: laTruongNhom
                  ? "Trưởng nhóm cần chuyển quyền cho một thành viên khác trước khi rời, trừ khi là người cuối cùng. Người cuối cùng rời thì nhóm tự lưu trữ."
                  : "Bạn không còn thấy nhóm này. Tiến độ của bạn không còn hiện với thành viên khác. Muốn vào lại thì cần mã mời.",
                nhanNut: "Rời nhóm",
                intent: "roi",
              })
            }
          >
            Rời nhóm
          </Button>
        </section>
      ) : null}

      <HopChiaSe key={`chia-se-${hop.lan}`} mo={hop.la("chia-se")} onDong={hop.dong} nhomId={nhom.id} />
      <HopGoiYThuTu key={`goi-y-${hop.lan}`} mo={hop.la("goi-y")} onDong={hop.dong} muc={nhom.muc} />
      <HopMoiThanhVien
        key={`moi-${hop.lan}`}
        mo={hop.la("moi")}
        onDong={hop.dong}
        ma={nhom.ma_moi}
        laTruongNhom={laTruongNhom}
      />
      <HopSuaNhom
        key={`sua-${hop.lan}`}
        mo={hop.la("sua")}
        onDong={hop.dong}
        ten={nhom.ten}
        moTa={nhom.mo_ta}
      />
      <HopTienDoThanhVien
        key={`tien-do-${hop.lan}`}
        mo={hop.la("tien-do")}
        onDong={hop.dong}
        nhomId={nhom.id}
        thanhVien={tvDangXem}
        quanLy={choGhi && laTruongNhom && Boolean(tvDangXem && !tvDangXem.la_toi)}
        onChuyenQuyen={(t) =>
          xacNhan({
            tieuDe: "Chuyển quyền trưởng nhóm",
            noiDung: `${t.ho_ten} trở thành trưởng nhóm. Bạn trở thành thành viên và không còn sắp thứ tự, đổi mã mời, lưu trữ nhóm được.`,
            nhanNut: "Chuyển quyền",
            intent: "truong-nhom",
            truong: { account_id: t.id },
          })
        }
        onMoiRa={(t) =>
          xacNhan({
            tieuDe: "Mời ra khỏi nhóm",
            noiDung: `${t.ho_ten} không còn ở trong nhóm và không còn thấy nhóm. Người này vào lại được nếu có mã mời hiện tại.`,
            nhanNut: "Mời ra khỏi nhóm",
            intent: "moi-ra",
            truong: { account_id: t.id },
          })
        }
      />
      <HopTuyChonMuc
        key={`tuy-chon-${hop.lan}`}
        mo={hop.la("tuy-chon")}
        onDong={hop.dong}
        muc={nhom.muc.find((m) => m.id === hop.duLieu?.muc?.id) ?? null}
        thuTu={nhom.muc.map((m) => m.id)}
        laTruongNhom={laTruongNhom}
        onGo={(m) =>
          xacNhan({
            tieuDe: "Gỡ mục khỏi nhóm",
            noiDung: `"${m.ten}" không còn hiện trong nhóm và không tính vào tiến độ nhóm. Kết quả học của từng người vẫn giữ nguyên.`,
            nhanNut: "Gỡ khỏi nhóm",
            intent: "go-muc",
            truong: { item_id: m.id },
          })
        }
      />
      <HopXacNhanNhom
        key={`xac-nhan-${hop.lan}`}
        mo={hop.la("xac-nhan")}
        onDong={hop.dong}
        xacNhan={hop.duLieu?.xacNhan ?? null}
      />
    </KhungTrang>
  );
}
