/**
 * Chuyển đổi địa giới hành chính (công cụ /cong-cu/dia-gioi-hanh-chinh): danh mục đơn vị cũ và mới,
 * chuyển xã/huyện/tỉnh cũ sang đơn vị hiện nay, tra ngược xã mới ra các xã cũ. Công khai, không cần
 * đăng nhập.
 *
 * Dữ liệu đọc một lần từ data/dia-gioi/dia-gioi.json (scripts/dia-gioi.ts), giữ trong bộ nhớ.
 *
 * Hai đường /vi-tri (tọa độ GPS → địa chỉ) và /dia-chi (địa chỉ gõ tự do → địa chỉ mới): xã, tỉnh
 * xác định theo ranh giới trong data/dia-gioi/ranh-gioi.json (scripts/ranh-gioi.ts, hiện có tỉnh
 * Thanh Hóa); số nhà, tên đường lấy qua Nominatim (nominatim.ts). Nominatim lỗi thì /vi-tri vẫn trả
 * xã, tỉnh. Kèm địa chỉ theo đơn vị cũ: xã cũ là xã đã nhập vào xã mới mà bản đồ ghi tên tại vị trí
 * hoặc người dùng nêu trong địa chỉ gõ; không khớp được thì trả danh sách các xã cũ có thể, kèm xã
 * cũ có tâm gần vị trí nhất làm ước lượng. Không ghi tọa độ hay địa chỉ vào nhật ký.
 */
import { join } from "node:path";
import { diaGioi, ranhGioi } from "@qdpl/dao-tao";
import { Hono } from "hono";
import { z } from "zod";
import { ApiError, notFound, parseBody, parseQuery } from "../http.ts";
import { type DiemDiaChi, dichVuNominatim } from "../nominatim.ts";

const THU_MUC = join(import.meta.dir, "..", "..", "..", "..", "data", "dia-gioi");

/** Đọc tệp một lần, giữ trong bộ nhớ. Đọc lỗi thì lần gọi sau thử lại, không giữ lời hứa đã hỏng. */
function docMotLan<T, R>(tep: string, dung: (d: T) => R): () => Promise<R> {
  let p: Promise<R> | null = null;
  return () => {
    p ??= Bun.file(join(THU_MUC, tep))
      .json()
      .then((d: T) => dung(d))
      .catch((e) => {
        p = null;
        throw e;
      });
    return p;
  };
}

const layBoTra = docMotLan("dia-gioi.json", diaGioi.taoBoTra);
const layRanhGioi = docMotLan("ranh-gioi.json", ranhGioi.taoBoRanhGioi);
const layThon = docMotLan("thon.json", diaGioi.taoBoTraThon);

/** Địa chỉ tại một vị trí. Mọi trường trừ tọa độ có thể trống khi không xác định được. */
export interface DiaChiBanDo {
  lat: number;
  lon: number;
  soNha: string | null;
  tenDuong: string | null;
  xa: diaGioi.XaMoi | null;
  tinh: diaGioi.TinhMoi | null;
  /** Vị trí nằm ở khe giữa các ranh nên lấy xã có ranh gần nhất. */
  ganRanh: boolean;
  /** Ranh giới xã đã làm gọn để vẽ bản đồ; chỉ có ở /vi-tri. */
  ranhGioi: ranhGioi.DaGiac | null;
  diaChiDayDu: string | null;
  /**
   * Địa chỉ theo đơn vị trước sắp xếp; null khi không xác định được xã mới. Xã cũ đối chiếu theo tên
   * đơn vị bản đồ ghi tại vị trí và tên nêu trong địa chỉ gõ. Chưa rõ (`coThe` khác rỗng) thì `ganNhat`
   * là xã cũ có tâm gần vị trí nhất, chỉ là ước lượng; `diaChiDayDu` ghép theo xã cũ đã rõ hoặc theo
   * `ganNhat`, trống khi không có cả hai.
   */
  cu:
    | (diaGioi.KetQuaXaCu & {
        ganNhat: { xa: diaGioi.XaCu; huyen: diaGioi.HuyenCu; tinh: diaGioi.TinhCu | null } | null;
        diaChiDayDu: string | null;
      })
    | null;
  /** Lưu ý kèm kết quả (vị trí ngoài vùng có ranh giới…). */
  ghiChu: string | null;
}

const noi = (...phan: Array<string | null | undefined>) =>
  phan
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ") || null;

/**
 * Tâm xã cũ chỉ dùng được khi rơi vào một xã mới đã nhận địa giới của chính xã cũ đó: nguồn định vị
 * nhầm một số xã (tên giống xã khác khi bỏ dấu) sang xã mới khác. Kết quả theo mã xã cũ, tính một lần.
 */
