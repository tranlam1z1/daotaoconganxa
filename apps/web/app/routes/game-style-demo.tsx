/**
 * Trang duyệt phong cách trò chơi `/game-style-demo` (docs/VISUAL_STYLE.md §7): hiện đủ 10 hiệu ứng
 * chuẩn và hai hiệu ứng riêng của Súng bắn tốc độ, mỗi hiệu ứng có nút "Chạy lại", cùng công tắc âm
 * thanh, rung, giảm hiệu ứng và sáng/tối, để xem trên điện thoại trước khi áp dụng.
 *
 * Chỉ để duyệt: không có trong menu, cần vai trò biên tập trở lên (câu V6). Dữ liệu trên trang là
 * dữ liệu mẫu cố định, không gọi API trò chơi, không ghi gì.
 */
import { type ReactNode, useState } from "react";
import { Link } from "react-router";

import { ThemeToggle } from "../components/layout/ThemeToggle";
import { CamBien } from "../components/tro-choi/CamBien";
import { DongHoBuoc } from "../components/tro-choi/DongHoBuoc";
import {
  datCaiDatGame,
  useCaiDatGame,
  useHeThongGiamChuyenDong,
} from "../components/tro-choi/hieu-ung/cai-dat";
import { DauMan } from "../components/tro-choi/hieu-ung/DauMan";
import { HuyHieuLat, LopChucMung } from "../components/tro-choi/hieu-ung/LopChucMung";
import { NhanCombo } from "../components/tro-choi/hieu-ung/NhanCombo";
import { NutCaiDatGame } from "../components/tro-choi/hieu-ung/NutCaiDatGame";
import { PhaoHoa } from "../components/tro-choi/hieu-ung/PhaoHoa";
import { VungTroChoi } from "../components/tro-choi/hieu-ung/VungTroChoi";
import { PhanHoiBuoc } from "../components/tro-choi/PhanHoiBuoc";
import { SoiCamera } from "../components/tro-choi/SoiCamera";
import { TongKetLuot } from "../components/tro-choi/TongKetLuot";
import { type DeSungBanWeb, XeQuaChot } from "../components/tro-choi/XeQuaChot";
import type { DeCamBien } from "../lib/cam-bien";
import { cn } from "../lib/cn";
import type { KetQuaBuocWeb, LuotChoiWeb } from "../lib/luot-choi";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { DeSoiCamera } from "../lib/soi-camera";
import type { Route } from "./+types/game-style-demo";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Duyệt phong cách trò chơi", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  await yeuCauVaiTro(request, "bien_tap");
  return null;
}

/* ------------------------------------------------------------------ */
/* Dữ liệu mẫu                                                         */
/* ------------------------------------------------------------------ */

const KQ_DUNG: KetQuaBuocWeb = {
  diem: 10,
  thuong: 3.8,
  diem_toi_da: 10,
  dung: true,
  het_gio: false,
  thoi_gian_ms: 5000,
  giai_thich: "Câu giải thích mẫu: trả lời đúng nhờ đọc kỹ điều khoản.",
  can_cu: [],
  chi_tiet: null,
};
const KQ_SAI: KetQuaBuocWeb = {
  ...KQ_DUNG,
  diem: 0,
  thuong: 0,
  dung: false,
  giai_thich: "Câu giải thích mẫu cho trường hợp chưa đúng.",
};

const LUOT_MAU: LuotChoiWeb = {
  id: "mau",
  ma: "thu_nghiem",
  ten: "Trắc nghiệm nhanh",
  man: null,
  ca_luot_ms: null,
  con_lai_luot_ms: null,
  trang_thai: "xong",
  offline: false,
  bat_dau: new Date(0).toISOString(),
  ket_thuc: new Date(0).toISOString(),
  so_buoc: 3,
  buoc_hien_tai: null,
  da_choi: [],
  tong_ket: { diem: 30, thuong: 12.4, diem_toi_da: 30, ty_le: 1, sao: 3, so_dung: 3, xp: 10 },
};

