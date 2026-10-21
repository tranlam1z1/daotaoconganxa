/**
 * Sinh 30 hồ sơ MẪU cho trò "Kiểm tra giấy tờ" (docs/PLAN.md GĐ-T1) bằng hàm sinh dùng chung
 * `sinhHoSo` (packages/dao-tao/src/tro-choi/chung/giay-to.ts), rồi ghi ra
 * data/tro-choi/kiem-tra-giay-to.json để người soạn đọc và sửa được trước khi nạp.
 *
 *   bun run scripts/sinh-ho-so-giay-to.ts
 *
 * Tất định theo seed cố định: chạy lại ra đúng tệp cũ. Mỗi hồ sơ được tự kiểm bằng luật trong
 * data/tra-cuu/luat-giay-to.json: có đúng các lỗi yêu cầu, không thêm lỗi nào.
 * Nạp vào chờ duyệt: bun run packages/db/src/seed-tro-choi.ts
 */
import { join } from "node:path";
import {
  congNgayLich,
  type MaLoiGiayTo,
  manCuaLoi,
  sinhHoSo,
  TEN_LOI_GIAY_TO,
  TEN_PHAN_LOAI_XE,
  taoRng,
} from "@qdpl/dao-tao";
import { type DongLuatGiayToTep, luatGiayToTuTep } from "../packages/db/src/kiem-tra-giay-to.ts";

const GOC = join(import.meta.dir, "..");
const SEED = "kiem-tra-giay-to-mau-2026-09";

/** [màn, lỗi, tinh vi, ý đồ]. 8 + 6 + 6 + 5 + 5 = 30 hồ sơ; mỗi màn có hồ sơ hợp lệ. */
const PHAN_BO: Array<[number, MaLoiGiayTo[], boolean, string]> = [
  [1, [], false, "Giấy phép hợp lệ, xe mô tô: cho qua."],
  [1, [], false, "Giấy phép hợp lệ: cho qua."],
  [1, [], false, "Giấy phép hạng B còn hạn: cho qua."],
  [1, [], false, "Giấy phép hợp lệ: cho qua."],
  [1, ["thieu_gplx"], false, "Không xuất trình giấy phép lái xe."],
  [1, ["thieu_gplx"], false, "Không xuất trình giấy phép lái xe."],
  [1, ["gplx_ngoai_han"], false, "Giấy phép hạng B đã hết hạn nhiều ngày."],
  [1, ["gplx_ngoai_han"], false, "Giấy phép hạng B đã hết hạn."],
  [2, [], false, "Giấy phép và đăng ký khớp với xe: cho qua."],
  [2, [], false, "Giấy phép và đăng ký khớp với xe: cho qua."],
  [2, ["thieu_dang_ky"], false, "Không xuất trình giấy đăng ký xe."],
  [2, ["dang_ky_sai_bien_so"], false, "Đăng ký của xe khác biển số."],
  [2, ["dang_ky_sai_bien_so"], false, "Đăng ký của xe khác biển số."],
  [2, ["dang_ky_sai_nhan_hieu"], false, "Đăng ký ghi nhãn hiệu khác xe thực tế."],
  [3, [], false, "Đủ ba giấy tờ, còn hiệu lực: cho qua."],
  [3, [], false, "Đủ ba giấy tờ, còn hiệu lực: cho qua."],
  [3, ["thieu_bao_hiem"], false, "Không xuất trình giấy bảo hiểm."],
  [3, ["bao_hiem_ngoai_han"], false, "Bảo hiểm đã hết hạn."],
  [3, ["bao_hiem_ngoai_han"], false, "Bảo hiểm đã hết hạn."],
  [3, ["bao_hiem_sai_bien_so"], false, "Bảo hiểm cấp cho xe khác biển số."],
  [4, [], false, "Hạng giấy phép phù hợp loại xe: cho qua."],
  [4, [], false, "Hạng giấy phép phù hợp loại xe: cho qua."],
  [
    4,
    ["gplx_sai_hang"],
    false,
    "Giấy phép hạng mô tô dùng để lái ô tô, hoặc hạng A1 lái mô tô trên 125 cm³.",
  ],
  [4, ["gplx_sai_hang"], true, "Giấy phép hạng A1 lái mô tô trên 125 cm³: phải đọc dung tích trên đăng ký."],
  [4, ["gplx_sai_hang", "bao_hiem_ngoai_han"], false, "Hai lỗi cùng lúc: sai hạng và bảo hiểm hết hạn."],
  [5, [], true, "Sát biên nhưng hợp lệ: giấy tờ hết hạn đúng ngày kiểm tra vẫn còn giá trị."],
  [5, [], true, "Sát biên nhưng hợp lệ."],
  [
    5,
    ["gplx_nguoi_khac"],
    true,
    "Giấy phép trùng họ tên nhưng khác ngày sinh: không phải của người đang lái.",
  ],
  [5, ["dang_ky_sai_bien_so"], true, "Biển số trên đăng ký lệch đúng một chữ số."],
  [5, ["bao_hiem_ngoai_han"], true, "Bảo hiểm hết hạn hôm qua, hoặc chưa tới ngày có hiệu lực."],
];