const tamDungDuoc = new Map<string, boolean>();

/**
 * Ghép điểm dịch vụ trả về (có thể không có) với xã, tỉnh xác định theo ranh giới. `diaChiGo` là địa
 * chỉ người dùng gõ ở /dia-chi, để nhận tên xã cũ nêu trong đó.
 */
async function ganDiaGioi(
  lat: number,
  lon: number,
  diem: DiemDiaChi | null,
  kemRanh: boolean,
  diaChiGo?: string,
): Promise<DiaChiBanDo> {
  const [bo, ranh] = await Promise.all([layBoTra(), layRanhGioi()]);
  const viTri = ranh.timXa(lat, lon);
  const xa = (viTri && bo.xaMoi(viTri.ma)) ?? null;
  const tinh = (xa && bo.tinhMoi(xa.tinh)) ?? null;
  const soNha = diem?.soNha ?? null;
  const tenDuong = diem?.tenDuong ?? null;
  const cu = xa ? bo.xaCuTaiViTri(xa.ma, diem?.tenDonVi ?? [], diaChiGo) : null;
  const gan = cu?.coThe.length
    ? diaGioi.xaCuGanNhat(cu.coThe, lat, lon, (x) => {
        let dung = tamDungDuoc.get(x.ma);
        if (dung === undefined) {
          dung = !!x.tam && x.moi.includes(ranh.timXa(x.tam[1], x.tam[0])?.ma ?? "");
          tamDungDuoc.set(x.ma, dung);
        }
        return dung;
      })
    : null;
  const ganNhat = gan && { xa: gan.xa, huyen: gan.huyen, tinh: bo.tinhCu(gan.huyen.tinh) ?? null };
  // Đơn vị cũ để ghép địa chỉ đầy đủ: đã rõ thì theo kết quả, chưa rõ thì theo ước lượng.
  const cuGhep = cu?.coThe.length ? ganNhat : cu;
  const vungCo = ranh.tinh.map((t) => bo.tinhMoi(t)?.ten ?? t).join(", ");
  return {
    lat,
    lon,
    soNha,
    tenDuong,
    xa,
    tinh,
    ganRanh: viTri?.ganRanh ?? false,
    ranhGioi: kemRanh && xa ? ranh.hinhXa(xa.ma) : null,
    diaChiDayDu: xa ? noi(soNha && `Số ${soNha}`, tenDuong, xa.ten, tinh?.ten) : null,
    cu: cu && {
      ...cu,
      ganNhat,
      diaChiDayDu:
        cuGhep && noi(soNha && `Số ${soNha}`, tenDuong, cuGhep.xa?.ten, cuGhep.huyen?.ten, cuGhep.tinh?.ten),
    },
    ghiChu: xa
      ? null
      : `Vị trí nằm ngoài vùng có dữ liệu ranh giới (hiện có ${vungCo}) nên chưa xác định được phường/xã.`,
  };
}

const maSchema = (n: number) => z.string().regex(new RegExp(`^\\d{${n}}$`), `Mã phải gồm ${n} chữ số`);

export const diaGioiRoute = new Hono();

/** GET /v1/dia-gioi/nguon: phiên bản và nguồn dữ liệu, để giao diện ghi dưới kết quả. */
diaGioiRoute.get("/nguon", async (c) => {
  const bo = await layBoTra();
  return c.json({ phienBan: bo.phienBan, nguon: bo.nguon });
});

diaGioiRoute.get("/cu/tinh", async (c) => c.json({ items: (await layBoTra()).dsTinhCu() }));

diaGioiRoute.get("/cu/tinh/:ma/huyen", async (c) => {
  const bo = await layBoTra();
  if (!bo.tinhCu(c.req.param("ma"))) throw notFound("Không có tỉnh cũ mã này.");
  return c.json({ items: bo.dsHuyenCu(c.req.param("ma")) });
});

diaGioiRoute.get("/cu/huyen/:ma/xa", async (c) => {
  const bo = await layBoTra();
  if (!bo.huyenCu(c.req.param("ma"))) throw notFound("Không có huyện cũ mã này.");
  return c.json({ items: bo.dsXaCu(c.req.param("ma")) });
});

/**
 * GET /v1/dia-gioi/chuyen-doi?tinh=&huyen=&xa=&thon=: chuyển đơn vị cũ chi tiết nhất đã chọn. Đơn vị
 * cấp dưới phải thuộc đơn vị cấp trên đã chọn. Có `thon` (tên thôn cũ gõ tự do) và `xa` thì mỗi xã mới
 * kèm `thon`: các dòng sắp xếp thôn khớp tên (data/dia-gioi/thon.json), null khi chưa có dữ liệu.
 */
