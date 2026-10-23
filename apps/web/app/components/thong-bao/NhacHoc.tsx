/**
 * Khối "Nhắc học" ở trang /toi (docs/PLAN.md GĐ15).
 *
 * Chỉ xin quyền thông báo khi người dùng bấm "Bật nhắc học", không xin khi vừa mở trang. Trên
 * iPhone, thông báo chỉ tới được khi trang đã được thêm vào Màn hình chính (iOS 16.4 trở lên),
 * nên hướng dẫn cài đặt hiện TRƯỚC nút bật.
 *
 * Service worker chỉ đăng ký ở bản build (components/layout/TrangThaiMang.tsx); ở bản dev khối này
 * báo trình duyệt chưa sẵn sàng.
 */
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";

import type { action, CauHinhThongBao } from "../../routes/thong-bao";
import { Button } from "../ui/Button";
import { inputClass, Notice } from "../ui/Field";
import { Icon } from "../ui/Icon";

type TinhTrang =
  | "dang-kiem"
  | "khong-ho-tro"
  | "can-cai-ios"
  | "chua-san-sang"
  | "bi-chan"
  | "chua-bat"
  | "da-bat";

/** Khóa công khai VAPID (base64url) -> mảng byte cho pushManager.subscribe. */
function khoaThanhByte(b64: string): Uint8Array {
  const dem = "=".repeat((4 - (b64.length % 4)) % 4);
  const s = atob((b64 + dem).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

function laIosChuaCai(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const daCai =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !daCai;
}

async function dangKyHienTai(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? await reg.pushManager.getSubscription() : null;
}

export function NhacHoc({ laQuanTri = false }: { laQuanTri?: boolean }) {
  const cauHinh = useFetcher<CauHinhThongBao>();
  const ghi = useFetcher<typeof action>();
  const [tinhTrang, datTinhTrang] = useState<TinhTrang>("dang-kiem");
  const [loi, datLoi] = useState<string | null>(null);
  const [dangLam, datDangLam] = useState(false);
  /** Đã gửi đăng ký lên máy chủ, đang chờ kết quả: chỉ báo "đã bật" khi máy chủ lưu xong. */
  const [choXacNhan, datChoXacNhan] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ tải cấu hình một lần khi mở trang
  useEffect(() => {
    cauHinh.load("/thong-bao");
  }, []);

  // Tải lại cấu hình sau mỗi lần ghi, để số thiết bị và cài đặt luôn khớp máy chủ.
  // biome-ignore lint/correctness/useExhaustiveDependencies: phản ứng khi có kết quả ghi mới
  useEffect(() => {
    if (ghi.state !== "idle" || !ghi.data) return;
    cauHinh.load("/thong-bao");
    if (!choXacNhan) return;
    datChoXacNhan(false);
    if ("ok" in ghi.data) datTinhTrang("da-bat");
    else {
      // Máy chủ không lưu được: gỡ đăng ký ở trình duyệt để hai bên không lệch nhau.
      void dangKyHienTai().then((sub) => sub?.unsubscribe());
      datTinhTrang("chua-bat");
    }
  }, [ghi.state, ghi.data]);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        datTinhTrang(laIosChuaCai() ? "can-cai-ios" : "khong-ho-tro");
        return;
      }
      if (laIosChuaCai()) return datTinhTrang("can-cai-ios");
      if (Notification.permission === "denied") return datTinhTrang("bi-chan");
      if (!(await navigator.serviceWorker.getRegistration())) return datTinhTrang("chua-san-sang");
      datTinhTrang((await dangKyHienTai()) ? "da-bat" : "chua-bat");
    })().catch(() => datTinhTrang("khong-ho-tro"));
  }, []);

  const ch = cauHinh.data;

  const bat = async () => {
    if (!ch?.vapid_public_key) return;
    datLoi(null);
    datDangLam(true);
    try {
      const quyen = await Notification.requestPermission();
      if (quyen !== "granted") {
        datTinhTrang(quyen === "denied" ? "bi-chan" : "chua-bat");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: khoaThanhByte(ch.vapid_public_key) as BufferSource,
        }));
      ghi.submit(
        { intent: "dang-ky", du_lieu: JSON.stringify(sub.toJSON()) },
        { method: "post", action: "/thong-bao" },
      );
      datChoXacNhan(true);
    } catch {
      datLoi(
        "Không bật được thông báo trên trình duyệt này. Hãy thử lại, hoặc dùng Chrome, Edge, Safari bản mới.",
      );
    } finally {
      datDangLam(false);
    }
  };

  const tat = async () => {
    datDangLam(true);
    try {
      const sub = await dangKyHienTai();
      if (sub) {
        ghi.submit(
          { intent: "huy", du_lieu: JSON.stringify({ endpoint: sub.endpoint }) },
          { method: "post", action: "/thong-bao" },
        );
        await sub.unsubscribe();
      }
      datTinhTrang("chua-bat");
    } finally {
      datDangLam(false);
    }
  };

  // Máy chủ chưa có khóa gửi thông báo: người học không bật được nên ẩn cả khối; quản trị viên vẫn thấy
  // để biết cần cấu hình.
  if (ch && !ch.da_cau_hinh && !laQuanTri) return null;

  return (
    <section
      aria-labelledby="nhac-hoc"
      className="ho-so-nhac-hoc rounded-card border border-line bg-surface p-5 shadow-card"
    >
      <h2 id="nhac-hoc" className="text-lg font-semibold">
        <Icon name="bell" className="size-6 text-primary" /> Nhắc học
      </h2>
      <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
        Nhận thông báo khi đến giờ học và khi có bài thi mới. Không gửi từ 22h đến 6h.
      </p>

      {ch && !ch.da_cau_hinh ? (
        <Notice className="mt-3">
          Máy chủ chưa được cấu hình để gửi thông báo (thiếu khóa VAPID). Mục này đang ẩn với người học.
        </Notice>
      ) : null}

      {tinhTrang === "can-cai-ios" ? (
        <div className="mt-3 rounded-lg bg-info-soft px-4 py-3 text-[15px] leading-relaxed text-info">
          <p className="font-semibold">Trên iPhone, cần thêm trang vào Màn hình chính trước:</p>
          <ol className="mt-1 list-decimal pl-5">
            <li>Mở trang này bằng Safari, bấm nút Chia sẻ.</li>
            <li>Chọn "Thêm vào Màn hình chính".</li>
            <li>Mở ứng dụng từ biểu tượng mới trên màn hình, vào mục Tôi và bấm "Bật nhắc học".</li>
          </ol>
          <p className="mt-1 text-sm">Cần iOS 16.4 trở lên.</p>
        </div>
      ) : null}
      {tinhTrang === "khong-ho-tro" ? (
        <Notice className="mt-3">
          Trình duyệt này không nhận được thông báo đẩy. Hãy dùng Chrome, Edge hoặc Safari bản mới.
        </Notice>
      ) : null}
      {tinhTrang === "chua-san-sang" ? (
        <Notice className="mt-3">
          Trình duyệt chưa sẵn sàng nhận thông báo. Hãy tải lại trang rồi thử lại.
        </Notice>
      ) : null}
      {tinhTrang === "bi-chan" ? (
        <Notice tone="danger" className="mt-3">
          Thông báo đang bị chặn cho trang này. Mở cài đặt trang của trình duyệt (biểu tượng ổ khóa cạnh địa
          chỉ), cho phép Thông báo, rồi tải lại trang.
        </Notice>
      ) : null}
      {loi ? (
        <Notice tone="danger" className="mt-3">
          {loi}
        </Notice>
      ) : null}
      {ghi.data && "loi" in ghi.data ? (
        <Notice tone="danger" className="mt-3">
          {ghi.data.loi}
        </Notice>
      ) : null}

      {tinhTrang === "chua-bat" && ch?.da_cau_hinh ? (
        <Button className="mt-4 min-h-12 w-full text-base" disabled={dangLam || choXacNhan} onClick={bat}>
          {choXacNhan ? "Đang bật" : "Bật nhắc học"}
        </Button>
      ) : null}

      {tinhTrang === "da-bat" && ch ? <CaiDat caiDat={ch.cai_dat} /> : null}
      {tinhTrang === "da-bat" ? (
        <Button variant="ghost" className="mt-2 w-full" disabled={dangLam} onClick={tat}>
          Tắt thông báo trên thiết bị này
        </Button>
      ) : null}
    </section>
  );
}

