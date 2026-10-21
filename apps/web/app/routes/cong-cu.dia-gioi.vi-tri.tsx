/**
 * Lấy vị trí hiện tại: GPS của điện thoại → địa chỉ theo địa giới hành chính mới, kèm địa chỉ theo
 * đơn vị cũ (xã cũ đối chiếu theo tên OpenStreetMap ghi tại vị trí, không có thì ước lượng theo tâm xã
 * cũ gần nhất).
 *
 * Tọa độ chỉ lấy khi bấm nút, gửi bằng POST qua action (không nằm trên URL hay lịch sử trình duyệt)
 * và không được lưu. Phường/xã, tỉnh xác định theo ranh giới của hệ thống (hiện có tỉnh Thanh Hóa);
 * tên đường, số nhà theo OpenStreetMap. Không xác định được (ngoài vùng, API lỗi) thì trang báo rõ và
 * giữ tọa độ vừa lấy để đối chiếu thủ công.
 */
import { useState } from "react";
import { Link, useFetcher } from "react-router";

import { BanDoViTri } from "../components/dia-gioi/BanDoViTri";
import { BangDiaChi, DongDiaChi, DongDiaChiCu, OBieuTuong } from "../components/dia-gioi/ChungDiaGioi";
import { Notice } from "../components/ui/Field";
import { Icon, type IconName } from "../components/ui/Icon";
import { ThanhDinhDay } from "../components/ui/ThanhDinhDay";
import { type DiaChiBanDo, DUONG_DIA_GIOI, LoiDiaGioi, viTriRaDiaChi } from "../lib/dia-gioi";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/cong-cu.dia-gioi.vi-tri";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Lấy vị trí hiện tại", { index: false });
}

type KetQuaAction = { kq: DiaChiBanDo; loi: null } | { kq: null; loi: { code: string; message: string } };

export async function action({ request }: Route.ActionArgs): Promise<KetQuaAction> {
  const f = await request.formData();
  const lat = Number(f.get("lat"));
  const lon = Number(f.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon))
    return { kq: null, loi: { code: "tham_so_khong_hop_le", message: "Tọa độ không hợp lệ." } };
  try {
    return { kq: await viTriRaDiaChi(lat, lon), loi: null };
  } catch (e) {
    // Lỗi có chủ đích (tọa độ sai, không xác định được, chưa kết nối dịch vụ) hiện thành thông báo.
    if (e instanceof LoiDiaGioi && (e.status < 500 || e.status === 501))
      return { kq: null, loi: { code: e.code, message: e.message } };
    throw e;
  }
}

const DAC_DIEM: ReadonlyArray<{ icon: IconName; ten: string; moTa: string }> = [
  { icon: "dinhVi", ten: "Định vị GPS", moTa: "Dùng GPS và định vị của điện thoại." },
  { icon: "file", ten: "Hỗ trợ", moTa: "Lấy địa chỉ phục vụ xử lý hành chính, lập hồ sơ, biên bản." },
  {
    icon: "shield",
    ten: "An toàn, bảo mật",
    moTa: "Thông tin vị trí chỉ phục vụ nghiệp vụ, không lưu trên hệ thống.",
  },
  { icon: "timer", ten: "Thời gian", moTa: "Mỗi lần định vị chờ tối đa 20 giây." },
  {
    icon: "phone",
    ten: "Yêu cầu",
    moTa: "Bật định vị (GPS) trên điện thoại và cho phép trình duyệt truy cập vị trí.",
  },
];

interface ToaDo {
  lat: number;
  lon: number;
  saiSo: number;
}

/** Thông báo cho từng mã lỗi của Geolocation API. */
function loiDinhVi(e: GeolocationPositionError): string {
  if (e.code === e.PERMISSION_DENIED)
    return "Trình duyệt đang chặn quyền truy cập vị trí. Cho phép trang này truy cập vị trí trong cài đặt trình duyệt rồi thử lại.";
  if (e.code === e.TIMEOUT)
    return "Quá 20 giây chưa xác định được vị trí. Thử lại ở nơi thoáng hoặc gần cửa sổ.";
  return "Không xác định được vị trí. Kiểm tra định vị (GPS) trên điện thoại đã bật chưa rồi thử lại.";
}

