/**
 * Soạn dòng dữ liệu tra cứu mới trong ứng dụng, đủ bảy loại: mức phạt, biển báo (kèm ảnh), quy trình,
 * tốc độ tối đa, luật giấy tờ, tải trọng, biểu mẫu (tải tệp Word, PDF, Excel lên). Dòng vào bản nháp hoặc
 * chờ duyệt, rồi duyệt ở trang Duyệt dữ liệu tra cứu như dòng nạp từ tệp. Dòng soạn ở đây không bị lệnh
 * nạp tệp (`bun run tra-cuu:nap`) chuyển sang ngừng.
 */
import { Form, Link, redirect, useNavigation } from "react-router";
import { SuaBuocQuyTrinh } from "../components/quan-tri/SuaBuocQuyTrinh";
import {
  Truong,
  TruongBienBao,
  TruongChuDe,
  TruongLuatGiayTo,
  TruongMucPhat,
  TruongTaiTrong,
  TruongTocDoToiDa,
} from "../components/quan-tri/TruongDuLieuTraCuu";
import { Button } from "../components/ui/Button";
import { inputClass, Notice } from "../components/ui/Field";
import { TieuDeTrang } from "../components/ui/KhungTrang";
import { ThanhLuuBieuMau } from "../components/ui/ThanhDinhDay";
import { cn } from "../lib/cn";
import {
  docBuocQuyTrinh,
  docLuatGiayTo,
  docMucPhat,
  docTaiTrong,
  docTocDoToiDa,
  LOAI_SOAN,
  laLoaiSoan,
  NHAN_ANH_BIEN_BAO,
} from "../lib/du-lieu-tra-cuu";
import { type ChuDeCauHoi, sapXepCayChuDe } from "../lib/ngan-hang";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import { LOAI_TEP_TAI_LIEU, NHAN_TEP_TAI_LIEU } from "../lib/tai-lieu";
import { CHU_DE_MUC_PHAT, LOAI_XE } from "../lib/tra-cuu-nhanh";
import type { Route } from "./+types/quan-tri.du-lieu-tra-cuu.moi";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Soạn nội dung tra cứu", { index: false });
}

const API = "/v1/quan-tri/du-lieu-tra-cuu";

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const p = new URL(request.url).searchParams;
  const raw = p.get("loai");
  const loai = laLoaiSoan(raw) ? raw : "muc-phat";
  const chuDe = await goiApiQuanTri<{ items: ChuDeCauHoi[] }>(token, "/v1/quan-tri/ngan-hang/chu-de");
  return { loai, chuDe: sapXepCayChuDe(chuDe.items) };
}

const chu = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const chuHoacNull = (v: FormDataEntryValue | null) => chu(v) || null;

/** Trường chữ gửi kèm tệp của hai loại soạn bằng form multipart. */
const TRUONG_FORM = {
  "bieu-mau": ["code", "kind", "title", "summary", "vehicle", "group_name", "note", "topic_id"],
  "bien-bao": ["code", "group_name", "name", "meaning", "citation_urn", "note", "topic_id"],
} as const;

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const f = await request.formData();
  const loai = String(f.get("loai"));
  if (!laLoaiSoan(loai)) return { loi: "Loại dữ liệu không soạn được." };
  const chung = {
    code: chu(f.get("code")),
    note: chuHoacNull(f.get("note")),
    topic_id: chuHoacNull(f.get("topic_id")),
    gui_duyet: f.get("intent") === "luu-gui-duyet",
  };
  if (loai === "bieu-mau" || loai === "bien-bao") {
    const tep = f.get("tep");
    if (!(tep instanceof File) || !tep.size)
      return { loi: loai === "bieu-mau" ? "Chưa chọn tệp biểu mẫu." : "Chưa chọn ảnh biển." };
    // API nhận form multipart: trường chữ trống thì không gửi, API coi như không có.
    const form = new FormData();
    form.set("tep", tep, tep.name);
    for (const k of TRUONG_FORM[loai]) {
      if (chu(f.get(k))) form.set(k, chu(f.get(k)));
    }
    if (chung.gui_duyet) form.set("gui_duyet", "1");
    try {
      const moi = await goiApiQuanTri<{ code: string }>(token, `${API}/${loai}`, {
        form,
        timeoutMs: 60_000,
      });
      return redirect(`/quan-tri/du-lieu-tra-cuu?${new URLSearchParams({ loai, ma: moi.code, vua: "tao" })}`);
    } catch (err) {
      if (err instanceof LoiApi) return { loi: err.message };
      throw err;
    }
  }
  let body: Record<string, unknown>;
  if (loai === "luat-giay-to") {
    body = { ...chung, ...docLuatGiayTo(f) };
  } else if (loai === "toc-do-toi-da") {
    body = { ...chung, ...docTocDoToiDa(f) };
  } else if (loai === "tai-trong") {
    body = { ...chung, ...docTaiTrong(f) };
  } else if (loai === "muc-phat") {
    body = { ...chung, ...docMucPhat(f) };
  } else {
    const steps = docBuocQuyTrinh(f.get("steps"));
    if (!steps) return { loi: "Các bước chưa đọc được. Tải lại trang rồi thử lại." };
    body = {
      ...chung,
      kind: chu(f.get("kind")),
      title: chu(f.get("title")),
      summary: chuHoacNull(f.get("summary")),
      vehicle: chuHoacNull(f.get("vehicle")),
      group_name: chuHoacNull(f.get("group_name")),
      steps,
    };
  }
  try {
    const moi = await goiApiQuanTri<{ code: string }>(token, `${API}/${loai}`, { body });
    return redirect(`/quan-tri/du-lieu-tra-cuu?${new URLSearchParams({ loai, ma: moi.code, vua: "tao" })}`);
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
}

