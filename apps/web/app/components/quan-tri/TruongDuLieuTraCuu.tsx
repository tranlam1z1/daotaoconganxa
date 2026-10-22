/**
 * Khung nhập của dữ liệu tra cứu, dùng chung cho trang soạn mới và khung sửa ở trang duyệt. `d` là dòng
 * đang sửa; bỏ trống khi soạn mới. Tên ô khớp `docMucPhat`, `docBienBao`, `docLuatGiayTo`,
 * `docTocDoToiDa`, `docTaiTrong` (lib/du-lieu-tra-cuu.ts).
 */
import { NHOM_BIEN_BAO } from "../../lib/bien-bao";
import { cn } from "../../lib/cn";
import {
  BIEN_KHOANG,
  KIEU_KIEM_LUAT,
  LOAI_QUA_TAI,
  LOAI_TAI_TRONG,
  LOAI_XE_TAI,
  NHOM_LUAT,
  PHAN_KIEM_LUAT,
  PHAN_LOAI_XE,
  THAM_SO_SO_LUAT,
} from "../../lib/du-lieu-tra-cuu";
import type { ChuDeCauHoi } from "../../lib/ngan-hang";
import { LOAI_XE } from "../../lib/tra-cuu-nhanh";
import { inputClass, Label } from "../ui/Field";
import { OCanCu } from "./OCanCu";

type Dong = Record<string, unknown>;

const o = cn(inputClass, "min-h-11");
const chu = (v: unknown) => (v == null ? "" : String(v));
/** Ngày API trả (dấu thời gian ISO) về dạng ô ngày nhận. */
const ngay = (v: unknown) => chu(v).slice(0, 10);

export function Truong({
  id,
  nhan,
  goiY,
  children,
}: {
  id: string;
  nhan: string;
  goiY?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{nhan}</Label>
      <div className="mt-1">{children}</div>
      {goiY ? <p className="mt-1 text-xs text-ink-3">{goiY}</p> : null}
    </div>
  );
}

/** Căn cứ và khoảng ngày hiệu lực: ba ô có ở tốc độ tối đa và tải trọng. */
function TruongCanCuHieuLuc({ d, khiDoi }: { d?: Dong; khiDoi?: () => void }) {
  return (
    <>
      <Truong id="citation_urn" nhan="Căn cứ">
        <OCanCu
          id="citation_urn"
          name="citation_urn"
          macDinh={chu(d?.citation_urn)}
          batBuoc
          khiDoi={khiDoi}
        />
      </Truong>
      <div className="grid gap-3 sm:grid-cols-2">
        <Truong id="effective_from" nhan="Hiệu lực từ ngày">
          <input
            id="effective_from"
            name="effective_from"
            type="date"
            required
            defaultValue={ngay(d?.effective_from)}
            className={o}
          />
        </Truong>
        <Truong id="effective_to" nhan="Hiệu lực đến ngày" goiY="Bỏ trống nếu còn áp dụng.">
          <input
            id="effective_to"
            name="effective_to"
            type="date"
            defaultValue={ngay(d?.effective_to)}
            className={o}
          />
        </Truong>
      </div>
    </>
  );
}

/** Một khoảng có cận: tốc độ vượt (km/h) hoặc phần trăm quá tải của dòng mức phạt. */
function TruongKhoang({
  d,
  tu,
  den,
  bien,
  bienMacDinh,
  donVi,
  toiDa,
}: {
  d?: Dong;
  tu: string;
  den: string;
  bien: string;
  bienMacDinh: string;
  donVi: string;
  toiDa: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Truong id={tu} nhan={`Vượt từ (${donVi})`}>
        <input
          id={tu}
          name={tu}
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          max={toiDa}
          defaultValue={chu(d?.[tu])}
          className={o}
        />
      </Truong>
      <Truong id={den} nhan={`Vượt đến (${donVi})`} goiY="Bỏ trống nếu không có cận trên.">
        <input
          id={den}
          name={den}
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          max={toiDa}
          defaultValue={chu(d?.[den])}
          className={o}
        />
      </Truong>
      <Truong id={bien} nhan="Cách tính cận">
        <select id={bien} name={bien} defaultValue={chu(d?.[bien]) || bienMacDinh} className={o}>
          {BIEN_KHOANG.map((b) => (
            <option key={b.id} value={b.id}>
              {b.ten}
            </option>
          ))}
        </select>
      </Truong>
    </div>
  );
}