/** Đoạn đường mẫu cho mục trình diễn M6, M2 (dữ liệu trình diễn, không phải nội dung trò chơi). */
/** Đoạn phim mẫu cho mục trình diễn camera (dữ liệu trình diễn, không phải nội dung trò chơi). */
const DE_SOI_CAMERA_MAU: DeSoiCamera = {
  man: 1,
  kich_ban: {
    muc: 1,
    ban_dem: false,
    gio_bat_dau: "07:42:10",
    thoi_luong: 20,
    den: { xanh: 6, vang: 3, do: 20, lech: 0 },
    vung_cam_dung: [{ lan: "nam-oto", y_tu: 5, y_den: 22 }],
    xe: [
      { id: "x1", loai: "o_to", lan: "bac-oto", vao: 0 },
      { id: "x2", loai: "xe_may", lan: "bac-xm", vao: 1, toc_do: 35, mu_bao_hiem: false },
      { id: "x3", loai: "o_to", lan: "nam-oto", vao: 4, khong_dung_den: true },
    ],
  },
  toc_do_phat: 1,
  so_lan_tua: 3,
  the_loi: [
    { ma: "vuot_den_do", ten: "Vượt đèn đỏ" },
    { ma: "sai_lan", ten: "Đi sai làn đường" },
    { ma: "dung_do_sai", ten: "Dừng xe sai nơi quy định" },
    { ma: "khong_mu_bao_hiem", ten: "Không đội mũ bảo hiểm" },
  ],
};

const DE_CAM_BIEN_MAU: DeCamBien = {
  man: 2,
  so_o: 8,
  dac_diem: [
    { o: 3, loai: "truong_hoc", ten: "Trường học" },
    { o: 6, loai: "duong_sat_khong_rao", ten: "Đường sắt không có rào chắn" },
  ],
  vi_tri: [
    { id: "a", o: 1, ben: "phai", toi_da: 1, so: 1 },
    { id: "b", o: 5, ben: "phai", toi_da: 1, so: 2 },
  ],
  khay: [
    { ma: "W.225", ten: "Trẻ em", nhom: "nguy_hiem", anh: "W.225.svg", phan_ung: "giam_toc" },
    {
      ma: "W.211a",
      ten: "Giao nhau với đường sắt không có rào chắn",
      nhom: "nguy_hiem",
      anh: "W.211a.svg",
      phan_ung: "giam_toc",
    },
    { ma: "I.408", ten: "Nơi đỗ xe", nhom: "chi_dan", anh: "I.408.svg", phan_ung: "di_tiep" },
    { ma: "P.102", ten: "Cấm đi ngược chiều", nhom: "cam", anh: "P.102.svg", phan_ung: "khong_vao" },
  ],
  so_lan_chay: 3,
};

const XE_MAU: DeSungBanWeb = {
  loai_xe: "o_to",
  ten_loai_xe: "Ô tô",
  mo_ta_xe: "Xe ô tô con màu trắng (mẫu)",
  boi_canh: "Đoạn đường có biển P.127 giới hạn 60 km/h",
  bien_toc_do: 60,
  toc_do_do: 78,
  lua_chon_khung: [],
  lua_chon_bo_sung: [],
};

/* ------------------------------------------------------------------ */
/* Khung một hiệu ứng                                                  */
/* ------------------------------------------------------------------ */

function HieuUng({
  so,
  ten,
  moTa,
  children,
}: {
  so: string;
  ten: string;
  moTa: string;
  children: (lan: number) => ReactNode;
}) {
  const [lan, datLan] = useState(0);
  return (
    <section aria-labelledby={`hu-${so}`} className="g-the p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`hu-${so}`} className="g-tieu-de text-lg font-semibold">
            {so}. {ten}
          </h2>
          <p className="mt-0.5 text-sm text-ink-2">{moTa}</p>
        </div>
        <button
          type="button"
          onClick={() => datLan((n) => n + 1)}
          className="min-h-11 shrink-0 rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold"
        >
          Chạy lại
        </button>
      </div>
      <div key={lan} className="mt-4">
        {children(lan)}
      </div>
    </section>
  );
}

