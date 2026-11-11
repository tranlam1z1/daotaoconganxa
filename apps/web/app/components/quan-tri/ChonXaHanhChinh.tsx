/**
 * Chọn xã, phường, đặc khu theo danh mục hiện hành (data/dia-gioi) cho đơn vị loại xã: chọn tỉnh rồi
 * chọn xã. Gửi mã 5 số trong ô ẩn `maHanhChinh`; API kiểm lại mã có trong danh mục.
 * Danh mục tải phía trình duyệt khi ô hiện ra, qua API công khai /v1/dia-gioi. Khi sửa đơn vị đã
 * gắn mã, tra ngược mã để chọn sẵn tỉnh và hiện tên xã.
 */
import { useEffect, useState } from "react";
import { type DonVi, dsTinhMoi, dsXaMoi, traNguoc, type XaMoi } from "../../lib/dia-gioi";
import { inputClass, Label } from "../ui/Field";

export function ChonXaHanhChinh({
  id,
  maHienTai,
  onChonXa,
}: {
  id: string;
  /** Mã xã đang gắn (khi sửa); giữ nguyên nếu người dùng không chọn xã khác. */
  maHienTai: string | null;
  /** Gọi khi chọn một xã, để biểu mẫu điền sẵn tên và mã đơn vị còn trống. */
  onChonXa: (xa: XaMoi) => void;
}) {
  const [ma, datMa] = useState(maHienTai ?? "");
  const [dsTinh, datDsTinh] = useState<DonVi[]>([]);
  const [tinh, datTinh] = useState("");
  const [dsXa, datDsXa] = useState<XaMoi[]>([]);
  const [loi, datLoi] = useState<string | null>(null);
  /** Tên xã đang gắn, để hiện cạnh mã; rỗng khi chưa tra được. */
  const [tenXa, datTenXa] = useState("");

  useEffect(() => {
    dsTinhMoi()
      .then(datDsTinh)
      .catch(() => datLoi("Chưa tải được danh mục tỉnh. Tải lại trang để thử lại."));
  }, []);

  useEffect(() => {
    if (!maHienTai) return;
    let huy = false;
    // Không tra được (mã không còn trong danh mục, lỗi mạng) thì vẫn hiện mã như cũ.
    traNguoc(maHienTai)
      .then((kq) => {
        if (huy) return;
        datTinh(kq.tinhMoi.ma);
        datTenXa(`${kq.xaMoi.ten}, ${kq.tinhMoi.ten}`);
      })
      .catch(() => {});
    return () => {
      huy = true;
    };
  }, [maHienTai]);

  useEffect(() => {
    if (!tinh) return datDsXa([]);
    let huy = false;
    dsXaMoi(tinh)
      .then((ds) => !huy && datDsXa(ds))
      .catch(() => !huy && datLoi("Chưa tải được danh mục xã. Thử chọn lại tỉnh."));
    return () => {
      huy = true;
    };
  }, [tinh]);

  return (
    <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
      <input type="hidden" name="maHanhChinh" value={ma} />
      <div>
        <Label htmlFor={`${id}-tinh`}>Tỉnh, thành phố</Label>
        <select
          id={`${id}-tinh`}
          value={tinh}
          onChange={(e) => {
            datLoi(null);
            datTinh(e.target.value);
          }}
          className={inputClass}
        >
          <option value="">Chọn tỉnh, thành phố</option>
          {dsTinh.map((t) => (
            <option key={t.ma} value={t.ma}>
              {t.ten}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${id}-xa`}>Xã, phường, đặc khu</Label>
        <select
          id={`${id}-xa`}
          value={dsXa.some((x) => x.ma === ma) ? ma : ""}
          disabled={!tinh}
          onChange={(e) => {
            const xa = dsXa.find((x) => x.ma === e.target.value);
            if (!xa) return;
            datMa(xa.ma);
            datTenXa(`${xa.ten}, ${dsTinh.find((t) => t.ma === tinh)?.ten ?? ""}`.replace(/, $/, ""));
            onChonXa(xa);
          }}
          className={inputClass}
        >
          <option value="">{tinh ? "Chọn xã, phường" : "Chọn tỉnh trước"}</option>
          {dsXa.map((x) => (
            <option key={x.ma} value={x.ma}>
              {x.ten}
            </option>
          ))}
        </select>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 text-sm text-ink-3 sm:col-span-2" aria-live="polite">
        {loi ??
          (ma
            ? `Đang gắn: ${tenXa ? `${tenXa} (mã ${ma})` : `mã xã ${ma}`}.`
            : "Chưa gắn mã xã. Có thể bỏ trống nếu đơn vị không theo xã hiện hành.")}
        {ma && !loi ? (
          <button
            type="button"
            onClick={() => {
              datMa("");
              datTenXa("");
            }}
            className="min-h-11 font-medium text-primary underline"
          >
            Bỏ mã xã
          </button>
        ) : null}
      </p>
    </div>
  );
}
