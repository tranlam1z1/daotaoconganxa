import { useEffect } from "react";
import { useFetcher } from "react-router";

import {
  TEN_LOAI_MUC,
  TEN_TRANG_THAI_MUC,
  type ThanhVienNhom,
  type TienDoCuaThanhVien,
} from "../../lib/nhom";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Field";
import { HopThoai } from "../ui/HopThoai";
import { KhungCho } from "../ui/KhungCho";
import { ThanhPhanTram } from "./ThanhPhanTram";

/**
 * Phần trăm từng mục của một thành viên. Chỉ có phần trăm, không có điểm hay kết quả làm bài.
 * Trưởng nhóm có thêm "Chuyển quyền trưởng nhóm" và "Mời ra khỏi nhóm" (đi qua hộp xác nhận).
 */
export function HopTienDoThanhVien({
  mo,
  onDong,
  nhomId,
  thanhVien,
  quanLy,
  onChuyenQuyen,
  onMoiRa,
}: {
  mo: boolean;
  onDong: () => void;
  nhomId: string;
  thanhVien: ThanhVienNhom | null;
  /** Người xem là trưởng nhóm, nhóm còn hoạt động và đây không phải chính người xem. */
  quanLy: boolean;
  onChuyenQuyen: (t: ThanhVienNhom) => void;
  onMoiRa: (t: ThanhVienNhom) => void;
}) {
  const f = useFetcher<TienDoCuaThanhVien | { loi: string }>();
  const tai = f.load;
  const accountId = thanhVien?.id;
  useEffect(() => {
    if (mo && accountId) tai(`/nhom/${nhomId}/thanh-vien/${accountId}/tien-do`);
  }, [mo, accountId, nhomId, tai]);

  const duLieu = f.data && "muc" in f.data ? f.data : null;
  const loi = f.data && "loi" in f.data ? f.data.loi : null;

  return (
    <HopThoai mo={mo} onDong={onDong} tieuDe={thanhVien ? `Tiến độ của ${thanhVien.ho_ten}` : "Tiến độ"}>
      <div className="grid gap-4">
        {loi ? <Notice tone="danger">{loi}</Notice> : null}
        {!duLieu && !loi ? <KhungCho nhan="Đang tải tiến độ." dong={4} cao="h-8" /> : null}
        {duLieu ? (
          <>
            <div>
              <p className="mb-1 text-sm text-ink-2">Tiến độ chung</p>
              <ThanhPhanTram
                giaTri={duLieu.phan_tram}
                nhan={`Tiến độ chung của ${duLieu.thanh_vien.ho_ten}`}
              />
            </div>
            {duLieu.muc.length ? (
              <ul className="grid gap-3">
                {duLieu.muc.map((m) => (
                  <li key={m.id}>
                    <p className="text-base font-medium">{m.ten}</p>
                    <p className="text-sm text-ink-2">{TEN_LOAI_MUC[m.loai]}</p>
                    {m.trang_thai === "tinh" ? (
                      <ThanhPhanTram giaTri={m.phan_tram} nhan={`${duLieu.thanh_vien.ho_ten}: ${m.ten}`} />
                    ) : (
                      <p className="text-sm text-warn">{TEN_TRANG_THAI_MUC[m.trang_thai]}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-2">Nhóm chưa có bài nào.</p>
            )}
          </>
        ) : null}
        {quanLy && thanhVien ? (
          <div className="grid gap-2 border-t border-line pt-4">
            <Button size="lg" variant="secondary" onClick={() => onChuyenQuyen(thanhVien)} className="w-full">
              Chuyển quyền trưởng nhóm
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => onMoiRa(thanhVien)}
              className="w-full text-danger"
            >
              Mời ra khỏi nhóm
            </Button>
          </div>
        ) : null}
      </div>
    </HopThoai>
  );
}