diaGioiRoute.get("/chuyen-doi", async (c) => {
  const q = parseQuery(
    c,
    z.object({
      tinh: maSchema(2),
      huyen: maSchema(3).optional(),
      xa: maSchema(5).optional(),
      thon: z.string().trim().max(100).optional(),
    }),
  );
  const bo = await layBoTra();
  if (q.xa) {
    const kq = bo.chuyenXa(q.xa);
    if (!kq || (q.huyen && kq.huyenCu.ma !== q.huyen) || kq.tinhCu.ma !== q.tinh)
      throw notFound("Không có xã cũ này trong huyện, tỉnh đã chọn.");
    if (!q.thon) return c.json({ muc: "xa" as const, ...kq });
    // Kèm thôn mới theo từng xã mới: thôn cũ tên `thon` thành thôn nào theo phương án sắp xếp thôn.
    const { thon } = q;
    const boThon = await layThon();
    const moi = kq.moi.map((m) => ({ ...m, thon: boThon.tra(m.xa.ma, thon, kq.xaCu.ten) }));
    return c.json({ muc: "xa" as const, ...kq, moi });
  }
  if (q.huyen) {
    const kq = bo.chuyenHuyen(q.huyen);
    if (!kq || kq.tinhCu.ma !== q.tinh) throw notFound("Không có huyện cũ này trong tỉnh đã chọn.");
    return c.json({ muc: "huyen" as const, ...kq });
  }
  const kq = bo.chuyenTinh(q.tinh);
  if (!kq) throw notFound("Không có tỉnh cũ mã này.");
  return c.json({ muc: "tinh" as const, ...kq });
});

diaGioiRoute.get("/moi/tinh", async (c) => c.json({ items: (await layBoTra()).dsTinhMoi() }));

diaGioiRoute.get("/moi/tinh/:ma/xa", async (c) => {
  const bo = await layBoTra();
  if (!bo.tinhMoi(c.req.param("ma"))) throw notFound("Không có tỉnh mã này.");
  return c.json({ items: bo.dsXaMoi(c.req.param("ma")) });
});

/** GET /v1/dia-gioi/moi/tim?q=&tinh=: tìm xã mới theo tên, không phân biệt dấu. */
diaGioiRoute.get("/moi/tim", async (c) => {
  const q = parseQuery(
    c,
    z.object({ q: z.string().trim().min(1, "Nhập tên xã, phường").max(100), tinh: maSchema(2).optional() }),
  );
  return c.json({ items: (await layBoTra()).timXaMoi(q.q, q.tinh) });
});

/** GET /v1/dia-gioi/moi/xa/:ma: tra ngược xã mới ra các xã (huyện đảo) cũ đã nhập vào. */
diaGioiRoute.get("/moi/xa/:ma", async (c) => {
  const kq = (await layBoTra()).traNguoc(c.req.param("ma"));
  if (!kq) throw notFound("Không có xã, phường mã này.");
  return c.json(kq);
});

/** POST /v1/dia-gioi/vi-tri { lat, lon }: địa chỉ hiện nay tại tọa độ GPS. */
diaGioiRoute.post("/vi-tri", async (c) => {
  const b = await parseBody(
    c,
    z.object({ lat: z.number().min(8).max(24), lon: z.number().min(102).max(118) }),
  );
  // Tên đường là phần thêm: dịch vụ tắt hoặc lỗi thì vẫn trả xã, tỉnh theo ranh giới.
  const diem =
    (await dichVuNominatim()
      ?.traNguoc(b.lat, b.lon)
      .catch(() => null)) ?? null;
  const kq = await ganDiaGioi(b.lat, b.lon, diem, true);
  if (!kq.xa && !kq.tenDuong) throw notFound(kq.ghiChu ?? "Không xác định được địa chỉ tại vị trí này.");
  return c.json(kq);
});

/** POST /v1/dia-gioi/dia-chi { q }: các địa chỉ hiện nay khớp với địa chỉ gõ tự do. */
diaGioiRoute.post("/dia-chi", async (c) => {
  const b = await parseBody(c, z.object({ q: z.string().trim().min(3, "Nhập địa chỉ cụ thể").max(200) }));
  const dv = dichVuNominatim();
  if (!dv) throw new ApiError(501, "chua_ho_tro", "Chưa kết nối dịch vụ bản đồ.");
  let ds: DiemDiaChi[];
  try {
    ds = await dv.tim(b.q);
  } catch {
    throw new ApiError(503, "dich_vu_loi", "Dịch vụ bản đồ đang không phản hồi, thử lại sau ít phút.");
  }
  return c.json({ items: await Promise.all(ds.map((d) => ganDiaGioi(d.lat, d.lon, d, false, b.q))) });
});