export function TruongMucPhat({ d, khiDoi }: { d?: Dong; khiDoi?: () => void }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Truong id="vehicle" nhan="Loại xe">
          <select id="vehicle" name="vehicle" required defaultValue={chu(d?.vehicle) || "o_to"} className={o}>
            {LOAI_XE.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </Truong>
        <Truong id="group_name" nhan="Nhóm" goiY="Ví dụ: Tốc độ, Nồng độ cồn, Giấy tờ.">
          <input
            id="group_name"
            name="group_name"
            maxLength={200}
            defaultValue={chu(d?.group_name)}
            className={o}
          />
        </Truong>
      </div>
      <Truong id="behavior" nhan="Hành vi vi phạm">
        <textarea
          id="behavior"
          name="behavior"
          required
          minLength={3}
          maxLength={1000}
          rows={2}
          defaultValue={chu(d?.behavior)}
          className={inputClass}
        />
      </Truong>
      <Truong
        id="keywords"
        nhan="Từ khóa tìm kiếm"
        goiY="Cách nhau bằng dấu phẩy. Người học gõ những từ này để tìm ra dòng."
      >
        <input
          id="keywords"
          name="keywords"
          placeholder="quá tốc độ, chạy nhanh"
          defaultValue={((d?.keywords as string[] | null) ?? []).join(", ")}
          className={o}
        />
      </Truong>
      <div className="grid gap-3 sm:grid-cols-3">
        <Truong id="fine_min" nhan="Phạt từ (đồng)">
          <input
            id="fine_min"
            name="fine_min"
            type="number"
            inputMode="numeric"
            required
            min={0}
            step={1000}
            defaultValue={d ? Number(d.fine_min) : undefined}
            className={o}
          />
        </Truong>
        <Truong id="fine_max" nhan="Phạt đến (đồng)">
          <input
            id="fine_max"
            name="fine_max"
            type="number"
            inputMode="numeric"
            required
            min={0}
            step={1000}
            defaultValue={d ? Number(d.fine_max) : undefined}
            className={o}
          />
        </Truong>
        <Truong id="point_deduction" nhan="Trừ điểm GPLX">
          <input
            id="point_deduction"
            name="point_deduction"
            type="number"
            inputMode="numeric"
            min={0}
            max={12}
            defaultValue={chu(d?.point_deduction)}
            className={o}
          />
        </Truong>
      </div>
      <Truong id="extra_penalties" nhan="Hình thức bổ sung, biện pháp khắc phục (mỗi dòng một mục)">
        <textarea
          id="extra_penalties"
          name="extra_penalties"
          rows={3}
          defaultValue={((d?.extra_penalties as string[] | null) ?? []).join("\n")}
          className={inputClass}
        />
      </Truong>
      <fieldset className="grid gap-3 rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-medium">Khoảng tốc độ vượt (chỉ với lỗi quá tốc độ)</legend>
        <TruongKhoang
          d={d}
          tu="speed_over_min"
          den="speed_over_max"
          bien="speed_bounds"
          bienMacDinh="[)"
          donVi="km/h"
          toiDa={300}
        />
      </fieldset>
      <fieldset className="grid gap-3 rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-medium">Khung phần trăm quá tải (chỉ với lỗi quá tải)</legend>
        <Truong id="qua_tai_loai" nhan="Mốc so sánh">
          <select id="qua_tai_loai" name="qua_tai_loai" defaultValue={chu(d?.qua_tai_loai)} className={o}>
            <option value="">Không theo quá tải</option>
            {LOAI_QUA_TAI.map((l) => (
              <option key={l.id} value={l.id}>
                {l.ten}
              </option>
            ))}
          </select>
        </Truong>
        <TruongKhoang
          d={d}
          tu="qua_tai_tu"
          den="qua_tai_den"
          bien="qua_tai_bien"
          bienMacDinh="(]"
          donVi="%"
          toiDa={1000}
        />
      </fieldset>
      <TruongCanCuHieuLuc d={d} khiDoi={khiDoi} />
    </>
  );
}

