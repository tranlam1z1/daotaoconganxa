/**
 * Chấm bài (ke-hoach/09-a §3, §4).
 *
 * Chỉ chấm phần TẤT ĐỊNH ở đây. Dạng bài cần mô hình đọc bài viết (`viet_co_can_cu`,
 * `phan_bien`…) trả về `canChamTiep = true` để tầng trên gọi `cham-ai.ts`. Tách như vậy để
 * phần chấm máy chạy được trong test không cần mạng, và để một lỗi của mô hình không bao giờ
 * làm hỏng điểm của câu trắc nghiệm.
 *
 * Nguyên tắc: đáp án và rubric KHÔNG BAO GIỜ rời máy chủ. Mọi hàm ở đây nhận `HoatDong` đầy
 * đủ và chỉ trả về `KetQuaCham` — thứ an toàn để gửi cho người học.
 */

import type { CachCham, DapAn, HoatDong, KetQuaCham, PhuongAn, Rubric, TieuChiRubric } from "./types.ts";

/** Chuẩn hoá chuỗi để so khớp: bỏ dấu, gộp khoảng trắng, bỏ dấu câu ở hai đầu. */
export function chuanHoa(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[.,;:!?"'()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mangChuoi(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string") return [v];
  return [];
}

/** Mã lỗi của các phương án mà người học đã chọn nhưng sai. */
function maLoiDaChon(phuongAn: PhuongAn[] | undefined, daChon: string[]): string[] {
  if (!phuongAn) return [];
  const ra = new Set<string>();
  for (const pa of phuongAn) {
    if (daChon.includes(pa.id) && !pa.dung && pa.ma_loi) ra.add(pa.ma_loi);
  }
  return [...ra];
}

/** Giải thích gộp cho các phương án đã chọn — phản hồi phải nói vì sao, không chỉ đúng/sai. */
function giaiThichDaChon(phuongAn: PhuongAn[] | undefined, daChon: string[]): string[] {
  if (!phuongAn) return [];
  return phuongAn.filter((pa) => daChon.includes(pa.id) && pa.giai_thich).map((pa) => pa.giai_thich!);
}

/* ------------------------------------------------------------------ */
/* Chấm từng dạng                                                      */
/* ------------------------------------------------------------------ */

/** Điểm theo tỷ lệ Jaccard giữa tập chọn và tập đúng — chọn thừa cũng bị trừ. */
function diemTapHop(chon: string[], dung: string[]): number {
  const a = new Set(chon);
  const b = new Set(dung);
  if (b.size === 0) return 0;
  let giao = 0;
  for (const x of a) if (b.has(x)) giao++;
  const hop = new Set([...a, ...b]).size;
  return hop === 0 ? 0 : giao / hop;
}

/**
 * Tương quan thứ hạng Kendall tau chuẩn hoá về [0,1] cho bài sắp xếp.
 * Xếp gần đúng vẫn được điểm — trình tự thủ tục sai một chỗ khác hẳn sai toàn bộ.
 */
export function diemThuTu(chon: string[], dung: string[]): number {
  const viTri = new Map(dung.map((id, i) => [id, i]));
  const day = chon.filter((id) => viTri.has(id)).map((id) => viTri.get(id)!);
  const n = day.length;
  if (n < 2) return n === 1 && chon.length === dung.length ? 1 : 0;
  let thuan = 0;
  let nghich = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (day[j]! > day[i]!) thuan++;
      else nghich++;
    }
  }
  const tau = (thuan - nghich) / (thuan + nghich);
  // Thiếu phần tử thì phạt theo tỷ lệ phủ.
  const phu = n / dung.length;
  return Math.max(0, ((tau + 1) / 2) * phu);
}

function chamTracNghiem(hd: HoatDong, tra: unknown): { ty_le: number; chon: string[] } {
  const chon = mangChuoi((tra as Record<string, unknown>)?.chon ?? tra);
  const dung = hd.answer.dung ?? [];
  return { ty_le: diemTapHop(chon, dung), chon };
}

