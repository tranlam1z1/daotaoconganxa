/**
 * Đồng bộ kết quả luyện tập offline lên máy chủ (docs/PLAN.md GĐ13).
 *
 * Gửi mọi phiên còn chờ trong kho qua cầu nối `/api/luyen-tap/dong-bo` (routes/api.$.tsx), rồi mọi
 * lượt trò chơi offline qua `/api/luot-choi/dong-bo` (GĐ-G0). Gửi
 * lại bao nhiêu lần cũng an toàn: máy chủ bỏ qua bản trùng theo `client_id` của phiên và của
 * từng câu trả lời. Chỉ gửi phiên đã nộp bài: trước khi nộp, người học còn sửa được câu trả lời.
 *
 * Tự chạy khi có mạng trở lại (sự kiện `online`), khi mở trang luyện tập offline, và sau mỗi
 * phiên; lỗi mạng thì thử lại sau, giãn dần tới 5 phút.
 */
import { luotChoDongBo, luuLuot, luuPhien, type PhienOffline, phienChoDongBo } from "./kho";

export type KetQuaDongBo =
  | { trangThai: "xong"; soPhien: number; xp: number }
  | { trangThai: "khong_co_mang" | "can_dang_nhap" | "loi"; thongBao: string };

/** Sự kiện `window` phát sau mỗi lượt gửi, `detail` là KetQuaDongBo. */
export const SU_KIEN_DONG_BO = "qdpl:dong-bo";

let dangChay: Promise<KetQuaDongBo> | null = null;
let hen: ReturnType<typeof setTimeout> | null = null;
let lanLoi = 0;

function sangGoiTin(p: PhienOffline) {
  return {
    client_id: p.client_id,
    chu_de: p.chu_de.id,
    bat_dau: p.bat_dau,
    ket_thuc: p.ket_thuc,
    items: p.items.map((i) => ({ question_id: i.question_id, version: i.version })),
    cau_tra_loi: p.cau_tra_loi.map((a) => ({
      client_id: a.client_id,
      question_id: a.question_id,
      question_version: a.question_version,
      tra_loi: a.tra_loi,
      giay: a.giay,
    })),
  };
}

async function guiMotLan(): Promise<KetQuaDongBo> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { trangThai: "khong_co_mang", thongBao: "Chưa có mạng. Kết quả sẽ tự gửi khi có mạng." };
  }
  const phien = await guiPhienLuyenTap();
  if (phien.trangThai !== "xong") return phien;
  const luot = await guiLuotChoi();
  if (luot.trangThai !== "xong") return luot;
  return { trangThai: "xong", soPhien: phien.soPhien + luot.soPhien, xp: phien.xp + luot.xp };
}

/**
 * Gửi lượt trò chơi đã chơi trên máy (docs/PLAN.md GĐ-G0) qua `/api/luot-choi/dong-bo`. Máy chủ
 * sinh lại lượt từ gói và seed, chấm lại, bỏ qua bản trùng theo `client_id`; lượt chưa xong gửi
 * phần đã chơi và được gửi lại khi xong.
 */
async function guiLuotChoi(): Promise<KetQuaDongBo> {
  const cho = await luotChoDongBo();
  if (!cho.length) return { trangThai: "xong", soPhien: 0, xp: 0 };
  let res: Response;
  try {
    res = await fetch("/api/luot-choi/dong-bo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        luot: cho.slice(0, 20).map((l) => ({
          client_id: l.client_id,
          ma: l.ma,
          goi_id: l.goi_id,
          seed: l.seed,
          man: l.man ?? null,
          bat_dau: l.bat_dau,
          ket_thuc: l.ket_thuc,
          buoc: l.buoc.map((b) => ({
            client_id: b.client_id,
            thu_tu: b.thu_tu,
            tra_loi: b.tra_loi,
            luc: b.luc,
          })),
        })),
      }),
    });
  } catch {
    return { trangThai: "khong_co_mang", thongBao: "Chưa gửi được kết quả. Sẽ thử lại khi có mạng." };
  }
  if (res.status === 401) {
    return {
      trangThai: "can_dang_nhap",
      thongBao: "Đăng nhập bằng tài khoản đã được xác minh để gửi kết quả chơi offline.",
    };
  }
  if (!res.ok) return { trangThai: "loi", thongBao: "Máy chủ chưa nhận kết quả. Sẽ thử lại sau." };
  const { ket_qua } = (await res.json()) as {
    ket_qua: Array<{ client_id: string; loi?: string; xp?: number }>;
  };
  let xp = 0;
  let soPhien = 0;
  for (const kq of ket_qua) {
    const l = cho.find((x) => x.client_id === kq.client_id);
    if (!l) continue;
    xp += kq.xp ?? 0;
    // Lượt bị từ chối (gói hết hạn, mã trùng) không gửi lại nữa, để không kẹt hàng đợi.
    if (kq.loi || l.ket_thuc) {
      await luuLuot({ ...l, da_dong_bo: new Date().toISOString(), xp: (l.xp ?? 0) + (kq.xp ?? 0) });
      soPhien++;
    }
  }
  return { trangThai: "xong", soPhien, xp };
}