// `group_activity` (công tắc thông báo nhóm học cùng, docs/PLAN.md GĐ16a câu N15) có trong phản hồi
// API; kiểu ở routes/thong-bao.tsx chưa khai nên đọc như trường không bắt buộc, mặc định bật.
function CaiDat({ caiDat }: { caiDat: CauHinhThongBao["cai_dat"] & { group_activity?: boolean } }) {
  const f = useFetcher<typeof action>();
  const [gio, datGio] = useState(caiDat.remind_at ?? "");
  const [deThi, datDeThi] = useState(caiDat.new_exam);
  const [nhom, datNhom] = useState(caiDat.group_activity ?? true);

  const oChon = (id: string, nhan: string, gt: boolean, dat: (v: boolean) => void) => (
    <label htmlFor={id} className="flex min-h-11 items-center gap-3 text-[15px]">
      <input
        id={id}
        type="checkbox"
        checked={gt}
        onChange={(e) => dat(e.target.checked)}
        className="size-5"
      />
      {nhan}
    </label>
  );

  return (
    <div className="mt-4 grid gap-2">
      <div>
        <label htmlFor="gio-nhac" className="mb-1.5 block text-sm font-medium text-ink-2">
          Giờ nhắc học mỗi ngày (để trống là không nhắc)
        </label>
        <input
          id="gio-nhac"
          type="time"
          value={gio}
          onChange={(e) => datGio(e.target.value)}
          className={inputClass}
        />
      </div>
      {oChon("de-thi-moi", "Báo khi có bài thi mới được giao", deThi, datDeThi)}
      {oChon("thong-bao-nhom", "Báo khi có lượt cổ vũ hoặc bài mới trong nhóm học cùng", nhom, datNhom)}
      <Button
        variant="secondary"
        className="min-h-12 w-full text-base"
        disabled={f.state !== "idle"}
        onClick={() =>
          f.submit(
            {
              intent: "cai-dat",
              du_lieu: JSON.stringify({
                remind_at: gio ? gio.slice(0, 5) : null,
                new_exam: deThi,
                group_activity: nhom,
              }),
            },
            { method: "post", action: "/thong-bao" },
          )
        }
      >
        Lưu cài đặt
      </Button>
      {f.data && "ok" in f.data ? (
        <p className="text-sm text-ok" role="status">
          {f.data.ok}
        </p>
      ) : null}
      {f.data && "loi" in f.data ? <Notice tone="danger">{f.data.loi}</Notice> : null}
    </div>
  );
}