export default function LayViTriHienTai() {
  const fetcher = useFetcher<typeof action>();
  const [dangDinhVi, setDangDinhVi] = useState(false);
  const [toaDo, setToaDo] = useState<ToaDo | null>(null);
  const [loiGps, setLoiGps] = useState<string | null>(null);

  const dangLay = dangDinhVi || fetcher.state !== "idle";
  const kq = toaDo ? fetcher.data?.kq : null;
  const loiApi = toaDo ? fetcher.data?.loi : null;

  const lay = () => {
    setLoiGps(null);
    if (!window.isSecureContext) {
      setLoiGps("Định vị chỉ hoạt động khi trang được mở qua HTTPS.");
      return;
    }
    if (!("geolocation" in navigator)) {
      setLoiGps("Trình duyệt này không hỗ trợ định vị.");
      return;
    }
    setDangDinhVi(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDangDinhVi(false);
        const t = { lat: pos.coords.latitude, lon: pos.coords.longitude, saiSo: pos.coords.accuracy };
        setToaDo(t);
        fetcher.submit({ lat: String(t.lat), lon: String(t.lon) }, { method: "post" });
      },
      (e) => {
        setDangDinhVi(false);
        setLoiGps(loiDinhVi(e));
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  };

  const nutLay = (
    <button
      type="button"
      onClick={lay}
      disabled={dangLay}
      className="lun flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-lg font-semibold text-on-primary shadow-card hover:bg-primary-hover disabled:opacity-70"
    >
      <Icon name="dinhVi" kieu="net" className="size-6" />
      {dangLay ? "Đang lấy vị trí…" : toaDo ? "Lấy lại vị trí hiện tại" : "Lấy vị trí hiện tại"}
    </button>
  );

  return (
    <div className="wrap max-w-2xl py-6 sm:py-10">
      <p className="hidden md:block">
        <Link
          to={DUONG_DIA_GIOI}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 underline"
        >
          <Icon name="arrowLeft" className="size-4" />
          Chuyển đổi địa giới hành chính
        </Link>
      </p>
      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Lấy vị trí hiện tại</h1>

      {kq ? (
        <div className="mt-5 grid gap-4">
          <div>
            <BanDoViTri lat={kq.lat} lon={kq.lon} saiSo={toaDo?.saiSo} ranhGioi={kq.ranhGioi} />
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${kq.lat},${kq.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 underline"
            >
              Mở vị trí trong Google Maps
              <Icon name="arrowRight" className="size-4" />
            </a>
          </div>
          {kq.ganRanh ? (
            <Notice className="text-base">
              Vị trí nằm sát ranh giới giữa các phường/xã nên lấy phường/xã gần nhất. Đối chiếu thực địa trước
              khi ghi vào hồ sơ.
            </Notice>
          ) : null}
          {kq.ghiChu ? <Notice className="text-base">{kq.ghiChu}</Notice> : null}
          <BangDiaChi tieuDe="Địa chỉ hiện tại (theo địa giới hành chính mới)">
            <DongDiaChi icon="road" nhan="Tên đường">
              {kq.tenDuong ?? <KhongRo />}
            </DongDiaChi>
            <DongDiaChi icon="home" nhan="Số nhà">
              {kq.soNha ?? <KhongRo />}
            </DongDiaChi>
            <DongDiaChi icon="map" nhan="Phường/xã mới">
              {kq.xa ? (
                <Link
                  to={`${DUONG_DIA_GIOI}/tra-nguoc?xa=${kq.xa.ma}`}
                  className="underline decoration-line-strong underline-offset-4 hover:text-primary"
                >
                  {kq.xa.ten}
                </Link>
              ) : (
                <KhongRo />
              )}
            </DongDiaChi>
            <DongDiaChi icon="toaNha" nhan="Tỉnh/thành phố mới">
              {kq.tinh?.ten ?? <KhongRo />}
            </DongDiaChi>
            <DongDiaChi icon="ghim" nhan="Địa chỉ đầy đủ">
              {kq.diaChiDayDu ?? <KhongRo />}
            </DongDiaChi>
          </BangDiaChi>
          {kq.cu ? (
            <BangDiaChi tieuDe="Địa chỉ cũ (theo địa giới hành chính trước sắp xếp)">
              <DongDiaChiCu cu={kq.cu} />
            </BangDiaChi>
          ) : null}
          <details className="text-sm text-ink-2">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium">
              <Icon name="info" kieu="net" className="size-5 shrink-0" />
              Nguồn dữ liệu và lưu ý
            </summary>
            <p className="pb-2 leading-relaxed">
              Phường/xã theo ranh giới tham khảo (Bản đồ đơn vị hành chính, NXB Tài nguyên – Môi trường và Bản
              đồ Việt Nam); tên đường, số nhà theo OpenStreetMap, có thể thiếu hoặc lệch vài nhà do sai số
              GPS. Phường/xã cũ là đơn vị đã nhập vào phường/xã mới mà OpenStreetMap ghi tên tại vị trí; nơi
              bản đồ không ghi thì lấy đơn vị cũ có trung tâm gần vị trí nhất và gắn nhãn Ước lượng. Cần đối
              chiếu thực địa trước khi ghi vào hồ sơ. Căn cứ chính thức là nghị quyết của Ủy ban Thường vụ
              Quốc hội về sắp xếp đơn vị hành chính cấp xã.
            </p>
          </details>
        </div>
      ) : (
        <>
          <p className="mt-2 text-base text-ink-2">
            Xác định nhanh địa chỉ hiện tại theo địa giới hành chính mới bằng định vị GPS.
          </p>
          <ul className="mt-5 grid gap-3">
            {DAC_DIEM.map((d) => (
              <li
                key={d.ten}
                className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card"
              >
                <OBieuTuong icon={d.icon} />
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-snug">{d.ten}</p>
                  <p className="mt-0.5 text-base leading-snug text-ink-2">{d.moTa}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-5" aria-live="polite">
        {loiGps ? (
          <Notice tone="danger" className="mb-4 text-base">
            {loiGps}
          </Notice>
        ) : null}
        {loiApi && toaDo ? (
          <Notice className="mb-4 text-base">
            {loiApi.message}
            <span className="mt-1 block">
              Tọa độ vừa lấy: {toaDo.lat.toFixed(6)}, {toaDo.lon.toFixed(6)} (sai số khoảng{" "}
              {Math.round(toaDo.saiSo).toLocaleString("vi-VN")} m).
            </span>
            <Link
              to={`${DUONG_DIA_GIOI}/thu-cong`}
              className="mt-1 inline-flex min-h-11 items-center underline"
            >
              Tra theo tên đơn vị cũ: Chuyển đổi thủ công
            </Link>
          </Notice>
        ) : null}
        {!kq ? (
          <p className="mb-3 text-center text-sm text-ink-2">
            Kết quả gồm phường/xã, tỉnh theo địa giới hành chính mới (hiện có tỉnh Thanh Hóa), kèm tên đường,
            số nhà khi bản đồ có dữ liệu.
          </p>
        ) : null}
      </div>
      {/* Con trực tiếp của khung trang: nằm trong khối aria-live ngắn thì sticky không có chỗ để dính. */}
      <ThanhDinhDay
        chiDienThoai
        className="-mx-4 border-t border-line bg-canvas px-4 pt-3 md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pt-0"
      >
        {nutLay}
        <p className="mt-3 flex items-start justify-center gap-1.5 text-center text-sm text-ink-2">
          <Icon name="shield" kieu="net" className="mt-0.5 size-4 shrink-0" />
          Thông tin vị trí chỉ lấy khi bấm nút Lấy vị trí hiện tại và không được lưu.
        </p>
      </ThanhDinhDay>
    </div>
  );
}

function KhongRo() {
  return <span className="font-normal text-ink-3">Không xác định được</span>;
}
