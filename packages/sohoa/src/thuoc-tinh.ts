/**
 * Đoán thuộc tính văn bản (số ký hiệu, tên, cơ quan ban hành, ngày ban hành, ngày có hiệu lực,
 * người ký) từ lớp văn bản của PDF, để biểu mẫu "Thêm văn bản" điền sẵn khi người soạn nạp tệp PDF.
 *
 * Chỉ dùng luật, không gọi mô hình, và chỉ là GỢI Ý: phần đầu văn bản in hai cột nên thứ tự
 * dòng trích ra không ổn định. Trường nào không chắc thì bỏ trống cho người soạn điền, không đoán.
 */
import { laDauTrangCongBao, laSoTrang } from "./heads.ts";
import type { TrangText } from "./types.ts";

export interface ThuocTinhDoan {
  soKyHieu?: string;
  title?: string;
  issuer?: string;
  /** YYYY-MM-DD */
  issuedDate?: string;
  /** YYYY-MM-DD */
  effectiveFrom?: string;
  /** Họ tên người ký như in trong khối chữ ký, kèm cấp hàm nếu có ("Đại tướng Lương Tam Quang"). */
  signer?: string;
}

/** Dòng chức danh trong khối chữ ký: "TM. CHÍNH PHỦ", "KT. BỘ TRƯỞNG", "THỦ TƯỚNG", "CHỦ TỊCH QUỐC HỘI". */
const CHUC_DANH =
  /^(?:(?:TM|KT|TL|TUQ|Q)\.\s*\S|(?:PHÓ\s+)?(?:THỦ TƯỚNG|BỘ TRƯỞNG|THỨ TRƯỞNG|CHỦ TỊCH|CHỦ NHIỆM|CHÁNH ÁN|VIỆN TRƯỞNG|TỔNG KIỂM TOÁN|THỐNG ĐỐC|TỔNG THƯ KÝ|TỔNG GIÁM ĐỐC|GIÁM ĐỐC|TỔNG CỤC TRƯỞNG|CỤC TRƯỞNG|TƯ LỆNH)(?:\s|$))/u;