export function TruongBienBao({ d, khiDoi }: { d?: Dong; khiDoi?: () => void }) {
  return (
    <>
      <Truong
        id="group_name"
        nhan="Nhóm biển"
        goiY="Chữ cái đầu của mã phải thuộc nhóm: P cấm, W nguy hiểm, R hiệu lệnh, I chỉ dẫn, S phụ."
      >
        <select
          id="group_name"
          name="group_name"
          required
          defaultValue={chu(d?.group_name) || "cam"}
          className={o}
        >
          {NHOM_BIEN_BAO.map((n) => (
            <option key={n.value} value={n.value}>
              {n.label}
            </option>
          ))}
        </select>
      </Truong>
      <Truong id="name" nhan="Tên biển">
        <input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={300}
          defaultValue={chu(d?.name)}
          className={o}
        />
      </Truong>
      <Truong id="meaning" nhan="Ý nghĩa">
        <textarea
          id="meaning"
          name="meaning"
          required
          minLength={3}
          maxLength={3000}
          rows={3}
          defaultValue={chu(d?.meaning)}
          className={inputClass}
        />
      </Truong>
      <Truong id="citation_urn" nhan="Căn cứ">
        <OCanCu
          id="citation_urn"
          name="citation_urn"
          macDinh={chu(d?.citation_urn)}
          batBuoc
          khiDoi={khiDoi}
        />
      </Truong>
    </>
  );
}

/**
 * Luật giấy tờ dùng chung một bảng: nhóm quyết định kiểu kiểm, phần được kiểm và tham số
 * nào hợp lệ. Khung hiện đủ mọi lựa chọn; API kiểm sự hợp nhau và báo lại lý do.
 */
