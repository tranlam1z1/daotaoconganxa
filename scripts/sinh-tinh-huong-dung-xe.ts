/**
 * Sinh 5 tình huống MẪU cho trò "Dừng xe đúng quy trình" (docs/PLAN.md GĐ-T4), mỗi màn một tình huống.
 * Giấy tờ của người lái sinh bằng hàm sinh hồ sơ dùng chung của trò "Kiểm tra giấy tờ" (`sinhHoSo`,
 * packages/dao-tao/src/tro-choi/chung/giay-to.ts), tự kiểm bằng luật trong
 * data/tra-cuu/luat-giay-to.json. Ghi ra data/tro-choi/dung-xe.json để người soạn đọc và sửa trước khi
 * nạp.
 *
 *   bun run scripts/sinh-tinh-huong-dung-xe.ts
 *
 * Tất định theo seed cố định: chạy lại ra đúng tệp cũ.
 * Nạp vào chờ duyệt: bun run packages/db/src/seed-tro-choi.ts
 */
import { join } from "node:path";
import {
  type DapAnDungXe,
  kiemTraTinhHuongDungXe,
  type PayloadDungXe,
  type PhanLoaiXe,
  sinhHoSo,
  TEN_PHAN_LOAI_XE,
  taoRng,
} from "@qdpl/dao-tao";
import { type DongLuatGiayToTep, luatGiayToTuTep } from "../packages/db/src/kiem-tra-giay-to.ts";

const GOC = join(import.meta.dir, "..");
const SEED = "dung-xe-mau-2026-09";

type Mau = Omit<PayloadDungXe, "ho_so"> & {
  ma: string;
  ten: string;
  phan_loai: PhanLoaiXe;
  ngay: string;
  dap_an: DapAnDungXe;
  y_do: string;
  can_kiem_tra: string;
};

const VI_TRI_LE = {
  ma: "le-phai",
  ten: "Sát lề phải, đoạn thẳng",
  mo_ta: "Lề rộng, đường thẳng, nhìn rõ từ xa.",
};
const VI_TRI_CUA = { ma: "sau-cua", ten: "Ngay sau khúc cua", mo_ta: "Xe phía sau chỉ thấy khi đã vào cua." };
const VI_TRI_CAU = { ma: "tren-cau", ten: "Trên cầu hẹp", mo_ta: "Cầu mỗi chiều một làn, không có lề." };
const VI_TRI_BEN = {
  ma: "bai-do",
  ten: "Bãi đất trống cạnh trạm",
  mo_ta: "Bãi phẳng, cách mép đường vài mét, xe vào ra dễ.",
};
const VI_TRI_NGA_BA = { ma: "nga-ba", ten: "Giữa miệng ngã ba", mo_ta: "Chỗ xe từ đường nhánh rẽ ra." };

