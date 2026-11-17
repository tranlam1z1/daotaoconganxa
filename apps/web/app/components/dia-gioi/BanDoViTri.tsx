/**
 * Bản đồ quanh vị trí vừa lấy: nền OpenStreetMap, viền ranh phường/xã, chấm vị trí kèm vòng sai số GPS.
 *
 * Leaflet chạm `window` khi nạp nên chỉ nạp trong trình duyệt (useEffect); khi kết xuất ở máy chủ khung
 * chỉ ghi tọa độ. Bản đồ chỉ kéo, thu phóng quanh vị trí (minZoom, maxBounds) để luôn ở phạm vi địa
 * phương. Ảnh nền tải thẳng từ tile.openstreetmap.org, phải giữ dòng ghi nguồn OpenStreetMap.
 */
import "leaflet/dist/leaflet.css";
import "./ban-do.css";

import { useEffect, useRef, useState } from "react";

import { Icon } from "../ui/Icon";

type DaGiac = Array<Array<Array<[number, number]>>>;

const NEN_OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const GHI_NGUON = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
/** Nửa cạnh vùng được kéo tới quanh vị trí (độ, ≈ 33 km). */
const PHAM_VI = 0.3;

export function BanDoViTri({
  lat,
  lon,
  saiSo,
  ranhGioi,
}: {
  lat: number;
  lon: number;
  /** Sai số GPS (mét), vẽ thành vòng quanh vị trí. */
  saiSo?: number;
  ranhGioi?: DaGiac | null;
}) {
  const khung = useRef<HTMLDivElement>(null);
  const [daNap, setDaNap] = useState(false);
  // Ảnh nền chưa tải được ô nào mà đã có ô lỗi (mất mạng, máy chặn tile.openstreetmap.org).
  const [matNen, setMatNen] = useState(false);

  useEffect(() => {
    let huy = false;
    let banDo: import("leaflet").Map | undefined;
    import("leaflet")
      .then((m) => {
        // Leaflet là gói CommonJS: bản dựng đưa module qua `default`, môi trường khác có thể không.
        const L = m.default ?? (m as unknown as typeof m.default);
        if (huy || !khung.current) return;
        const mau =
          getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#1b4d3e";
        banDo = L.map(khung.current, {
          minZoom: 12,
          maxZoom: 19,
          maxBounds: L.latLngBounds([lat - PHAM_VI, lon - PHAM_VI], [lat + PHAM_VI, lon + PHAM_VI]),
          maxBoundsViscosity: 1,
        }).setView([lat, lon], 17);
        banDo.attributionControl.setPrefix(false);
        const nen = L.tileLayer(NEN_OSM, { maxZoom: 19, attribution: GHI_NGUON }).addTo(banDo);
        let coNen = false;
        nen.on("tileload", () => {
          coNen = true;
          setMatNen(false);
        });
        nen.on("tileerror", () => setMatNen(!coNen));
        if (ranhGioi)
          L.geoJSON({ type: "MultiPolygon", coordinates: ranhGioi } as Parameters<typeof L.geoJSON>[0], {
            interactive: false,
            style: { color: mau, weight: 2.5, dashArray: "6 4", fillOpacity: 0.05 },
          }).addTo(banDo);
        if (saiSo)
          L.circle([lat, lon], {
            radius: saiSo,
            interactive: false,
            color: mau,
            weight: 1,
            fillOpacity: 0.12,
          }).addTo(banDo);
        L.circleMarker([lat, lon], {
          radius: 8,
          interactive: false,
          color: "#fff",
          weight: 3,
          fillColor: mau,
          fillOpacity: 1,
        }).addTo(banDo);
        setDaNap(true);
      })
      .catch(() => {
        // Không nạp được thư viện bản đồ: khung giữ tọa độ, phần địa chỉ bên dưới vẫn dùng được.
      });
    return () => {
      huy = true;
      banDo?.remove();
    };
  }, [lat, lon, saiSo, ranhGioi]);

  return (
    <div className="ban-do-osm relative isolate h-60 overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-card sm:h-72">
      <div ref={khung} className="absolute inset-0" />
      {matNen ? (
        <p
          role="status"
          className="absolute top-2 right-2 left-14 z-1000 rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-card"
        >
          Không tải được ảnh nền bản đồ. Kiểm tra kết nối mạng, hoặc mở vị trí trong Google Maps.
        </p>
      ) : null}
      {daNap ? null : (
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <Icon name="ghim" className="mx-auto size-10" />
            <p className="mt-2 text-base font-semibold">
              {lat.toFixed(6)}, {lon.toFixed(6)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