export function TruongLuatGiayTo({ d, khiDoi }: { d?: Dong; khiDoi?: () => void }) {
  const thamSo = (d?.params as Record<string, unknown> | null) ?? {};
  const loaiXe = (d?.vehicle_classes as string[] | null) ?? [];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Truong id="nhom" nhan="Nhóm luật">
          <select id="nhom" name="nhom" required defaultValue={chu(d?.nhom) || NHOM_LUAT[0].id} className={o}>
            {NHOM_LUAT.map((n) => (
              <option key={n.id} value={n.id}>
                {n.ten}
              </option>
            ))}
          </select>
        </Truong>
        <Truong id="check_kind" nhan="Kiểu kiểm">
          <select
            id="check_kind"
            name="check_kind"
            required
            defaultValue={chu(d?.check_kind) || "phai_co"}
            className={o}
          >
            {KIEU_KIEM_LUAT.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ten}
              </option>
            ))}
          </select>
        </Truong>
        <Truong id="doc_kind" nhan="Giấy tờ hoặc phần được kiểm">
          <select id="doc_kind" name="doc_kind" defaultValue={chu(d?.doc_kind)} className={o}>
            <option value="">Không</option>
            {PHAN_KIEM_LUAT.map((p) => (
              <option key={p.id} value={p.id}>
                {p.ten}
              </option>
            ))}
          </select>
        </Truong>
      </div>
      <fieldset className="grid gap-1 rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-medium">Loại xe áp dụng (không tích là mọi loại)</legend>
        {PHAN_LOAI_XE.map((x) => (
          <label key={x.id} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
            <input
              type="checkbox"
              name="vehicle_classes"
              value={x.id}
              defaultChecked={loaiXe.includes(x.id)}
              className="size-5 shrink-0"
            />
            {x.ten}
          </label>
        ))}
      </fieldset>
      <Truong id="name" nhan="Tên luật">
        <input
          id="name"
          name="name"
          required
          minLength={5}
          maxLength={300}
          defaultValue={chu(d?.name)}
          className={o}
        />
      </Truong>
      <Truong id="explanation" nhan="Giải thích (hiện cho người chơi)">
        <textarea
          id="explanation"
          name="explanation"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
          defaultValue={chu(d?.explanation)}
          className={inputClass}
        />
      </Truong>
      <fieldset className="grid gap-3 rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-medium">Tham số (chỉ điền ô mà kiểu kiểm cần)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Truong id="truong" nhan="Trường phải khớp với xe">
            <select id="truong" name="truong" defaultValue={chu(thamSo.truong)} className={o}>
              <option value="">Không</option>
              <option value="bien_so">Biển số</option>
              <option value="nhan_hieu">Nhãn hiệu</option>
            </select>
          </Truong>
          <Truong id="hang" nhan="Hạng giấy phép dùng được" goiY="Cách nhau bằng dấu phẩy. Ví dụ: A1, A.">
            <input
              id="hang"
              name="hang"
              defaultValue={((thamSo.hang as string[] | undefined) ?? []).join(", ")}
              className={o}
            />
          </Truong>
          {THAM_SO_SO_LUAT.map((t) => (
            <Truong key={t.id} id={t.id} nhan={t.ten}>
              <input
                id={t.id}
                name={t.id}
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={chu(thamSo[t.id])}
                className={o}
              />
            </Truong>
          ))}
          <Truong id="lam_tron" nhan="Trẻ em: làm tròn">
            <select id="lam_tron" name="lam_tron" defaultValue={chu(thamSo.lam_tron)} className={o}>
              <option value="">Không</option>
              <option value="len">Làm tròn lên</option>
              <option value="xuong">Làm tròn xuống</option>
            </select>
          </Truong>
        </div>
      </fieldset>
      <Truong id="violation_code" nhan="Mã mức phạt (bỏ trống nếu chưa có)">
        <input
          id="violation_code"
          name="violation_code"
          maxLength={80}
          defaultValue={chu(d?.violation_code)}
          className={cn(o, "font-mono text-sm")}
        />
      </Truong>
      <TruongCanCuHieuLuc d={d} khiDoi={khiDoi} />
    </>
  );
}

export function TruongTocDoToiDa({ d, khiDoi }: { d?: Dong; khiDoi?: () => void }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Truong
          id="vehicle_class"
          nhan="Loại xe theo văn bản"
          goiY="Ví dụ: Xe ô tô con, xe ô tô chở người đến 28 chỗ."
        >
          <input
            id="vehicle_class"
            name="vehicle_class"
            required
            minLength={2}
            maxLength={200}
            defaultValue={chu(d?.vehicle_class)}
            className={o}
          />
        </Truong>
        <Truong id="violation_vehicle" nhan="Nhóm xe của bảng mức phạt">
          <select
            id="violation_vehicle"
            name="violation_vehicle"
            required
            defaultValue={chu(d?.violation_vehicle) || "o_to"}
            className={o}
          >
            {LOAI_XE.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </Truong>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Truong
          id="road_type"
          nhan="Mã loại đường"
          goiY="Dòng cùng loại đường dùng chung một mã. Ví dụ: kdc_duong_doi."
        >
          <input
            id="road_type"
            name="road_type"
            required
            minLength={2}
            maxLength={80}
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={chu(d?.road_type)}
            className={cn(o, "font-mono text-sm")}
          />
        </Truong>
        <Truong id="road_type_name" nhan="Tên loại đường" goiY="Ví dụ: Trong khu vực đông dân cư, đường đôi.">
          <input
            id="road_type_name"
            name="road_type_name"
            required
            minLength={2}
            maxLength={200}
            defaultValue={chu(d?.road_type_name)}
            className={o}
          />
        </Truong>
      </div>
      <Truong id="max_speed" nhan="Tốc độ tối đa (km/h)">
        <input
          id="max_speed"
          name="max_speed"
          type="number"
          inputMode="numeric"
          required
          min={5}
          max={200}
          defaultValue={d ? Number(d.max_speed) : undefined}
          className={o}
        />
      </Truong>
      <TruongCanCuHieuLuc d={d} khiDoi={khiDoi} />
    </>
  );
}