function chamDienKhuyet(
  hd: HoatDong,
  tra: unknown,
): { ty_le: number; chi_tiet: KetQuaCham["feedback"]["chi_tiet"] } {
  const daNhap = ((tra as Record<string, unknown>)?.o_trong ?? {}) as Record<string, string>;
  const dap = hd.answer.o_trong ?? {};
  const khoa = Object.keys(dap);
  if (!khoa.length) return { ty_le: 0, chi_tiet: [] };
  const chi_tiet = khoa.map((k) => {
    const nhap = chuanHoa(String(daNhap[k] ?? ""));
    const ok = (dap[k] ?? []).some((cach) => chuanHoa(cach) === nhap);
    return { ma: k, dung: ok, ...(ok ? {} : { ghi_chu: "chưa khớp cách viết nào được chấp nhận" }) };
  });
  return { ty_le: chi_tiet.filter((c) => c.dung).length / khoa.length, chi_tiet };
}

function chamGhepCap(
  hd: HoatDong,
  tra: unknown,
): { ty_le: number; chi_tiet: KetQuaCham["feedback"]["chi_tiet"] } {
  const daGhep = ((tra as Record<string, unknown>)?.cap ?? {}) as Record<string, string>;
  const dap = hd.answer.cap ?? {};
  const khoa = Object.keys(dap);
  if (!khoa.length) return { ty_le: 0, chi_tiet: [] };
  const chi_tiet = khoa.map((k) => ({ ma: k, dung: daGhep[k] === dap[k] }));
  return { ty_le: chi_tiet.filter((c) => c.dung).length / khoa.length, chi_tiet };
}

function chamTinhToan(hd: HoatDong, tra: unknown): number {
  const raw = (tra as Record<string, unknown>)?.so ?? tra;
  const so =
    typeof raw === "number"
      ? raw
      : Number(
          String(raw)
            .replace(/[^\d.,-]/g, "")
            .replace(/,/g, ""),
        );
  if (!Number.isFinite(so) || hd.answer.so === undefined) return 0;
  // Sai số mặc định 0,5% — bài dự toán làm tròn khác nhau vẫn phải được coi là đúng.
  const saiSo = hd.answer.sai_so ?? Math.abs(hd.answer.so) * 0.005;
  return Math.abs(so - hd.answer.so) <= saiSo ? 1 : 0;
}

function chamTruyTim(hd: HoatDong, tra: unknown): number {
  const urn = String((tra as Record<string, unknown>)?.urn ?? tra ?? "").trim();
  if (!urn || !hd.answer.urn) return 0;
  // Đúng nút thì trọn điểm; đúng văn bản nhưng sai điều/khoản thì nửa điểm.
  if (urn === hd.answer.urn) return 1;
  const goc = (s: string) => s.split("#")[0];
  return goc(urn) === goc(hd.answer.urn) ? 0.5 : 0;
}

/* ------------------------------------------------------------------ */
/* Rubric                                                              */
/* ------------------------------------------------------------------ */

export function laRubric(r: unknown): r is Rubric {
  const x = r as Rubric | undefined;
  return Boolean(x && Array.isArray(x.tieu_chi) && x.tieu_chi.length > 0);
}

/** Điểm tối đa của một tiêu chí = mức cao nhất khai trong rubric. */
export function diemToiDaTieuChi(tc: TieuChiRubric): number {
  return tc.muc.length ? Math.max(...tc.muc.map((m) => m.diem)) : 4;
}

/**
 * Quy điểm rubric về thang 0–100 theo trọng số.
 * `diem` là điểm thô từng tiêu chí (do mô hình hoặc người chấm đưa vào).
 */
export function tinhDiemRubric(rubric: Rubric, diem: Record<string, number>): number {
  const tongTrongSo = rubric.tieu_chi.reduce((t, tc) => t + tc.trong_so, 0) || 1;
  let tong = 0;
  for (const tc of rubric.tieu_chi) {
    const toiDa = diemToiDaTieuChi(tc);
    const tho = Math.min(Math.max(diem[tc.ma] ?? 0, 0), toiDa);
    tong += (tho / toiDa) * tc.trong_so;
  }
  return (tong / tongTrongSo) * 100;
}

