/**
 * Kịch bản E2E nhắc học (docs/PLAN.md GĐ15) trên khung điện thoại 360×740: trang /toi có khối
 * "Nhắc học"; cấp quyền thông báo, bấm "Bật nhắc học" thì trình duyệt đăng ký với dịch vụ đẩy và
 * máy chủ lưu đăng ký; đặt giờ nhắc rồi lưu.
 *
 * Cần khóa VAPID cho API (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY trong môi trường khi chạy
 * `bun run e2e nhac-hoc`; sinh bằng `bunx web-push generate-vapid-keys`).
 *
 * Chrome không giao diện không đăng ký được với dịch vụ đẩy thật (subscribe bị từ chối), nên kịch
 * bản thay `PushManager.subscribe` bằng một đăng ký giả có endpoint https. Phần còn lại (quyền,
 * service worker, cầu nối /thong-bao, API, CSDL, cài đặt, tắt) chạy thật. Nhận thông báo trên máy
 * thật là mục soát tay của GĐ15.
 */
import type { NguCanhE2E } from "./chay.ts";

export default async function nhacHoc(n: NguCanhE2E) {
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ nhắc học E2E" });
  const page = await n.moTrang();
  await page.context().grantPermissions(["notifications"], { origin: n.web });
  await page.addInitScript(() => {
    const dangKy = {
      endpoint: `https://push.example.test/e2e/${crypto.randomUUID()}`,
      toJSON() {
        return { endpoint: this.endpoint, keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } };
      },
      unsubscribe: async () => {
        hienTai = null;
        return true;
      },
    };
    let hienTai: typeof dangKy | null = null;
    PushManager.prototype.subscribe = async () => {
      hienTai = dangKy;
      return dangKy as unknown as PushSubscription;
    };
    PushManager.prototype.getSubscription = async () => hienTai as unknown as PushSubscription | null;
  });
  await n.dangNhap(page, tk);

  await page.goto(`${n.web}/toi`);
  const khoi = page.getByRole("region", { name: "Nhắc học" });
  await khoi.waitFor();
  // Service worker đăng ký ở bản build; chờ nó sẵn sàng rồi tải lại để khối đọc đúng trạng thái.
  await page.waitForFunction(async () => Boolean(await navigator.serviceWorker.getRegistration()));
  await page.reload();
  await khoi.getByRole("button", { name: "Bật nhắc học" }).click();
  await khoi.getByLabel(/Giờ nhắc học mỗi ngày/).waitFor({ timeout: 20_000 });

  const [dk] = await n.sql<Array<{ endpoint: string }>>`
    SELECT endpoint FROM push_subscriptions WHERE account_id = ${tk.id}`;
  if (!dk?.endpoint.startsWith("https://"))
    throw new Error("Máy chủ chưa lưu đăng ký thông báo của trình duyệt.");
  console.log(`  đăng ký với dịch vụ đẩy: ${new URL(dk.endpoint).host}`);

  await khoi.getByLabel(/Giờ nhắc học mỗi ngày/).fill("19:30");
  await khoi.getByRole("button", { name: "Lưu cài đặt" }).click();
  await khoi.getByText("Đã lưu cài đặt nhắc học.").waitFor();
  const [cd] = await n.sql<Array<{ remind_at: string }>>`
    SELECT remind_at::text FROM notification_prefs WHERE account_id = ${tk.id}`;
  if (cd?.remind_at !== "19:30:00") throw new Error(`Giờ nhắc lưu sai: ${cd?.remind_at}`);

  // Listener "push" của sw.js: đẩy một thông báo vào service worker qua DevTools Protocol, như dịch
  // vụ đẩy sẽ làm, rồi kiểm thông báo đã hiện với đúng tiêu đề và đường dẫn mở khi bấm.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("ServiceWorker.enable");
  const regId = await new Promise<string>((xong) => {
    cdp.on(
      "ServiceWorker.workerRegistrationUpdated",
      (e: { registrations: Array<{ registrationId: string }> }) => {
        if (e.registrations[0]) xong(e.registrations[0].registrationId);
      },
    );
  });
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin: n.web,
    registrationId: regId,
    data: JSON.stringify({
      tieu_de: "Đến giờ học",
      noi_dung: "Luyện 10 câu",
      url: "/luyen-tap",
      loai: "nhac_hoc",
    }),
  });
  const thongBao = await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const ds = (await reg?.getNotifications()) ?? [];
    return ds.length ? { tieu_de: ds[0]!.title, url: ds[0]!.data?.url } : null;
  });
  const tb = (await thongBao.jsonValue()) as { tieu_de: string; url: string };
  if (tb.tieu_de !== "Đến giờ học" || tb.url !== "/luyen-tap") {
    throw new Error(`Thông báo hiện sai: ${JSON.stringify(tb)}`);
  }
  console.log(`  service worker hiện thông báo "${tb.tieu_de}", bấm vào mở ${tb.url}`);

  await n.kiemKhongCuonNgang(page, "Trang Tôi có khối Nhắc học");
  await n.chupAnh(page, "1-da-bat");

  await khoi.getByRole("button", { name: "Tắt thông báo trên thiết bị này" }).click();
  await khoi.getByRole("button", { name: "Bật nhắc học" }).waitFor();
  await page.waitForTimeout(300);
  const con = await n.sql`SELECT 1 FROM push_subscriptions WHERE account_id = ${tk.id}`;
  if (con.length) throw new Error("Tắt thông báo mà máy chủ vẫn giữ đăng ký.");
}