export function TruongTaiTrong({ d, khiDoi }: { d?: Dong; khiDoi?: () => void }) {
  return (
    <>
      <Truong id="name" nhan="Tên giới hạn" goiY="Ví dụ: Tổng trọng lượng xe tải ba trục.">
        <input
          id="name"
          name="name"
          required
          minLength={3}
          maxLength={300}
          defaultValue={chu(d?.name)}
          className={o}
        />
      </Truong>
      <div className="grid gap-3 sm:grid-cols-2">
        <Truong id="kind" nhan="Loại giới hạn">
          <select id="kind" name="kind" required defaultValue={chu(d?.kind) || "tong"} className={o}>
            {LOAI_TAI_TRONG.map((l) => (
              <option key={l.id} value={l.id}>
                {l.ten}
              </option>
            ))}
          </select>
        </Truong>
        <Truong id="vehicle_class" nhan="Loại xe" goiY="Bắt buộc với tổng trọng lượng.">
          <select id="vehicle_class" name="vehicle_class" defaultValue={chu(d?.vehicle_class)} className={o}>
            <option value="">Mọi loại xe</option>
            {LOAI_XE_TAI.map((x) => (
              <option key={x.id} value={x.id}>
                {x.ten}
              </option>
            ))}
          </select>
        </Truong>
      </div>
      <Truong id="limit_kg" nhan="Giới hạn (kg)">
        <input
          id="limit_kg"
          name="limit_kg"
          type="number"
          inputMode="numeric"
          required
          min={1}
          max={200000}
          defaultValue={d ? Number(d.limit_kg) : undefined}
          className={o}
        />
      </Truong>
      <fieldset className="grid gap-3 rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-medium">Cụm trục (chỉ với loại giới hạn "Cụm trục")</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Truong id="group_axles" nhan="Số trục trong cụm">
            <select id="group_axles" name="group_axles" defaultValue={chu(d?.group_axles)} className={o}>
              <option value="">Không</option>
              <option value="2">2 trục</option>
              <option value="3">3 trục</option>
            </select>
          </Truong>
          <Truong id="spacing_from_cm" nhan="Khoảng cách trục từ (cm)">
            <input
              id="spacing_from_cm"
              name="spacing_from_cm"
              type="number"
              inputMode="numeric"
              min={0}
              max={5000}
              defaultValue={chu(d?.spacing_from_cm)}
              className={o}
            />
          </Truong>
          <Truong id="spacing_to_cm" nhan="Đến dưới (cm)" goiY="Bỏ trống nếu không có cận trên.">
            <input
              id="spacing_to_cm"
              name="spacing_to_cm"
              type="number"
              inputMode="numeric"
              min={1}
              max={5000}
              defaultValue={chu(d?.spacing_to_cm)}
              className={o}
            />
          </Truong>
        </div>
      </fieldset>
      <TruongCanCuHieuLuc d={d} khiDoi={khiDoi} />
    </>
  );
}

/** Ô chọn chủ đề của dòng; `chuDe` đã xếp theo cây (`sapXepCayChuDe`). */
export function TruongChuDe({
  chuDe,
  macDinh,
}: {
  chuDe: Array<ChuDeCauHoi & { cap: number }>;
  macDinh?: unknown;
}) {
  return (
    <Truong id="topic_id" nhan="Chủ đề (để tính hồ sơ điểm mạnh, điểm yếu)">
      <select id="topic_id" name="topic_id" defaultValue={chu(macDinh)} className={o}>
        <option value="">Không gắn chủ đề</option>
        {chuDe.map((t) => (
          <option key={t.id} value={t.id}>
            {"– ".repeat(t.cap)}
            {t.name}
          </option>
        ))}
      </select>
    </Truong>
  );
}
