/**
 * Tra địa chỉ qua Nominatim (OpenStreetMap): tọa độ → số nhà, tên đường, và địa chỉ gõ tự do → tọa độ.
 * Chỉ lấy phần dưới cấp xã; xã, tỉnh luôn xác định theo ranh giới của hệ thống (routes/dia-gioi.ts),
 * vì tên đơn vị trên OpenStreetMap có nơi còn theo địa giới cũ. Tên đơn vị bản đồ ghi tại điểm
 * (`tenDonVi`) chỉ dùng để đối chiếu ra xã cũ trong số các xã cũ đã nhập vào xã mới.
 *
 * Máy chủ công cộng nominatim.openstreetmap.org chỉ cho tối đa 1 lượt/giây, phải xưng danh bằng
 * User-Agent và ghi nguồn OpenStreetMap: các lượt gọi xếp hàng cách nhau ít nhất 1 giây. Không lưu
 * đệm, không ghi tọa độ hay địa chỉ vào nhật ký.
 *
 * Biến môi trường:
 *   NOMINATIM_URL         máy chủ Nominatim (mặc định máy chủ công cộng); "off" để tắt (kiểm thử).
 *   NOMINATIM_USER_AGENT  tên ứng dụng kèm liên hệ, theo chính sách sử dụng của máy chủ công cộng.
 */

/** Một điểm địa chỉ dịch vụ trả về. */
export interface DiemDiaChi {
  lat: number;
  lon: number;
  soNha: string | null;
  tenDuong: string | null;
  /** Tên các đơn vị từ khu phố đến huyện bản đồ ghi tại điểm, có nơi theo địa giới cũ. */
  tenDonVi: string[];
}

export interface DichVuDiaChi {
  traNguoc(lat: number, lon: number): Promise<DiemDiaChi | null>;
  tim(q: string): Promise<DiemDiaChi[]>;
}

const MAC_DINH = "https://nominatim.openstreetmap.org";
const CACH_NHAU_MS = 1_100;
const CHO_TOI_DA_MS = 8_000;

/** Khung tìm ưu tiên quanh tỉnh Thanh Hóa (vùng đang có ranh giới), không loại kết quả ngoài khung. */
const KHUNG_UU_TIEN = "104.37,20.68,106.08,19.28";

/** Các trường địa chỉ của Nominatim mang tên đơn vị dưới cấp tỉnh. */
const TRUONG_DON_VI = [
  "neighbourhood",
  "quarter",
  "hamlet",
  "village",
  "suburb",
  "subdivision",
  "borough",
  "city_district",
  "district",
  "town",
  "city",
  "municipality",
  "county",
  "state_district",
];

interface KetQuaNominatim {
  lat: string;
  lon: string;
  name?: string;
  addresstype?: string;
  address?: Record<string, string | undefined>;
}

let hang: Promise<unknown> = Promise.resolve();
let lanCuoi = 0;

/** Xếp hàng: mỗi lượt gọi cách lượt trước ít nhất CACH_NHAU_MS. */
function xepHang<T>(goi: () => Promise<T>): Promise<T> {
  const lan = hang.then(async () => {
    const cho = lanCuoi + CACH_NHAU_MS - Date.now();
    if (cho > 0) await Bun.sleep(cho);
    lanCuoi = Date.now();
    return goi();
  });
  hang = lan.catch(() => undefined);
  return lan;
}

function sangDiem(r: KetQuaNominatim): DiemDiaChi {
  const a = r.address ?? {};
  // Điểm trả về chính là con đường (tọa độ rơi trên đường) thì tên nằm ở `name`.
  const tenDuong = a.road ?? a.pedestrian ?? a.footway ?? (r.addresstype === "road" ? r.name : undefined);
  return {
    lat: Number(r.lat),
    lon: Number(r.lon),
    soNha: a.house_number?.trim() || null,
    tenDuong: tenDuong?.trim() || null,
    tenDonVi: TRUONG_DON_VI.map((k) => a[k]?.trim()).filter((t): t is string => !!t),
  };
}

/** Dịch vụ theo biến môi trường; null khi đã tắt. */
export function dichVuNominatim(): DichVuDiaChi | null {
  const goc = (process.env.NOMINATIM_URL || MAC_DINH).replace(/\/+$/, "");
  if (goc === "off") return null;
  const appUrl = process.env.APP_URL;
  const userAgent = process.env.NOMINATIM_USER_AGENT || `quydinhphapluat/1.0${appUrl ? ` (+${appUrl})` : ""}`;

  const goi = (duong: string, q: Record<string, string>) =>
    xepHang(async () => {
      const p = new URLSearchParams({ format: "jsonv2", addressdetails: "1", "accept-language": "vi", ...q });
      const res = await fetch(`${goc}${duong}?${p}`, {
        headers: { "user-agent": userAgent, accept: "application/json" },
        signal: AbortSignal.timeout(CHO_TOI_DA_MS),
      });
      if (!res.ok) throw new Error(`Nominatim ${duong} trả về ${res.status}`);
      return res.json() as Promise<unknown>;
    });

  return {
    async traNguoc(lat, lon) {
      const r = (await goi("/reverse", { lat: String(lat), lon: String(lon), zoom: "18" })) as
        | (KetQuaNominatim & { error?: string })
        | null;
      return r && !r.error ? { ...sangDiem(r), lat, lon } : null;
    },
    async tim(q) {
      const ds = (await goi("/search", {
        q,
        countrycodes: "vn",
        viewbox: KHUNG_UU_TIEN,
        limit: "5",
      })) as KetQuaNominatim[];
      return Array.isArray(ds) ? ds.map(sangDiem) : [];
    },
  };
}