/** Gửi phiên luyện tập offline (GĐ13). */
async function guiPhienLuyenTap(): Promise<KetQuaDongBo & { trangThai: string }> {
  const cho = await phienChoDongBo();
  if (!cho.length) return { trangThai: "xong", soPhien: 0, xp: 0 };

  let res: Response;
  try {
    res = await fetch("/api/luyen-tap/dong-bo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phien: cho.slice(0, 20).map(sangGoiTin) }),
    });
  } catch {
    return { trangThai: "khong_co_mang", thongBao: "Chưa gửi được kết quả. Sẽ thử lại khi có mạng." };
  }
  if (res.status === 401) {
    return {
      trangThai: "can_dang_nhap",
      thongBao: "Đăng nhập bằng tài khoản đã được xác minh để gửi kết quả luyện tập offline.",
    };
  }
  if (!res.ok) return { trangThai: "loi", thongBao: "Máy chủ chưa nhận kết quả. Sẽ thử lại sau." };

  const { ket_qua } = (await res.json()) as {
    ket_qua: Array<{ client_id: string; loi?: string; xp?: number; da_ket_thuc?: boolean }>;
  };
  let xp = 0;
  let soPhien = 0;
  for (const kq of ket_qua) {
    const p = cho.find((x) => x.client_id === kq.client_id);
    if (!p) continue;
    xp += kq.xp ?? 0;
    // Phiên máy chủ từ chối (ví dụ mã phiên trùng) không gửi lại nữa, để không kẹt hàng đợi.
    // Phiên chưa làm xong giữ trạng thái chờ, để phần làm tiếp được gửi lên sau.
    if (kq.loi || p.ket_thuc) {
      await luuPhien({ ...p, da_dong_bo: new Date().toISOString() });
      soPhien++;
    }
  }
  return { trangThai: "xong", soPhien, xp };
}

/** Gửi kết quả đang chờ. Gọi chồng nhau thì dùng chung một lượt gửi. */
export function dongBo(): Promise<KetQuaDongBo> {
  dangChay ??= guiMotLan()
    .then((kq) => {
      if (kq.trangThai === "khong_co_mang" || kq.trangThai === "loi") henThuLai();
      else lanLoi = 0;
      // Báo cho trang đang mở (kể cả khi lượt gửi chạy nền), để cập nhật số phiên chờ.
      window.dispatchEvent(new CustomEvent<KetQuaDongBo>(SU_KIEN_DONG_BO, { detail: kq }));
      return kq;
    })
    .finally(() => {
      dangChay = null;
    });
  return dangChay;
}

function henThuLai() {
  if (hen) return;
  lanLoi++;
  // 5 giây, 10 giây, 20 giây… tối đa 5 phút.
  const cho = Math.min(5 * 60_000, 5_000 * 2 ** Math.min(lanLoi - 1, 6));
  hen = setTimeout(() => {
    hen = null;
    void dongBo();
  }, cho);
}

let daGan = false;

/** Gắn đồng bộ tự động một lần cho cả trang: khi có mạng lại thì gửi ngay. */
export function batDongBoTuDong(): void {
  if (daGan || typeof window === "undefined") return;
  daGan = true;
  window.addEventListener("online", () => {
    lanLoi = 0;
    void dongBo();
  });
  void dongBo();
}