const o = cn(inputClass, "min-h-11");
const so = cn(o, "font-mono text-sm");

/** Phương tiện và loại vi phạm của quy trình, biểu mẫu: hai bộ lọc ở trang Quy trình, Biểu mẫu. */
function KhungPhanLoai() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Truong id="vehicle" nhan="Phương tiện">
        <select id="vehicle" name="vehicle" defaultValue="" className={o}>
          <option value="">Mọi phương tiện</option>
          {LOAI_XE.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
      </Truong>
      <Truong id="group_name" nhan="Loại vi phạm">
        <select id="group_name" name="group_name" defaultValue="" className={o}>
          <option value="">Không gắn</option>
          {CHU_DE_MUC_PHAT.map((c) => (
            <option key={c.ma} value={c.ten}>
              {c.ten}
            </option>
          ))}
        </select>
      </Truong>
    </div>
  );
}

function KhungBieuMau() {
  return (
    <>
      <Truong id="kind" nhan="Loại tài liệu">
        <select id="kind" name="kind" required defaultValue="bieu_mau" className={o}>
          {LOAI_TEP_TAI_LIEU.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </Truong>
      <Truong id="title" nhan="Tên biểu mẫu" goiY="Ví dụ: Mẫu biên bản vi phạm hành chính.">
        <input id="title" name="title" required minLength={3} maxLength={300} className={o} />
      </Truong>
      <Truong id="summary" nhan="Tóm tắt" goiY="Dùng khi nào, ai lập, kèm theo văn bản nào.">
        <textarea id="summary" name="summary" rows={2} maxLength={2000} className={inputClass} />
      </Truong>
      <Truong
        id="tep"
        nhan="Tệp biểu mẫu"
        goiY="PDF, Word (.docx, .doc) hoặc Excel (.xlsx, .xls); tối đa 20 MB. PDF xem được ngay trong ứng dụng, Word và Excel cán bộ tải về."
      >
        <input
          id="tep"
          name="tep"
          type="file"
          required
          accept={NHAN_TEP_TAI_LIEU}
          className={cn(inputClass, "py-2")}
        />
      </Truong>
      <KhungPhanLoai />
    </>
  );
}

function KhungQuyTrinh() {
  return (
    <>
      <Truong id="kind" nhan="Loại quy trình">
        <select id="kind" name="kind" required defaultValue="vi_pham" className={o}>
          <option value="hanh_chinh">Thủ tục hành chính</option>
          <option value="nghiep_vu">Quy trình nghiệp vụ</option>
          <option value="cong_tac_dang">Công tác Đảng</option>
          <option value="vi_pham">Xử lý vi phạm</option>
          <option value="tai_nan">Xử lý tai nạn</option>
        </select>
      </Truong>
      <Truong id="title" nhan="Tên quy trình">
        <input id="title" name="title" required minLength={3} maxLength={300} className={o} />
      </Truong>
      <Truong id="summary" nhan="Tóm tắt">
        <textarea id="summary" name="summary" rows={2} maxLength={2000} className={inputClass} />
      </Truong>
      <KhungPhanLoai />
      <SuaBuocQuyTrinh />
    </>
  );
}

export default function SoanDuLieuTraCuu({ loaderData, actionData }: Route.ComponentProps) {
  const { loai, chuDe } = loaderData;
  const busy = useNavigation().state !== "idle";
  const loi = actionData && "loi" in actionData ? actionData.loi : null;

  return (
    <div className="max-w-3xl">
      <p className="hidden text-sm md:block">
        <Link
          to={`/quan-tri/du-lieu-tra-cuu?loai=${loai}`}
          className="inline-flex min-h-11 items-center text-primary underline"
        >
          Duyệt dữ liệu tra cứu
        </Link>
      </p>
      <TieuDeTrang icon="search" className="mt-2">
        Soạn nội dung tra cứu
      </TieuDeTrang>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
        Dòng mới vào bản nháp, hoặc chờ duyệt nếu chọn "Lưu và gửi duyệt". Người học chỉ thấy dòng đã duyệt.
        Quy trình và biểu mẫu hiện ở trang Quy trình, Biểu mẫu.
      </p>

      <nav aria-label="Loại dữ liệu" className="mt-6 flex flex-wrap gap-2">
        {LOAI_SOAN.map((l) => (
          <Link
            key={l.id}
            to={`?loai=${l.id}`}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-sm",
              loai === l.id
                ? "border-primary bg-primary-soft font-semibold text-primary"
                : "border-line-strong",
            )}
          >
            {l.ten}
          </Link>
        ))}
      </nav>

      {loi ? (
        <Notice tone="danger" className="mt-4">
          {loi}
        </Notice>
      ) : null}

      <Form
        method="post"
        encType={loai === "bieu-mau" || loai === "bien-bao" ? "multipart/form-data" : undefined}
        className="mt-6 grid gap-4"
        key={loai}
      >
        <input type="hidden" name="loai" value={loai} />
        {/* Biển báo dùng mã của quy chuẩn (P.102); các loại khác dùng mã tự đặt. */}
        <Truong
          id="code"
          nhan="Mã"
          goiY={
            loai === "bien-bao"
              ? "Mã biển theo quy chuẩn: một chữ cái nhóm, dấu chấm, ba chữ số, có thể thêm một chữ thường. Ví dụ: P.102, W.207a."
              : "Chữ thường không dấu, số, nối bằng gạch ngang; không trùng mã đã có. Ví dụ: moto-khong-doi-mu-bao-hiem."
          }
        >
          <input
            id="code"
            name="code"
            required
            minLength={3}
            maxLength={80}
            pattern={loai === "bien-bao" ? "[PWRIS]\\.[0-9]{3}[a-z]?" : "[a-z0-9]+(-[a-z0-9]+)*"}
            autoCapitalize="none"
            spellCheck={false}
            className={so}
          />
        </Truong>
        {loai === "muc-phat" ? (
          <TruongMucPhat />
        ) : loai === "bien-bao" ? (
          <>
            <TruongBienBao />
            <Truong id="tep" nhan="Ảnh biển" goiY="SVG, PNG hoặc WebP; tối đa 2 MB.">
              <input
                id="tep"
                name="tep"
                type="file"
                required
                accept={NHAN_ANH_BIEN_BAO}
                className={cn(inputClass, "py-2")}
              />
            </Truong>
          </>
        ) : loai === "bieu-mau" ? (
          <KhungBieuMau />
        ) : loai === "luat-giay-to" ? (
          <TruongLuatGiayTo />
        ) : loai === "toc-do-toi-da" ? (
          <TruongTocDoToiDa />
        ) : loai === "tai-trong" ? (
          <TruongTaiTrong />
        ) : (
          <KhungQuyTrinh />
        )}
        <TruongChuDe chuDe={chuDe} />
        <Truong id="note" nhan="Ghi chú biên tập">
          <textarea id="note" name="note" rows={2} maxLength={2000} className={inputClass} />
        </Truong>
        <ThanhLuuBieuMau loi={loi}>
          <Button type="submit" name="intent" value="luu" variant="secondary" disabled={busy}>
            Lưu nháp
          </Button>
          <Button type="submit" name="intent" value="luu-gui-duyet" disabled={busy}>
            Lưu và gửi duyệt
          </Button>
        </ThanhLuuBieuMau>
      </Form>
    </div>
  );
}