/**
 * Rubric hợp lệ phải có tiêu chí `can_cu` và tiêu chí đó phải nặng nhất (09-a §4.2).
 * Đây là chỗ ràng buộc sư phạm biến thành ràng buộc máy kiểm được.
 */
export function kiemTraRubric(rubric: unknown): string[] {
  const loi: string[] = [];
  if (!laRubric(rubric)) return ["Rubric phải có ít nhất một tiêu chí"];
  const canCu = rubric.tieu_chi.find((tc) => tc.ma === "can_cu");
  if (!canCu) loi.push('Rubric phải có tiêu chí "can_cu" (viện dẫn đúng và còn hiệu lực)');
  else {
    const nangNhat = Math.max(...rubric.tieu_chi.map((tc) => tc.trong_so));
    if (canCu.trong_so < nangNhat) loi.push('Tiêu chí "can_cu" phải có trọng số lớn nhất');
    if (!canCu.muc.some((m) => m.diem === 0)) {
      loi.push('Tiêu chí "can_cu" phải có mức 0 điểm dành cho việc dùng văn bản đã hết hiệu lực');
    }
  }
  const tong = rubric.tieu_chi.reduce((t, tc) => t + tc.trong_so, 0);
  if (tong <= 0) loi.push("Tổng trọng số phải lớn hơn 0");
  if (rubric.nguong_dat < 0 || rubric.nguong_dat > 100) loi.push("Ngưỡng đạt phải nằm trong 0–100");
  return loi;
}

/* ------------------------------------------------------------------ */
/* Điểm vào                                                            */
/* ------------------------------------------------------------------ */

const NGUONG_DAT_MAC_DINH = 0.7;

/**
 * Chấm một lượt làm bài bằng máy.
 *
 * Dạng bài mà máy không chấm được toàn phần vẫn đi qua đây: phần máy chấm được thì chấm,
 * phần còn lại đánh dấu `canChamTiep` để tầng trên gọi mô hình. Không bao giờ trả về điểm
 * bịa cho phần chưa chấm.
 */
