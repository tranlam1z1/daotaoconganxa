/**
 * Thẻ một khung xử phạt (lib/khung-phat.ts) cho các công cụ nghiệp vụ: hành vi, khung tiền phạt và
 * mức trung bình, trừ điểm, hình thức bổ sung, biện pháp khắc phục, căn cứ kèm nhãn "Cần đối chiếu".
 */
import { type KhungPhat, mucTrungBinh } from "../../lib/khung-phat";
import { khoangTien } from "../../lib/tra-cuu-nhanh";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Notice } from "../ui/Field";

/** Dòng căn cứ dưới một kết luận; căn cứ chưa đối chiếu với kho văn bản thì kèm nhãn. */
export function DongCanCu({ nhan, daDoiChieu }: { nhan: string; daDoiChieu: boolean }) {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-2">
      <span>Căn cứ: {nhan}.</span>
      {daDoiChieu ? null : <Badge tone="warn">Cần đối chiếu</Badge>}
    </p>
  );
}

function TienPhat({ nhan, khung }: { nhan: string; khung: { phatTu: number; phatDen: number } }) {
  return (
    <div>
      <dt className="text-sm font-medium text-ink-2">{nhan}</dt>
      <dd className="mt-1 text-xl font-bold tabular-nums text-danger">
        {khoangTien(khung.phatTu, khung.phatDen)}
      </dd>
      <dd className="mt-0.5 text-sm tabular-nums text-ink-2">
        Mức trung bình: {mucTrungBinh(khung).toLocaleString("vi-VN")} đồng
      </dd>
    </div>
  );
}

export function TheKhungPhat({ khung }: { khung: KhungPhat }) {
  const them = [
    ...(khung.truDiem ? [`Trừ ${String(khung.truDiem).padStart(2, "0")} điểm giấy phép lái xe`] : []),
    ...(khung.boSung ?? []),
    ...(khung.khacPhuc ?? []),
  ];
  return (
    <Card>
      <h3 className="text-base font-medium text-ink-2">{khung.doiTuong}</h3>
      <p className="mt-1 text-base">{khung.hanhVi}.</p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <TienPhat nhan={khung.toChuc ? "Phạt tiền (cá nhân)" : "Phạt tiền"} khung={khung} />
        {khung.toChuc ? <TienPhat nhan="Phạt tiền (tổ chức)" khung={khung.toChuc} /> : null}
      </dl>
      {them.length > 0 ? (
        <ul className="mt-3 grid list-disc gap-1 pl-5 text-base">
          {them.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}
      <DongCanCu nhan={khung.canCu} daDoiChieu={khung.daDoiChieu} />
    </Card>
  );
}

/** Lời nhắc cuối phần kết quả của công cụ có căn cứ chưa đối chiếu. */
export function LuuYDoiChieu({ coKhungPhat = true }: { coKhungPhat?: boolean }) {
  return (
    <Notice className="mt-6">
      Các căn cứ gắn nhãn "Cần đối chiếu" chưa được kiểm tra với nguyên văn đang có hiệu lực trong kho văn
      bản. Hãy đối chiếu văn bản gốc trước khi dùng kết luận này để xử lý vụ việc.
      {coKhungPhat
        ? " Mức trung bình của khung là mức phạt khi không có tình tiết tăng nặng, giảm nhẹ."
        : null}
    </Notice>
  );
}