function CongTac({
  bat,
  nhan,
  moTa,
  onClick,
}: {
  bat: boolean;
  nhan: string;
  moTa?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={bat}
      onClick={onClick}
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 text-left"
    >
      <span>
        <span className="block font-medium">{nhan}</span>
        {moTa ? <span className="block text-xs text-ink-2">{moTa}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className={cn("relative h-7 w-12 shrink-0 rounded-full", bat ? "bg-primary" : "bg-line-strong")}
      >
        <span
          className="absolute top-1 size-5 rounded-full bg-surface"
          style={{ left: bat ? "1.5rem" : "0.25rem", transition: "left var(--td-nhanh) var(--cong-chuan)" }}
        />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Trang                                                               */
/* ------------------------------------------------------------------ */

export default function GameStyleDemo() {
  const cd = useCaiDatGame();
  const heThong = useHeThongGiamChuyenDong();
  const [combo, datCombo] = useState(3);
  const [chucMung, datChucMung] = useState<null | "len_cap" | "huy_hieu">(null);
  const [hetGio, datHetGio] = useState(false);
  const [cau, datCau] = useState(1);

  return (
    <VungTroChoi>
      <div className="wrap g-dau-trang max-w-xl py-6">
        <p className="hidden text-sm md:block">
          <Link to="/tro-choi" className="inline-flex min-h-11 items-center text-ink-2 underline">
            Trò chơi
          </Link>
        </p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="g-a g-vao-xuong text-2xl font-semibold">Duyệt phong cách trò chơi</h1>
          <NutCaiDatGame />
        </div>
        <p className="mt-1 text-[15px] text-ink-2">
          Hướng A "Cảnh phục" (docs/VISUAL_STYLE.md). Trang chỉ để xem, dữ liệu là mẫu.
        </p>

        <section aria-labelledby="cong-tac" className="mt-5 grid gap-2">
          <h2 id="cong-tac" className="sr-only">
            Công tắc
          </h2>
          <CongTac
            bat={cd.amThanh}
            nhan="Âm thanh"
            moTa="Mặc định tắt"
            onClick={() => datCaiDatGame("amThanh", !cd.amThanh)}
          />
          <CongTac
            bat={cd.rung}
            nhan="Rung"
            moTa="Mặc định bật; iPhone không hỗ trợ"
            onClick={() => datCaiDatGame("rung", !cd.rung)}
          />
          <CongTac
            bat={cd.giamHieuUng}
            nhan="Giảm hiệu ứng"
            moTa={
              heThong
                ? "Hệ điều hành đang bật giảm chuyển động"
                : "Áp dụng như cài đặt giảm chuyển động của máy"
            }
            onClick={() => datCaiDatGame("giamHieuUng", !cd.giamHieuUng)}
          />
          <div className="flex min-h-12 items-center justify-between rounded-lg border border-line bg-surface px-4">
            <span className="font-medium">Sáng, tối</span>
            <ThemeToggle />
          </div>
        </section>

        <section aria-labelledby="bang-mau" className="g-the mt-5 p-4">
          <h2 id="bang-mau" className="g-tieu-de text-lg font-semibold">
            Màu, nút, thẻ
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            {[
              ["Chính", "var(--primary)", "var(--on-primary)"],
              ["Nhấn", "var(--g-nhan)", "var(--g-tren-nhan)"],
              ["Đúng", "var(--ok)", "var(--surface)"],
              ["Sai", "var(--danger)", "var(--surface)"],
              ["Nền", "var(--canvas)", "var(--ink)"],
              ["Thẻ", "var(--surface)", "var(--ink)"],
            ].map(([ten, nen, chu]) => (
              <span
                key={ten}
                className="grid h-14 place-items-center rounded-lg border border-line font-semibold"
                style={{ background: nen, color: chu }}
              >
                {ten}
              </span>
            ))}
          </div>
          <button
            type="button"
            className="g-nut mt-4 inline-flex w-full items-center justify-center bg-primary px-5 text-on-primary"
          >
            Nút chính (bấm thử)
          </button>
          <p className="g-so mt-3 text-3xl font-bold">
            0123456789 <span className="font-sans text-base font-normal">số đều bề rộng, font Lexend</span>
          </p>
        </section>

        <div className="mt-5 grid gap-4">
          <HieuUng so="1" ten="Vào màn" moTa="Dải mở đầu trượt xuống, thẻ câu hỏi trượt lên.">
            {() => (
              <>
                <DauMan ten="Trắc nghiệm nhanh" moTa="3 câu · 20 giây mỗi câu." />
                <div className="g-a g-vao-len g-the p-4" style={{ "--tre": "120ms" } as React.CSSProperties}>
                  <p className="font-medium">Thẻ câu hỏi mẫu</p>
                  <p className="text-sm text-ink-2">Các phần bên trong hiện lần lượt.</p>
                </div>
              </>
            )}
          </HieuUng>

          <HieuUng
            so="2"
            ten="Trả lời đúng"
            moTa="Dấu tích vẽ nét, điểm bay lên, âm hai nốt đi lên, rung 15ms."
          >
            {() => <PhanHoiBuoc ketQua={KQ_DUNG} coMang={false} />}
          </HieuUng>

          <HieuUng so="3" ten="Trả lời sai" moTa="Thẻ rung ngang 3 nhịp, dấu chéo, âm trầm, rung 2 nhịp.">
            {() => (
              <div className="g-t g-rung-ngang">
                <PhanHoiBuoc ketQua={KQ_SAI} coMang={false} />
              </div>
            )}
          </HieuUng>

          <HieuUng so="4" ten="Combo liên tiếp" moTa="Từ 3 câu đúng liên tiếp; mốc 5 và 10 có vòng sáng.">
            {() => (
              <div className="flex flex-wrap items-center gap-3">
                <NhanCombo n={combo} />
                <button
                  type="button"
                  onClick={() => datCombo((n) => (n >= 10 ? 3 : n + 1))}
                  className="min-h-11 rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold"
                >
                  Thêm một câu đúng
                </button>
              </div>
            )}
          </HieuUng>

          <HieuUng
            so="5"
            ten="Lên cấp"
            moTa="Huy hiệu cấp phóng to, vòng sáng xoay, số cấp chạy, pháo hoa nhẹ."
          >
            {() => (
              <button
                type="button"
                onClick={() => datChucMung("len_cap")}
                className="g-nut inline-flex w-full items-center justify-center bg-primary px-5 text-on-primary"
              >
                Xem lên cấp
              </button>
            )}
          </HieuUng>

          <HieuUng so="6" ten="Nhận huy hiệu" moTa="Huy hiệu lật từ mặt sau, ánh sáng quét qua một lần.">
            {() => (
              <>
                <HuyHieuLat ten="Bảy ngày liền" moTa="Học 7 ngày liên tiếp." />
                <button
                  type="button"
                  onClick={() => datChucMung("huy_hieu")}
                  className="mt-3 min-h-11 rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold"
                >
                  Xem lớp chúc mừng huy hiệu
                </button>
              </>
            )}
          </HieuUng>

          <HieuUng
            so="7"
            ten="Đếm ngược"
            moTa="Vòng tròn rút dần; 5 giây cuối màu nhấn, 3 giây cuối đỏ và đập nhẹ, có tiếng tích."
          >
            {() => (
              <div className="flex justify-center">
                <DongHoBuoc conLaiMs={8000} tongMs={8000} />
              </div>
            )}
          </HieuUng>

          <HieuUng
            so="8"
            ten="Hết giờ"
            moTa="Đồng hồ về 0, lớp đỏ mờ phủ thẻ, nhãn Hết giờ, âm trầm dài, rung."
          >
            {(lan) => (
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink-2">Đồng hồ 3 giây</span>
                  <DongHoBuoc key={lan} conLaiMs={3000} tongMs={3000} onHet={() => datHetGio(true)} />
                </div>
                <div className="relative mt-3 g-the p-4">
                  <p>Thẻ câu hỏi mẫu</p>
                  {hetGio ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 grid place-items-center"
                    >
                      <span
                        className="g-t g-phu-do absolute inset-0 rounded-2xl"
                        style={{ background: "var(--danger)", opacity: 0.12 }}
                      />
                      <span
                        className="g-a g-bat g-tieu-de relative rounded-full px-4 py-2 text-lg font-bold"
                        style={{ background: "var(--danger)", color: "var(--surface)" }}
                      >
                        Hết giờ
                      </span>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => datHetGio(false)}
                  className="mt-2 text-sm text-ink-2 underline"
                >
                  Ẩn lớp phủ
                </button>
              </div>
            )}
          </HieuUng>

          <HieuUng
            so="9"
            ten="Kết thúc màn"
            moTa="Sao bật lần lượt, điểm và XP chạy số, 3 sao thì pháo hoa nhẹ."
          >
            {() => <TongKetLuot luot={LUOT_MAU} />}
          </HieuUng>

          <HieuUng so="10" ten="Chuyển câu" moTa="Thẻ mới trượt vào từ phải.">
            {() => (
              <>
                <div key={cau} className="g-a g-truot-vao g-the p-4">
                  <p className="font-medium">Câu {cau}</p>
                </div>
                <button
                  type="button"
                  onClick={() => datCau((n) => n + 1)}
                  className="g-nut mt-3 inline-flex w-full items-center justify-center bg-primary px-5 text-on-primary"
                >
                  Câu tiếp
                </button>
              </>
            )}
          </HieuUng>

          <HieuUng
            so="11"
            ten="Súng bắn tốc độ: xe lao qua, máy đo"
            moTa="Hai hiệu ứng riêng đã duyệt: xe lao vào có vệt; số chạy như máy đo rồi khóa, vượt thì đỏ."
          >
            {() => <XeQuaChot de={XE_MAU} />}
          </HieuUng>

          <HieuUng so="12" ten="Pháo hoa nhẹ" moTa="40 hạt, 1,2 giây. Tắt khi giảm hiệu ứng.">
            {(lan) => (
              <>
                <PhaoHoa lan={lan} />
                <p className="text-sm text-ink-2">Bấm "Chạy lại" để bắn lại.</p>
              </>
            )}
          </HieuUng>

          <HieuUng
            so="13"
            ten="Cảnh từ trên xuống và kéo thả (M6, M2)"
            moTa="Canvas một lớp, nội suy giữa nhịp mô phỏng 50 ms; kéo biển vào ô, hoặc chạm biển rồi chạm ô, hoặc dùng bàn phím. Giảm hiệu ứng: chạy thử theo từng bước."
          >
            {(lan) => (
              <CamBien key={lan} de={DE_CAM_BIEN_MAU} traLoi={null} datTraLoi={() => {}} daCham={false} />
            )}
          </HieuUng>

          <HieuUng
            so="14"
            ten="Camera giao thông và khoanh vùng (M6, M2)"
            moTa="Khung camera nhìn chéo, dấu giờ chạy, nhiễu nhẹ; dừng hình rồi kéo khung, vẽ vòng hoặc chạm vào xe; tua lại chạy lùi nhanh. Giảm hiệu ứng: phim chạy từng đoạn 2 giây, nhiễu đứng yên."
          >
            {(lan) => (
              <SoiCamera key={lan} de={DE_SOI_CAMERA_MAU} traLoi={null} datTraLoi={() => {}} daCham={false} />
            )}
          </HieuUng>
        </div>
      </div>

      {chucMung ? (
        <LopChucMung
          lenCap={chucMung === "len_cap" ? { cap: 4 } : null}
          huyHieu={
            chucMung === "huy_hieu" || chucMung === "len_cap"
              ? [{ code: "mau", name: "Bảy ngày liền", description: "Học 7 ngày liên tiếp." }]
              : []
          }
          dong={() => datChucMung(null)}
        />
      ) : null}
    </VungTroChoi>
  );
}
