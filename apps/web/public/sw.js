/**
 * Service worker của ứng dụng (docs/PLAN.md GĐ13). Viết tay, không dùng vite-plugin-pwa: ứng dụng
 * render phía máy chủ (React Router SSR) nên không có index.html để plugin sinh danh sách tệp.
 *
 * Chiến lược:
 *  - Tài nguyên tĩnh (/assets/* có mã băm trong tên, icon, manifest, ảnh biển báo): cache-first.
 *  - Trang: network-first. Mất mạng thì:
 *      · trang chạy được offline (TRANG_OFFLINE: luyện tập không cần mạng) lấy bản đã lưu;
 *      · trang khác (thi, hỏi đáp AI, tra cứu…) trả /offline.html "Cần có mạng".
 *  - API, dữ liệu loader (*.data), cầu nối /api/*: không cache, luôn đi mạng. Dữ liệu cá nhân và
 *    đáp án không bao giờ nằm trong cache của service worker (gói offline nằm trong IndexedDB).
 *
 * Trang gửi thông điệp { type: "luu-trang", url } để service worker tải và giữ sẵn một trang
 * chạy offline cùng mọi tệp /assets/ mà trang đó dùng.
 */
// Đổi khi sửa manifest.webmanifest: manifest đi cache-first, máy đã cài chỉ lấy bản mới khi đổi phiên bản.
const PHIEN_BAN = "qdpl-v7-logo-khien";
const CACHE_TINH = `${PHIEN_BAN}-tinh`;
const CACHE_TRANG = `${PHIEN_BAN}-trang`;
const TRANG_DU_PHONG = "/offline.html";
const TRANG_OFFLINE = ["/luyen-tap/offline"];
const TEP_CAI_DAT = [
  TRANG_DU_PHONG,
  "/manifest.webmanifest",
  // "?v=" khớp với manifest.webmanifest và root.tsx; đổi URL để máy đã cài lấy icon mới.
  "/icons/icon-192.png?v=6",
  "/icons/icon-512.png?v=6",
  "/icons/maskable-512.png?v=6",
  "/icons/apple-touch-icon.png?v=6",
  // Biểu tượng thẻ trình duyệt (root.tsx): tải lại trang khi mất mạng vẫn có.
  "/logo.svg?v=6",
  "/icons/icon-48.png?v=6",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE_TINH)
      // reload: bỏ qua cache HTTP (tệp tĩnh có max-age), để manifest mới thay bản cũ trong cache.
      .then((c) => c.addAll(TEP_CAI_DAT.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ds) => Promise.all(ds.filter((k) => !k.startsWith(PHIEN_BAN)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function laTaiNguyenTinh(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/bien-bao/anh/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/logo.svg" ||
    url.pathname === TRANG_DU_PHONG
  );
}

function khongCache(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/v1/") ||
    url.pathname.endsWith(".data") ||
    url.searchParams.has("_data")
  );
}

async function cacheTruoc(req) {
  const daCo = await caches.match(req);
  if (daCo) return daCo;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") {
    const c = await caches.open(CACHE_TINH);
    await c.put(req, res.clone());
  }
  return res;
}

async function trangMangTruoc(req, url) {
  const chayOffline = TRANG_OFFLINE.includes(url.pathname);
  try {
    const res = await fetch(req);
    // Chỉ giữ trang chạy offline, và chỉ bản trả về bình thường (không giữ trang lỗi hay chuyển hướng).
    if (chayOffline && res.ok && !res.redirected) {
      const c = await caches.open(CACHE_TRANG);
      await c.put(url.pathname, res.clone());
    }
    return res;
  } catch {
    if (chayOffline) {
      const daLuu = await caches.match(url.pathname, { cacheName: CACHE_TRANG });
      if (daLuu) return daLuu;
    }
    return (await caches.match(TRANG_DU_PHONG)) ?? Response.error();
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || khongCache(url)) return;
  if (req.mode === "navigate") {
    e.respondWith(trangMangTruoc(req, url));
    return;
  }
  if (laTaiNguyenTinh(url)) e.respondWith(cacheTruoc(req));
});

/** Tải một trang chạy offline và mọi tệp /assets/ trang đó dẫn tới, rồi giữ trong cache. */
async function luuTrang(duong) {
  if (!TRANG_OFFLINE.includes(duong)) return;
  const res = await fetch(duong, { credentials: "include" });
  if (!res.ok || res.redirected) return;
  const html = await res.clone().text();
  await (await caches.open(CACHE_TRANG)).put(duong, res);
  const tep = new Set();
  for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) tep.add(m[1]);
  // Manifest của React Router liệt kê mọi module của route; lấy luôn để điều hướng offline được.
  for (const m of html.matchAll(/"(\/assets\/[^"]+\.(?:js|css))"/g)) tep.add(m[1]);
  const c = await caches.open(CACHE_TINH);
  await Promise.all(
    [...tep].map(async (u) => {
      if (await c.match(u)) return;
      const r = await fetch(u).catch(() => null);
      if (r?.ok) await c.put(u, r);
    }),
  );
}

self.addEventListener("message", (e) => {
  if (e.data?.type === "luu-trang" && typeof e.data.url === "string") {
    e.waitUntil(luuTrang(e.data.url).catch(() => {}));
  }
});

/* ------------------------------------------------------------------ */
/* Thông báo đẩy (docs/PLAN.md GĐ15)                                   */
/* ------------------------------------------------------------------ */

// Worker nhắc học gửi JSON { tieu_de, noi_dung, url, loai } (packages/db/src/thong-bao.ts).
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { noi_dung: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(d.tieu_de || "Quy định Pháp luật", {
      body: d.noi_dung || "",
      icon: "/icons/icon-192.png?v=6",
      badge: "/icons/icon-192.png?v=6",
      // Cùng loại thì thông báo mới thay thông báo cũ, không chất đống trên màn hình khóa.
      tag: d.loai || "qdpl",
      data: { url: typeof d.url === "string" && d.url.startsWith("/") ? d.url : "/" },
    }),
  );
});

// Bấm vào thông báo: đưa tab đang mở của trang về đúng đường dẫn, không có thì mở tab mới.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const duong = e.notification.data?.url || "/";
  e.waitUntil(
    (async () => {
      const ds = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of ds) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          await c.focus();
          if ("navigate" in c) await c.navigate(duong).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(duong);
    })(),
  );
});
