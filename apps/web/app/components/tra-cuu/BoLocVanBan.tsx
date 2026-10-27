import { type BoLocVanBan as BoLoc, type DanhMucLoc, NHOM_VAN_BAN } from "../../lib/bo-loc-van-ban";
import { DOC_STATUS_LABEL, docTypeLabel } from "../../lib/format";

const khung = "mt-1 min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-ink";
export function BoLocVanBan({ loc, facets }: { loc: BoLoc; facets: DanhMucLoc }) {
  function chon(k: keyof BoLoc, nhan: string, options: Array<{ value: string; label?: string }>) {
    const all =
      options.some((o) => o.value === loc[k]) || !loc[k] ? options : [...options, { value: loc[k] }];
    return (
      <label className="block min-w-0 text-sm">
        {nhan}
        <select name={k} defaultValue={loc[k]} className={khung}>
          <option value="">Tất cả</option>
          {all.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label ?? o.value}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {chon(
          "family",
          "Nhóm văn bản",
          Object.entries(NHOM_VAN_BAN).map(([value, label]) => ({ value, label })),
        )}
        {chon(
          "status",
          loc.family === "dang" ? "Trạng thái được ghi nhận" : "Hiệu lực tại ngày tra cứu",
          Object.entries(DOC_STATUS_LABEL).map(([value, label]) => ({ value, label })),
        )}
      </div>
      <details
        open={Boolean(loc.docType || loc.field || loc.issuer || loc.locality || loc.scope || loc.asOf)}
      >
        <summary className="flex min-h-11 cursor-pointer items-center font-medium text-primary">
          Lọc nâng cao
        </summary>
        <div className="grid gap-3 sm:grid-cols-2">
          {chon(
            "docType",
            "Loại văn bản",
            (facets.docType ?? []).map((v) => ({ ...v, label: docTypeLabel(v.value) })),
          )}
          {chon("field", "Lĩnh vực", facets.field ?? [])}
          {chon("issuer", "Cơ quan ban hành", facets.issuer ?? [])}
          {chon("scope", "Phạm vi", [
            { value: "trung_uong", label: "Trung ương" },
            { value: "dia_phuong", label: "Địa phương" },
          ])}
          {chon("locality", "Địa phương", facets.locality ?? [])}
          <label className="block text-sm">
            Tra tại ngày
            <input type="date" name="asOf" defaultValue={loc.asOf} className={khung} />
          </label>
        </div>
      </details>
      <label className="block text-sm">
        Sắp xếp
        <select name="sort" defaultValue={loc.sort || "phu_hop"} className={khung}>
          <option value="phu_hop">Phù hợp với từ khóa</option>
          <option value="moi_nhat">Mới ban hành</option>
          <option value="thu_bac">Thứ bậc văn bản</option>
        </select>
      </label>
    </div>
  );
}