const MAU: Mau[] = [
  {
    ma: "DX-01",
    ten: "Xe mô tô, người lái hợp tác, giấy tờ hợp lệ",
    muc: 1,
    phan_loai: "mo_to_nho",
    ngay: "2026-09-14",
    mo_ta: "Buổi sáng, tổ công tác làm nhiệm vụ trên đường tỉnh. Một xe mô tô đi tới, chạy đúng làn.",
    ly_do_dung: "kiểm tra giấy tờ theo kế hoạch của tổ công tác",
    vi_tri: [],
    phan_ung: [],
    do_con: null,
    dap_an: {
      vi_tri_an_toan: [],
      loi_giay_to: [],
      vi_pham_khac: [],
      huong_xu_ly: "cho_di",
      ly_do_xu_ly: "Giấy tờ đầy đủ, còn giá trị, khớp với xe và người lái; không có vi phạm nên cho đi.",
    },
    y_do: "Làm quen: đi đủ các bước theo mũi tên gợi ý, người lái hợp tác.",
    can_kiem_tra: 'Thứ tự các bước; lý do dừng xe "theo kế hoạch" có đúng cách nói không.',
  },
  {
    ma: "DX-02",
    ten: "Xe ô tô, người lái hợp tác, bảo hiểm hết hạn",
    muc: 2,
    phan_loai: "o_to_con",
    ngay: "2026-09-16",
    mo_ta: "Buổi chiều, trên quốc lộ gần một khúc cua và một cây cầu hẹp. Một xe ô tô con đi tới.",
    ly_do_dung: "kiểm tra giấy tờ theo kế hoạch của tổ công tác",
    vi_tri: [VI_TRI_CUA, VI_TRI_LE, VI_TRI_CAU],
    phan_ung: [],
    do_con: null,
    dap_an: {
      vi_tri_an_toan: ["le-phai"],
      loi_giay_to: ["bao_hiem_ngoai_han"],
      vi_pham_khac: [],
      huong_xu_ly: "lap_bien_ban",
      ly_do_xu_ly: "Giấy chứng nhận bảo hiểm bắt buộc đã hết hạn: có vi phạm, lập biên bản.",
    },
    y_do: "Chọn chỗ dừng an toàn giữa ba chỗ; kiểm giấy tờ phát hiện bảo hiểm hết hạn.",
    can_kiem_tra:
      "Tiêu chí vị trí dừng an toàn (khúc cua, cầu hẹp là không an toàn?); lỗi bảo hiểm hết hạn có lập biên bản không, có tạm giữ gì không.",
  },
  {
    ma: "DX-03",
    ten: "Xe mô tô, người lái không hợp tác (đòi biết lý do), đo cồn âm tính",
    muc: 3,
    phan_loai: "mo_to_nho",
    ngay: "2026-09-18",
    mo_ta: "Buổi tối, gần khu quán ăn. Một xe mô tô đi tới; người lái tỏ ra khó chịu khi thấy tổ công tác.",
    ly_do_dung: "kiểm tra nồng độ cồn theo kế hoạch của tổ công tác",
    vi_tri: [VI_TRI_NGA_BA, VI_TRI_LE],
    phan_ung: ["doi_biet_ly_do"],
    do_con: { ket_qua: 0, don_vi: "mg/L khí thở", giu_ms: 5000 },
    dap_an: {
      vi_tri_an_toan: ["le-phai"],
      loi_giay_to: [],
      vi_pham_khac: [],
      huong_xu_ly: "cho_di",
      ly_do_xu_ly: "Giấy tờ hợp lệ, máy đo báo 0: không có vi phạm nên cho đi.",
    },
    y_do: "Người lái không đưa giấy tờ nếu chưa được biết lý do: dạy thông báo lý do trước khi đề nghị xuất trình.",
    can_kiem_tra:
      "Thời gian thổi của máy đo (tình huống đặt 5 giây, chưa đối chiếu); cách nói khi người lái đòi biết lý do; kết quả 0 thì kết luận thế nào.",
  },
  {
    ma: "DX-04",
    ten: "Xe ô tô, người lái hợp tác, đo cồn dương tính",
    muc: 4,
    phan_loai: "o_to_con",
    ngay: "2026-09-20",
    mo_ta: "Tối thứ Bảy, trên đường vành đai. Một xe ô tô con đi tới, người lái vừa rời một nhà hàng.",
    ly_do_dung: "kiểm tra nồng độ cồn theo kế hoạch của tổ công tác",
    vi_tri: [VI_TRI_BEN, VI_TRI_CUA, VI_TRI_CAU],
    phan_ung: [],
    do_con: { ket_qua: 0.3, don_vi: "mg/L khí thở", giu_ms: 5000 },
    dap_an: {
      vi_tri_an_toan: ["bai-do"],
      loi_giay_to: [],
      vi_pham_khac: [
        {
          hanh_vi: "Điều khiển xe ô tô trên đường mà hơi thở có nồng độ cồn",
          chi_tiet: "Máy đo báo 0,30 mg/L khí thở.",
          ma_muc_phat: "oto-con-muc-2",
        },
      ],
      huong_xu_ly: "lap_bien_ban_tam_giu",
      ly_do_xu_ly:
        "Máy đo báo có nồng độ cồn: lập biên bản; không để người lái tiếp tục điều khiển xe, tạm giữ phương tiện (hướng xử lý của tình huống demo, chờ đơn vị chuyên môn xác nhận).",
    },
    y_do: "Đo cồn đủ thời gian, đọc kết quả dương tính, chọn hướng xử lý có tạm giữ phương tiện.",
    can_kiem_tra:
      "Mức 0,30 mg/L khí thở thuộc khung nào (dòng mức phạt oto-con-muc-2 còn là bản nháp); trường hợp nào được tạm giữ phương tiện; thời gian thổi của máy đo.",
  },
  {
    ma: "DX-05",
    ten: "Xe mô tô, người lái không hợp tác (không dừng, xin bỏ qua, không chịu thổi)",
    muc: 5,
    phan_loai: "mo_to_lon",
    ngay: "2026-09-22",
    mo_ta: "Gần nửa đêm, trên đường ven sông. Một xe mô tô phân khối lớn đi tới khá nhanh.",
    ly_do_dung: "kiểm tra nồng độ cồn theo kế hoạch của tổ công tác",
    vi_tri: [VI_TRI_CAU, VI_TRI_LE],
    phan_ung: ["khong_dung_lan_dau", "xin_bo_qua", "tu_choi_thoi"],
    do_con: { ket_qua: 0.45, don_vi: "mg/L khí thở", giu_ms: 5000 },
    dap_an: {
      vi_tri_an_toan: ["le-phai"],
      loi_giay_to: ["thieu_dang_ky"],
      vi_pham_khac: [
        {
          hanh_vi: "Điều khiển xe mô tô trên đường mà hơi thở có nồng độ cồn",
          chi_tiet: "Máy đo báo 0,45 mg/L khí thở.",
          ma_muc_phat: "mt-con-muc-3",
        },
      ],
      huong_xu_ly: "lap_bien_ban_tam_giu",
      ly_do_xu_ly:
        "Không xuất trình giấy đăng ký xe và máy đo báo có nồng độ cồn: lập biên bản, tạm giữ phương tiện (hướng xử lý của tình huống demo, chờ đơn vị chuyên môn xác nhận).",
    },
    y_do: "Diễn biến bất ngờ: ra hiệu lệnh lại khi xe không dừng; từ chối dứt khoát lời xin bỏ qua; yêu cầu chấp hành khi người lái không chịu thổi. Mỗi thao tác có giờ.",
    can_kiem_tra:
      "Xử lý khi người lái không dừng ở hiệu lệnh đầu (chỉ ra hiệu lệnh lại, hay ghi nhận hành vi không chấp hành hiệu lệnh?); cách từ chối lời xin bỏ qua, có phải lập biên bản riêng khi người lái có lời lẽ mua chuộc không; người lái lúc đầu không chịu thổi rồi chấp hành thì có tính hành vi không chấp hành yêu cầu kiểm tra không; mức 0,45 mg/L thuộc khung nào; tạm giữ phương tiện.",
  },
];

