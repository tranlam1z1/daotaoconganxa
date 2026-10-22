/**
 * Phần kết bài giảng (docs/PLAN.md GĐ11): nút "Hoàn thành bài" (đánh dấu bài đã xong) và kiểm
 * tra nhanh 3–5 câu rút từ ngân hàng theo chủ đề của bài. Bài kiểm tra chạy bằng phiên luyện
 * tập của GĐ4: mỗi câu một màn hình, nộp bài rồi mới xem đúng/sai, giải thích và điều khoản gốc.
 */
import { Form } from "react-router";

import type { BaiGiang } from "../../lib/bai-giang";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Field";

export interface KetQuaHoanThanh {
  daXongTruoc: boolean;
}

export function KiemTraCuoiBai({
  bai,
  busy,
  hoanThanh,
  loi,
}: {
  bai: BaiGiang;
  busy: boolean;
  hoanThanh?: KetQuaHoanThanh | undefined;
  loi?: string | undefined;
}) {
  const daXong = bai.trangThai === "xong" || Boolean(hoanThanh);
  const kt = bai.kiemTraCuoiBai;
  return (
    <section aria-labelledby="ket-bai" className="rounded-xl border border-line bg-surface p-4">
      <h2 id="ket-bai" className="text-lg font-semibold">
        Kết bài
      </h2>

      {loi ? (
        <Notice tone="danger" className="mt-3">
          {loi}
        </Notice>
      ) : null}

      {hoanThanh ? (
        <p className="mt-2 text-base font-semibold text-ok" role="status">
          Đã hoàn thành bài.
        </p>
      ) : daXong ? (
        <p className="mt-2 text-base text-ok">Bạn đã hoàn thành bài này.</p>
      ) : (
        <Form method="post" className="mt-3">
          <input type="hidden" name="intent" value="hoan-thanh" />
          <Button type="submit" disabled={busy} className="min-h-12 w-full text-base sm:w-auto">
            Hoàn thành bài
          </Button>
        </Form>
      )}

      {kt ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-base leading-relaxed">
            Kiểm tra nhanh {kt.soCau} câu về chủ đề “{kt.tenChuDe}”.
          </p>
          <Form method="post" className="mt-3">
            <input type="hidden" name="intent" value="kiem-tra" />
            <input type="hidden" name="chu_de" value={kt.chuDe} />
            <input type="hidden" name="so_cau" value={kt.soCau} />
            <Button
              type="submit"
              variant={daXong ? "primary" : "secondary"}
              disabled={busy}
              className="min-h-12 w-full text-base sm:w-auto"
            >
              Làm bài kiểm tra
            </Button>
          </Form>
        </div>
      ) : null}
    </section>
  );
}