const tep = (await Bun.file(join(GOC, "data", "tra-cuu", "luat-giay-to.json")).json()) as {
  dong: DongLuatGiayToTep[];
};
const luat = tep.dong.map(luatGiayToTuTep);
const rng = taoRng(SEED);

const hoSo = PHAN_BO.map(([muc, loi, tinhVi, yDo], i) => {
  for (const l of loi)
    if (manCuaLoi(l) > muc) throw new Error(`Hồ sơ ${i + 1}: lỗi ${l} chưa có ở màn ${muc}.`);
  const ngay = congNgayLich("2026-09-01", Math.floor(rng() * 30));
  const h = sinhHoSo({ loi, ngayKiemTra: ngay, luat, tinhVi }, rng);
  const ma = `KTGT-${String(i + 1).padStart(2, "0")}`;
  const moTaLoi = loi.length ? loi.map((l) => TEN_LOI_GIAY_TO[l].toLowerCase()).join("; ") : "hợp lệ";
  return {
    ma,
    tieu_de: `[Demo] ${ma} · Màn ${muc} · ${h.nguoi_lai.ho_ten} · ${moTaLoi}`,
    muc,
    loi,
    y_do: yDo,
    ghi_chu_xe: TEN_PHAN_LOAI_XE[h.xe.phan_loai],
    ho_so: h,
  };
});

await Bun.write(
  join(GOC, "data", "tro-choi", "kiem-tra-giay-to.json"),
  `${JSON.stringify(
    {
      mo_ta:
        "Hồ sơ mẫu trò Kiểm tra giấy tờ (docs/PLAN.md GĐ-T1), sinh bằng scripts/sinh-ho-so-giay-to.ts. Nạp vào chờ duyệt: bun run packages/db/src/seed-tro-choi.ts",
      luu_y_bien_tap: [
        "DỮ LIỆU DEMO, CHƯA DUYỆT. Họ tên, ngày sinh, biển số, số giấy tờ đều là dữ liệu giả, sinh ngẫu nhiên; nếu trùng người hoặc xe thật là ngẫu nhiên.",
        "Lỗi của từng hồ sơ suy ra từ luật giấy tờ (data/tra-cuu/luat-giay-to.json), luật này còn là bản nháp chưa đối chiếu văn bản.",
        "Chủ xe luôn là người lái: trò không dạy trường hợp lái xe của người khác vì chưa có căn cứ đã đối chiếu.",
      ],
      ho_so: hoSo,
    },
    null,
    2,
  )}\n`,
);
console.log(`Đã ghi ${hoSo.length} hồ sơ mẫu vào data/tro-choi/kiem-tra-giay-to.json.`);