/** Dòng giữa chức danh và họ tên mà không phải họ tên: "(Đã ký)", "[đã ký]", "(Ký tên, đóng dấu)". */
const GHI_CHU_KY = /^[([]?\s*(đã ký|ký tên|ký, |ký và)/iu;

/**
 * Họ tên người: 2–6 từ đều viết hoa chữ đầu (nhận cả từ một chữ cái như "Y"), có thể đứng sau
 * cấp hàm, học hàm.
 */
const HO_TEN =
  /^(?:(?:Đại tướng|Thượng tướng|Trung tướng|Thiếu tướng|Đại tá|Thượng tá|Trung tá|Thiếu tá|GS\.?|PGS\.?|TS\.?|ThS\.?)\s*)*(?:\p{Lu}[\p{Ll}\p{M}]*\s+){1,5}\p{Lu}[\p{Ll}\p{M}]*$/u;

/**
 * Người ký: họ tên đứng ngay dưới dòng chức danh in hoa của khối chữ ký đầu tiên sau Điều 1
 * (phụ lục phía sau có thể có khối chữ ký riêng). Văn bản liên tịch chỉ lấy người ký đầu.
 */
function timNguoiKy(trang: TrangText[]): string | undefined {
  const dong = trang
    .flatMap((t) => t.dong)
    .map((d) => d.trim().replace(/\s+/g, " "))
    .filter((d) => d && !laSoTrang(d) && !laDauTrangCongBao(d));
  const tuDieu = dong.findIndex((d) => /^(Điều|ĐIỀU)\s+\d/u.test(d));
  for (let i = Math.max(0, tuDieu); i < dong.length; i++) {
    const d = dong[i]!;
    if (!inHoa(d) || d.length > 80 || /\d/.test(d) || !CHUC_DANH.test(d)) continue;
    for (const sau of dong.slice(i + 1, i + 30)) {
      // Dòng chức danh thứ hai ("KT. BỘ TRƯỞNG" rồi "THỨ TRƯỞNG"), ghi chú "(Đã ký)", hoặc danh
      // sách "Nơi nhận" in ở cột bên cạnh bị trích xen vào giữa.
      if (inHoa(sau) || GHI_CHU_KY.test(sau) || /^(Nơi nhận|[-–•+])/u.test(sau)) continue;
      if (HO_TEN.test(sau)) return sau;
      break;
    }
  }
  return undefined;
}

/** Dòng tên loại văn bản đứng riêng, in hoa: sau nó là trích yếu. */
const TEN_LOAI =
  /^(BỘ LUẬT|LUẬT|PHÁP LỆNH|NGHỊ QUYẾT LIÊN TỊCH|NGHỊ QUYẾT|NGHỊ ĐỊNH|QUYẾT ĐỊNH|THÔNG TƯ LIÊN TỊCH|THÔNG TƯ|CHỈ THỊ|LỆNH)$/u;

/** Dòng mở đầu phần thân: trích yếu kết thúc trước dòng này. */
const HET_TRICH_YEU = /^(Căn cứ|Theo đề nghị|Chương|CHƯƠNG|Phần|PHẦN|Điều|ĐIỀU)\s/u;

const NGAY_CHU = /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/iu;

function iso(ngay: string, thang: string, nam: string): string | undefined {
  const d = Number(ngay);
  const m = Number(thang);
  const y = Number(nam);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1945 || y > 2200) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function inHoa(s: string): boolean {
  return /\p{Lu}/u.test(s) && s === s.toUpperCase();
}

export function doanThuocTinh(trang: TrangText[]): ThuocTinhDoan {
  const ra: ThuocTinhDoan = {};
  const dau = (trang[0]?.dong ?? [])
    .map((d) => d.trim())
    .filter((d) => d && !laSoTrang(d) && !laDauTrangCongBao(d));

  // Phần đầu: mọi dòng trước căn cứ ban hành (hoặc trước điều đầu tiên).
  const hetDau = dau.findIndex((d) => HET_TRICH_YEU.test(d));
  const phanDau = hetDau < 0 ? dau.slice(0, 20) : dau.slice(0, hetDau);

  for (const d of phanDau) {
    const m = d.match(/S[ốô]\s*:\s*(\d+[a-z]?\s*\/\s*\d{4}\s*\/\s*[\p{L}\d-]+)/iu);
    if (m?.[1]) {
      ra.soKyHieu = m[1].normalize("NFC").replace(/Ð/g, "Đ").replace(/\s+/g, "");
      break;
    }
  }

  // "Hà Nội, ngày 26 tháng 12 năm 2024": ngày ở phần đầu, không lấy ngày trong câu căn cứ.
  for (const d of phanDau) {
    const m = d.match(NGAY_CHU);
    const ngay = m && iso(m[1]!, m[2]!, m[3]!);
    if (ngay) {
      ra.issuedDate = ngay;
      break;
    }
  }

  const viTriLoai = phanDau.findIndex((d) => TEN_LOAI.test(d));
  if (viTriLoai >= 0) {
    const trichYeu = phanDau
      .slice(viTriLoai + 1)
      .filter((d) => !/^[-–—_*\s]+$/.test(d))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (trichYeu.length >= 5 && trichYeu.length <= 600) ra.title = trichYeu;

    // Cơ quan ban hành: dòng in hoa trước tên loại, không phải quốc hiệu, tiêu ngữ hay dòng số ký hiệu.
    const coQuan = phanDau
      .slice(0, viTriLoai)
      .find(
        (d) =>
          inHoa(d) &&
          d.length <= 80 &&
          !/\d/.test(d) &&
          !/^(CỘNG HÒA|CỘNG HOÀ|ĐỘC LẬP)/u.test(d) &&
          !/^[-–—_*\s]+$/.test(d),
      );
    if (coQuan) ra.issuer = coQuan;
  }

  // Ngày có hiệu lực: tìm trong toàn văn, dòng in bị ngắt giữa câu nên nối bằng khoảng trắng.
  const toanVan = trang.map((t) => t.dong.join(" ")).join(" ");
  const hl = toanVan.match(
    /có hiệu lực(?:\s+thi hành)?(?:\s+kể)?\s+từ\s+ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/iu,
  );
  const ngayHl = hl && iso(hl[1]!, hl[2]!, hl[3]!);
  if (ngayHl) ra.effectiveFrom = ngayHl;
  else if (ra.issuedDate && /có hiệu lực(?:\s+thi hành)?(?:\s+kể)?\s+từ\s+ngày\s+ký/iu.test(toanVan)) {
    ra.effectiveFrom = ra.issuedDate;
  }

  const nguoiKy = timNguoiKy(trang);
  if (nguoiKy) ra.signer = nguoiKy;

  return ra;
}
