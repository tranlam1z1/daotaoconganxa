import { dieuHrefFromUrn, nhanVienDan } from "../../lib/citation";
import { khoangTien, type MucPhat } from "../../lib/tra-cuu-nhanh";
import { Badge } from "../ui/Badge";
import { ButtonLink } from "../ui/Button";

/**
 * Một mức xử phạt: mức tiền in đậm, hình thức bổ sung, số điểm bị trừ và nút mở điều khoản
 * căn cứ (docs/PLAN.md GĐ5). `hienXe` khi danh sách trộn nhiều loại xe.
 */
export function TheMucPhat({ muc, hienXe = false }: { muc: MucPhat; hienXe?: boolean }) {
  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-card">
      <p className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
        {hienXe ? <span className="font-semibold text-ink-2">{muc.tenXe}</span> : null}
        {muc.nhom ? <span>{muc.nhom}</span> : null}
        {muc.banNhap ? <Badge tone="warn">Bản nháp, chưa đối chiếu văn bản</Badge> : null}
      </p>
      <p className="mt-1 text-base leading-relaxed">{muc.hanhVi}</p>
      <ChiTietMucPhat muc={muc} />
    </li>
  );
}

/** Mức tiền, điểm bị trừ, hình thức bổ sung và căn cứ; dùng chung cho thẻ mở rộng ở trang Tra cứu. */
export function ChiTietMucPhat({ muc }: { muc: MucPhat }) {
  return (
    <>
      <p className="mt-3 text-xl font-bold leading-snug text-danger">{khoangTien(muc.phatTu, muc.phatDen)}</p>
      {muc.khungPhat?.length ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-ink-2">Đối chiếu tình tiết để xác định khung áp dụng:</p>
          {muc.khungPhat.map((k) => (
            <section key={k.id} className="rounded-btn border border-line p-3">
              <p className="font-semibold">{khoangTien(Number(k.fine_min), Number(k.fine_max))}</p>
              <p>{k.conditions.join("; ")}</p>
              {k.required_facts.length ? <p>Cần bổ sung: {k.required_facts.join("; ")}</p> : null}
              {k.point_deduction !== null ? <p>Trừ {k.point_deduction} điểm GPLX</p> : null}
              {k.suspension_months_min !== null ? (
                <p>
                  Tước GPLX: {k.suspension_months_min} – {k.suspension_months_max} tháng
                </p>
              ) : null}
              {k.additional_penalties.map((t) => (
                <p key={t}>{t}</p>
              ))}
              {k.remedies.map((t) => (
                <p key={t}>Khắc phục: {t}</p>
              ))}
              <p className="mt-2 text-sm text-ink-3">
                {nhanVienDan(k.citation_urn)} · Từ {k.effective_from.slice(0, 10)}
                {k.effective_to ? ` đến trước ${k.effective_to.slice(0, 10)}` : ""}
              </p>
            </section>
          ))}
        </div>
      ) : null}

      {muc.truDiem || muc.hinhThucBoSung.length ? (
        <ul className="mt-2 grid gap-1 text-base leading-relaxed text-ink-2">
          {muc.truDiem ? (
            <li>
              Trừ <strong className="text-ink">{muc.truDiem} điểm</strong> giấy phép lái xe
            </li>
          ) : null}
          {muc.hinhThucBoSung.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="text-sm text-ink-3">
          Căn cứ: {nhanVienDan(muc.canCu)}
          {muc.canCuMoDuoc ? null : " (văn bản chưa có trong kho)"}
        </span>
        {muc.canCuMoDuoc ? (
          <ButtonLink to={dieuHrefFromUrn(muc.canCu)} variant="secondary">
            Xem điều khoản
          </ButtonLink>
        ) : null}
      </div>
    </>
  );
}