export function chamBaiTap(hd: HoatDong, tra: unknown): KetQuaCham {
  const max = hd.points;
  const phuongAn = hd.answer.phuong_an;
  const nguong = laRubric(hd.rubric) ? hd.rubric.nguong_dat / 100 : NGUONG_DAT_MAC_DINH;

  let tyLe = 0;
  let chon: string[] = [];
  let chi_tiet: KetQuaCham["feedback"]["chi_tiet"];
  let canChamTiep = false;

  switch (hd.kind) {
    case "trac_nghiem":
    case "keo_tha_so_do": {
      const r = chamTracNghiem(hd, tra);
      tyLe = r.ty_le;
      chon = r.chon;
      if (hd.kind === "keo_tha_so_do" && hd.answer.cap) {
        const g = chamGhepCap(hd, tra);
        tyLe = g.ty_le;
        chi_tiet = g.chi_tiet;
      }
      break;
    }
    case "dung_sai": {
      const r = chamTracNghiem(hd, tra);
      tyLe = r.ty_le;
      chon = r.chon;
      // Phần "nêu căn cứ" là văn bản tự do -> để mô hình chấm tiếp.
      canChamTiep = Boolean((tra as Record<string, unknown>)?.can_cu);
      break;
    }
    case "dien_khuyet": {
      const r = chamDienKhuyet(hd, tra);
      tyLe = r.ty_le;
      chi_tiet = r.chi_tiet;
      break;
    }
    case "sap_xep":
    case "phan_nhanh": {
      const day = mangChuoi((tra as Record<string, unknown>)?.thu_tu ?? tra);
      tyLe = diemThuTu(day, hd.answer.thu_tu ?? []);
      chon = day;
      break;
    }
    case "ghep_cap": {
      const r = chamGhepCap(hd, tra);
      tyLe = r.ty_le;
      chi_tiet = r.chi_tiet;
      break;
    }
    case "tinh_toan":
      tyLe = chamTinhToan(hd, tra);
      break;
    case "truy_tim":
      tyLe = chamTruyTim(hd, tra);
      break;
    case "soi_loi": {
      const danhDau = mangChuoi((tra as Record<string, unknown>)?.vung);
      tyLe = diemTapHop(danhDau, hd.answer.vung ?? []);
      // Lý do đánh dấu do mô hình chấm.
      canChamTiep = true;
      break;
    }
    case "dien_bieu_mau": {
      // Máy chỉ kiểm được trường bắt buộc đã điền hay chưa; nội dung do mô hình chấm.
      const dien = ((tra as Record<string, unknown>)?.truong ?? {}) as Record<string, unknown>;
      const batBuoc = mangChuoi((hd.prompt as Record<string, unknown>).truong_bat_buoc);
      tyLe = batBuoc.length ? batBuoc.filter((t) => String(dien[t] ?? "").trim()).length / batBuoc.length : 0;
      chi_tiet = batBuoc.map((t) => ({ ma: t, dung: Boolean(String(dien[t] ?? "").trim()) }));
      canChamTiep = true;
      break;
    }
    case "viet_co_can_cu":
    case "dong_vai_hoi_dong":
    case "phan_bien":
    case "du_an_nho":
      // Máy không chấm được. Trả 0 kèm cờ chờ chấm, KHÔNG coi là trượt.
      return {
        score: 0,
        maxScore: max,
        passed: false,
        errorTags: [],
        feedback: { tom_tat: "Đã nhận bài. Bài này chờ chấm theo rubric." },
        gradedBy: hd.mode === "nguoi" ? "nguoi" : "ai",
        canChamTiep: true,
      };
  }

  tyLe = Math.min(Math.max(tyLe, 0), 1);
  const errorTags = maLoiDaChon(phuongAn, chon);
  const giaiThich = giaiThichDaChon(phuongAn, chon);
  const dat = tyLe >= nguong;

  const tomTat = dat
    ? (hd.answer.giai_thich ?? "Đúng rồi.")
    : giaiThich.length
      ? giaiThich.join(" ")
      : "Chưa đúng. Xem lại căn cứ rồi thử lại.";

  return {
    score: Math.round(tyLe * max * 100) / 100,
    maxScore: max,
    passed: dat,
    errorTags,
    feedback: {
      tom_tat: tomTat,
      ...(chi_tiet ? { chi_tiet } : {}),
      ...(hd.citations.length ? { can_cu: hd.citations } : {}),
    },
    gradedBy: "may" as CachCham,
    canChamTiep,
  };
}

/**
 * Ghép kết quả chấm máy với kết quả chấm rubric (mô hình hoặc người).
 * Phần máy chấm giữ nguyên trọng số của nó; phần rubric bù vào phần còn lại.
 */
export function gopKetQua(
  may: KetQuaCham,
  rubric: Rubric,
  diemRubric: Record<string, number>,
  boi: CachCham,
): KetQuaCham {
  const phanTram = tinhDiemRubric(rubric, diemRubric);
  const score = Math.round(((may.score + (phanTram / 100) * may.maxScore) / 2) * 100) / 100;
  const tieu_chi = rubric.tieu_chi.map((tc) => ({
    ma: tc.ma,
    ten: tc.ten,
    diem: diemRubric[tc.ma] ?? 0,
    diem_toi_da: diemToiDaTieuChi(tc),
  }));
  return {
    score,
    maxScore: may.maxScore,
    passed: phanTram >= rubric.nguong_dat,
    errorTags: may.errorTags,
    feedback: { ...may.feedback, tieu_chi },
    gradedBy: boi,
    canChamTiep: false,
  };
}

export type { DapAn, KetQuaCham };