const tep = (await Bun.file(join(GOC, "data", "tra-cuu", "luat-giay-to.json")).json()) as {
  dong: DongLuatGiayToTep[];
};
const luat = tep.dong.map(luatGiayToTuTep);
const rng = taoRng(SEED);

const tinhHuong = MAU.map((m) => {
  const ho_so = sinhHoSo(
    { loi: m.dap_an.loi_giay_to, ngayKiemTra: m.ngay, luat, phanLoai: m.phan_loai },
    rng,
  );
  const payload: PayloadDungXe = {
    muc: m.muc,
    mo_ta: m.mo_ta,
    ly_do_dung: m.ly_do_dung,
    ho_so,
    vi_tri: m.vi_tri,
    phan_ung: m.phan_ung,
    do_con: m.do_con,
  };
  const loi = kiemTraTinhHuongDungXe(payload, m.dap_an);
  if (loi.length) throw new Error(`Tình huống ${m.ma} không hợp lệ: ${loi.join(" ")}`);
  return {
    ma: m.ma,
    tieu_de: `[Demo] ${m.ma} · Màn ${m.muc} · ${m.ten}`,
    y_do: m.y_do,
    can_kiem_tra: m.can_kiem_tra,
    ghi_chu_xe: TEN_PHAN_LOAI_XE[m.phan_loai],
    tinh_huong: payload,
    dap_an: m.dap_an,
  };
});

await Bun.write(
  join(GOC, "data", "tro-choi", "dung-xe.json"),
  `${JSON.stringify(
    {
      mo_ta:
        "Tình huống mẫu trò Dừng xe đúng quy trình (docs/PLAN.md GĐ-T4), sinh bằng scripts/sinh-tinh-huong-dung-xe.ts. Nạp vào chờ duyệt: bun run packages/db/src/seed-tro-choi.ts",
      luu_y_bien_tap: [
        "DỮ LIỆU DEMO, CHƯA DUYỆT. Họ tên, ngày sinh, biển số, số giấy tờ là dữ liệu giả sinh ngẫu nhiên bằng hàm sinh hồ sơ của trò Kiểm tra giấy tờ; nếu trùng người hoặc xe thật là ngẫu nhiên.",
        "Quy trình các bước (data/tra-cuu/quy-trinh.json, mã dung-xe-kiem-tra), vị trí an toàn, thời gian thổi của máy đo, hướng xử lý của từng tình huống đều CHƯA ĐỐI CHIẾU văn bản: kho văn bản đang nối chưa có văn bản nào về quy trình dừng xe, kiểm tra nồng độ cồn, tạm giữ phương tiện.",
        "Mỗi tình huống có trường can_kiem_tra: các điểm cần đơn vị chuyên môn trả lời trước khi duyệt. Bảng tổng hợp ở docs/GAME_DESIGN.md §5.4.",
        "Hợp tác: DX-01, DX-02, DX-04. Không hợp tác: DX-03 (đòi biết lý do mới đưa giấy tờ), DX-05 (không dừng ở hiệu lệnh đầu, xin bỏ qua, không chịu thổi).",
      ],
      tinh_huong: tinhHuong,
    },
    null,
    2,
  )}\n`,
);
console.log(`Đã ghi ${tinhHuong.length} tình huống mẫu vào data/tro-choi/dung-xe.json.`);
