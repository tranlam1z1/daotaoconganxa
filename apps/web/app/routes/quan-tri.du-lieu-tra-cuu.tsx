/**
 * Duyệt dữ liệu tra cứu trong ứng dụng (docs/PLAN.md GĐ-G0): mức phạt, biển báo, quy trình, biểu mẫu
 * đi qua cùng vòng đời duyệt với câu hỏi. Tệp JSON trong data/ chỉ còn là nguồn nhập: dòng mới hoặc
 * đổi nội dung khi nạp vào "Chờ duyệt".
 *
 * Danh sách và chi tiết trên một trang. Tab loại báo số dòng chờ duyệt; người có quyền duyệt mở trang là
 * vào thẳng các dòng chờ duyệt (khi còn), duyệt hoặc từ chối ngay trên dòng, hoặc tích nhiều dòng rồi
 * duyệt một lần. Chọn một dòng (`?ma=`) thì hiện khung sửa; xử lý xong dòng đang mở thì trang tự mở
 * dòng kế tiếp của cùng hàng chờ (`?vua=`, `?truoc=` mang lời báo qua lần chuyển trang).
 *
 * Quy trình và biểu mẫu có thêm khung "Phân loại và ghim" (phương tiện, loại vi phạm, ghim lên đầu mục
 * phổ biến): lưu ở đây không đổi trạng thái duyệt. Biểu mẫu có thêm khung xem và thay tệp.
 *
 * Dòng nháp hoặc bị từ chối chưa từng được duyệt thì xóa hẳn được; dòng khác chỉ ngừng dùng, và dòng đã
 * ngừng dùng khôi phục được về bản nháp.
 */
import { useState } from "react";
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
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink, buttonClass } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { ThanhLuuBieuMau } from "../components/ui/ThanhDinhDay";
import { nhanVienDan } from "../lib/citation";
import { cn } from "../lib/cn";
import {
  type BuocQuyTrinh,
  docBienBao,
  docBuocQuyTrinh,
  docLuatGiayTo,
  docMucPhat,
  docTaiTrong,
  docTocDoToiDa,
  laLoaiSoan,
  NHAN_ANH_BIEN_BAO,
  NHOM_LUAT,
  urlAnhBienBao,
} from "../lib/du-lieu-tra-cuu";
import { formatNgayGio } from "../lib/format";
import {
  type ChuDeCauHoi,
  sapXepCayChuDe,
  TEN_TRANG_THAI,
  TONE_TRANG_THAI,
  type TrangThaiCauHoi,
} from "../lib/ngan-hang";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { duVaiTro, type VaiTro, yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import { dungLuongTep, LOAI_TEP_TAI_LIEU, NHAN_TEP_TAI_LIEU } from "../lib/tai-lieu";
import { CHU_DE_MUC_PHAT, khoangTien, LOAI_XE } from "../lib/tra-cuu-nhanh";
import type { Route } from "./+types/quan-tri.du-lieu-tra-cuu";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Duyệt dữ liệu tra cứu", { index: false });
}

const API = "/v1/quan-tri/du-lieu-tra-cuu";
const DUONG = "/quan-tri/du-lieu-tra-cuu";
const MOI_TRANG = 25;
const LOAI = [
  { id: "muc-phat", ten: "Mức phạt" },
  { id: "bien-bao", ten: "Biển báo" },
  { id: "quy-trinh", ten: "Quy trình" },
  { id: "toc-do-toi-da", ten: "Tốc độ tối đa" },
  // Luật giấy tờ của trò Kiểm tra giấy tờ (GĐ-T1).
  { id: "luat-giay-to", ten: "Luật giấy tờ" },
  // Giới hạn tải trọng của trò Trạm cân tải trọng (GĐ-T12).
  { id: "tai-trong", ten: "Tải trọng" },
  // Biểu mẫu, hướng dẫn dạng tệp của trang Quy trình, Biểu mẫu.
  { id: "bieu-mau", ten: "Biểu mẫu" },
] as const;
type Loai = (typeof LOAI)[number]["id"];

/** Bộ lọc trạng thái trên trang; `tat_ca` là không lọc. */
const LOC_TRANG_THAI = ["tat_ca", "cho_duyet", "nhap", "da_duyet", "tu_choi", "luu_tru"] as const;
type LocTrangThai = (typeof LOC_TRANG_THAI)[number];

interface Dong {
  code: string;
  ten: string;
  trang_thai: TrangThaiCauHoi;
  version: number;
  reject_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  topic_id: string | null;
  updated_at: string;
  [k: string]: unknown;
}

interface DanhSach {
  items: Dong[];
  tong: number;
  trang: number;
  dem: Record<string, number>;
  dem_cho_duyet: Record<string, number>;
  vai_tro_duyet: VaiTro;
}

type ChiTiet = Dong & {
  lich_su: Array<{
    version: number;
    action: string;
    actor: string;
    note: string | null;
    created_at: string;
  }>;
};

const NHOM = NHOM_LUAT;

/** Việc vừa làm xong với một dòng, mang qua lần chuyển trang sang dòng kế tiếp. */
const DA_XONG = {
  duyet: "Đã duyệt",
  "tu-choi": "Đã từ chối",
  "gui-duyet": "Đã gửi duyệt",
} as const;
type ViecXong = keyof typeof DA_XONG;

export async function loader({ request }: Route.LoaderArgs) {
  const { token, nguoiDung } = await yeuCauVaiTro(request, "quan_ly");
  const url = new URL(request.url);
  const p = url.searchParams;
  const loai = (LOAI.some((l) => l.id === p.get("loai")) ? p.get("loai") : "muc-phat") as Loai;
  // Nhóm luật giấy tờ (GĐ-T11): giấy tờ người lái hoặc hồ sơ phạt nguội.
  const nhom = loai === "luat-giay-to" && NHOM.some((n) => n.id === p.get("nhom")) ? p.get("nhom")! : "";
  const taiDanhSach = (trangThai: LocTrangThai) => {
    const qs = new URLSearchParams({ co: String(MOI_TRANG), trang: p.get("trang") || "1" });
    if (trangThai !== "tat_ca") qs.set("status", trangThai);
    if (p.get("q")) qs.set("q", p.get("q")!);
    if (nhom) qs.set("nhom", nhom);
    return goiApiQuanTri<DanhSach>(token, `${API}/${loai}?${qs}`);
  };

  // Chưa chọn trạng thái: người có quyền duyệt vào thẳng "Chờ duyệt" khi còn dòng chờ; còn lại xem tất cả.
  const yeuCau = p.get("trang_thai");
  let trangThai: LocTrangThai = LOC_TRANG_THAI.find((t) => t === yeuCau) ?? "tat_ca";
  let ds: DanhSach;
  if (yeuCau === null) {
    ds = await taiDanhSach("cho_duyet");
    if (ds.tong > 0 && duVaiTro(nguoiDung, ds.vai_tro_duyet)) trangThai = "cho_duyet";
    else ds = await taiDanhSach("tat_ca");
  } else {
    ds = await taiDanhSach(trangThai);
  }
  // Duyệt hết các dòng của trang cuối thì trang đó không còn: lùi về trang cuối mới.
  if (!ds.items.length && ds.tong > 0 && ds.trang > 1) {
    p.set("trang", String(Math.ceil(ds.tong / MOI_TRANG)));
    throw redirect(`${DUONG}?${p}`);
  }

  const ma = p.get("ma");
  const chon = ma
    ? await goiApiQuanTri<ChiTiet>(token, `${API}/${loai}/${encodeURIComponent(ma)}`).catch(() => null)
    : null;
  // Cây chủ đề chỉ cần cho khung sửa của dòng đang mở.
  const chuDe = chon
    ? sapXepCayChuDe(
        (await goiApiQuanTri<{ items: ChuDeCauHoi[] }>(token, "/v1/quan-tri/ngan-hang/chu-de")).items,
      )
    : [];
  const vua = p.get("vua");
  const truoc = (p.get("truoc") ?? "").slice(0, 80);
  return {
    ...ds,
    loai,
    chon,
    chuDe,
    loc: { trang_thai: trangThai, q: p.get("q") ?? "", nhom },
    duocDuyet: duVaiTro(nguoiDung, ds.vai_tro_duyet),
    vuaXong:
      vua === "tao" && chon
        ? `Đã lưu dòng mới ${(p.get("ma") ?? "").slice(0, 80)}.`
        : vua && vua in DA_XONG && truoc
          ? `${DA_XONG[vua as ViecXong]} ${truoc}. ${chon ? "Đã mở dòng kế tiếp." : "Mục này không còn dòng nào cần xử lý."}`
          : null,
  };
}

/** Thân yêu cầu sửa một dòng, dựng từ khung sửa của loại đó. */
function thanSua(loai: Loai, f: FormData): { body: Record<string, unknown> } | { loi: string } {
  const chung = {
    version: Number(f.get("version")),
    note: String(f.get("note") ?? "").trim() || null,
    topic_id: String(f.get("topic_id") ?? "") || null,
  };
  if (loai === "muc-phat") return { body: { ...chung, ...docMucPhat(f) } };
  if (loai === "luat-giay-to") return { body: { ...chung, ...docLuatGiayTo(f) } };
  if (loai === "toc-do-toi-da") return { body: { ...chung, ...docTocDoToiDa(f) } };
  if (loai === "tai-trong") return { body: { ...chung, ...docTaiTrong(f) } };
  if (loai === "bien-bao") return { body: { ...chung, ...docBienBao(f) } };
  if (loai === "bieu-mau") {
    return {
      body: {
        ...chung,
        title: String(f.get("title") ?? ""),
        summary: String(f.get("summary") ?? "").trim() || null,
        kind: String(f.get("kind") ?? ""),
      },
    };
  }
  const steps = docBuocQuyTrinh(f.get("steps"));
  if (!steps) return { loi: "Các bước chưa đọc được. Tải lại trang rồi thử lại." };
  return {
    body: {
      ...chung,
      kind: String(f.get("kind") ?? ""),
      title: String(f.get("title") ?? ""),
      summary: String(f.get("summary") ?? "").trim() || null,
      steps,
    },
  };
}

/**
 * Mã dòng kế tiếp còn nằm trong hàng chờ `trangThai` (cùng loại, cùng ô tìm và nhóm đang lọc), xếp sau
 * dòng vừa xử lý; hết thì quay về dòng đầu hàng chờ. API xếp dòng chờ duyệt, nháp, bị từ chối lên đầu
 * nên 500 dòng đầu là đủ.
 */
async function dongKeTiep(
  token: string,
  loai: Loai,
  loc: URLSearchParams,
  sauMa: string,
  trangThai: readonly TrangThaiCauHoi[],
): Promise<string | null> {
  const qs = new URLSearchParams({ co: "500" });
  if (trangThai.length === 1) qs.set("status", trangThai[0]!);
  if (loc.get("q")) qs.set("q", loc.get("q")!);
  if (loc.get("nhom")) qs.set("nhom", loc.get("nhom")!);
  const ds = await goiApiQuanTri<{ items: Dong[] }>(token, `${API}/${loai}?${qs}`);
  const cho = ds.items.filter((d) => trangThai.includes(d.trang_thai) && d.code !== sauMa);
  return (cho.find((d) => d.code > sauMa) ?? cho[0])?.code ?? null;
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const f = await request.formData();
  const loai = String(f.get("loai")) as Loai;
  const intent = String(f.get("intent"));
  try {
    if (intent === "duyet-hang-loat") {
      const chon = f.getAll("chon").map(String).filter(Boolean);
      if (!chon.length) return { loi: "Chưa chọn dòng nào để duyệt." };
      const kq = await goiApiQuanTri<{ da_duyet: number; bo_qua: string[] }>(
        token,
        `${API}/${loai}/duyet-hang-loat`,
        { body: { ma: chon } },
      );
      return {
        ok:
          `Đã duyệt ${kq.da_duyet} dòng.` +
          (kq.bo_qua.length
            ? ` ${kq.bo_qua.length} dòng không còn ở trạng thái chờ duyệt nên được bỏ qua.`
            : ""),
      };
    }

    const maGoc = String(f.get("ma"));
    const ma = encodeURIComponent(maGoc);
    // Trạng thái của dòng lúc trang hiện ra: chỉ dùng để chọn bước nối và dòng kế tiếp, API kiểm lại.
    const truocDo = String(f.get("trang_thai") ?? "");
    const chuyen = (hanhDong: string, body: unknown = {}) =>
      goiApiQuanTri<Dong>(token, `${API}/${loai}/${ma}/${hanhDong}`, { body });
    /** Báo xong; nếu dòng vừa xử lý đang mở ở khung chi tiết thì mở dòng kế tiếp của cùng hàng chờ. */
    const xong = async (vua: ViecXong) => {
      if (f.get("dang_mo") !== maGoc || truocDo === "da_duyet") return { ok: `${DA_XONG[vua]} ${maGoc}.` };
      const ve = new URLSearchParams(String(f.get("ve") ?? ""));
      const ke = await dongKeTiep(
        token,
        loai,
        ve,
        maGoc,
        truocDo === "cho_duyet" ? ["cho_duyet"] : ["nhap", "tu_choi"],
      );
      ve.set("loai", loai);
      if (ke) ve.set("ma", ke);
      ve.set("vua", vua);
      ve.set("truoc", maGoc);
      return redirect(`${DUONG}?${ve}`);
    };

    if (intent === "luu" || intent === "luu-duyet" || intent === "luu-gui-duyet") {
      const than = thanSua(loai, f);
      if ("loi" in than) return than;
      const d = await goiApiQuanTri<Dong>(token, `${API}/${loai}/${ma}`, { method: "PUT", body: than.body });
      if (intent === "luu") {
        return {
          ok:
            truocDo === "da_duyet"
              ? `Đã lưu. Dòng về chờ duyệt, phiên bản ${d.version}.`
              : "Đã lưu thay đổi.",
        };
      }
      const duyet = intent === "luu-duyet";
      try {
        if (d.trang_thai === "nhap" || d.trang_thai === "tu_choi") await chuyen("gui-duyet");
        if (duyet) await chuyen("duyet");
      } catch (err) {
        if (err instanceof LoiApi)
          return { loi: `Đã lưu thay đổi, nhưng chưa ${duyet ? "duyệt" : "gửi duyệt"} được: ${err.message}` };
        throw err;
      }
      return await xong(duyet ? "duyet" : "gui-duyet");
    }
    if (intent === "duyet") {
      // Người có quyền duyệt duyệt thẳng dòng nháp hoặc bị từ chối: gửi duyệt rồi duyệt.
      if (truocDo === "nhap" || truocDo === "tu_choi") await chuyen("gui-duyet");
      await chuyen("duyet");
      return await xong("duyet");
    }
    if (intent === "tu-choi") {
      await chuyen("tu-choi", { ly_do: String(f.get("ly_do") ?? "") });
      return await xong("tu-choi");
    }
    if (intent === "gui-duyet") {
      await chuyen("gui-duyet");
      return await xong("gui-duyet");
    }
    if (intent === "luu-tru") {
      await chuyen("luu-tru");
      return { ok: `Đã ngừng dùng ${maGoc}.` };
    }
    if (intent === "khoi-phuc") {
      await chuyen("khoi-phuc");
      return { ok: `Đã khôi phục ${maGoc} về bản nháp.` };
    }
    if (intent === "xoa") {
      await goiApiQuanTri(token, `${API}/${loai}/${ma}`, { method: "DELETE" });
      return { ok: `Đã xóa ${maGoc}.` };
    }
    if (intent === "phan-loai") {
      await goiApiQuanTri(token, `${API}/${loai}/${ma}/phan-loai`, {
        method: "PUT",
        body: {
          vehicle: String(f.get("vehicle") ?? "") || null,
          group_name: String(f.get("group_name") ?? "") || null,
          pinned: f.get("pinned") === "1",
        },
      });
      return { ok: "Đã lưu phân loại. Trạng thái duyệt giữ nguyên." };
    }
    if (intent === "thay-tep" || intent === "thay-anh") {
      const laAnh = intent === "thay-anh";
      const tep = f.get("tep");
      if (!(tep instanceof File) || !tep.size) return { loi: laAnh ? "Chưa chọn ảnh." : "Chưa chọn tệp." };
      const form = new FormData();
      form.set("tep", tep, tep.name);
      form.set("version", String(f.get("version") ?? ""));
      await goiApiQuanTri(token, laAnh ? `${API}/bien-bao/${ma}/anh` : `${API}/bieu-mau/${ma}/tep`, {
        form,
        timeoutMs: 60_000,
      });
      const da = laAnh ? "Đã thay ảnh." : "Đã thay tệp.";
      return {
        ok: truocDo === "da_duyet" ? `${da} ${laAnh ? "Biển báo" : "Biểu mẫu"} về chờ duyệt.` : da,
      };
    }
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
  return null;
}

function KhungSua({ loai, d, khiDoi }: { loai: Loai; d: Dong; khiDoi: () => void }) {
  const o = cn(inputClass, "min-h-11");
  if (loai === "muc-phat") return <TruongMucPhat d={d} khiDoi={khiDoi} />;
  if (loai === "luat-giay-to") return <TruongLuatGiayTo d={d} khiDoi={khiDoi} />;
  if (loai === "toc-do-toi-da") return <TruongTocDoToiDa d={d} khiDoi={khiDoi} />;
  if (loai === "tai-trong") return <TruongTaiTrong d={d} khiDoi={khiDoi} />;
  if (loai === "bien-bao") return <TruongBienBao d={d} khiDoi={khiDoi} />;
  if (loai === "bieu-mau") {
    return (
      <>
        <Truong id="kind" nhan="Loại tài liệu">
          <select id="kind" name="kind" defaultValue={String(d.kind ?? "bieu_mau")} className={o}>
            {LOAI_TEP_TAI_LIEU.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Truong>
        <Truong id="title" nhan="Tên biểu mẫu">
          <input id="title" name="title" defaultValue={String(d.title ?? "")} className={o} />
        </Truong>
        <Truong id="summary" nhan="Tóm tắt">
          <textarea
            id="summary"
            name="summary"
            rows={2}
            defaultValue={String(d.summary ?? "")}
            className={inputClass}
          />
        </Truong>
      </>
    );
  }
  return (
    <>
      <Truong id="kind" nhan="Loại quy trình">
        <select id="kind" name="kind" defaultValue={String(d.kind ?? "vi_pham")} className={o}>
          <option value="vi_pham">Xử lý vi phạm</option>
          <option value="tai_nan">Xử lý tai nạn</option>
        </select>
      </Truong>
      <Truong id="title" nhan="Tên quy trình">
        <input id="title" name="title" defaultValue={String(d.title ?? "")} className={o} />
      </Truong>
      <Truong id="summary" nhan="Tóm tắt">
        <textarea
          id="summary"
          name="summary"
          rows={2}
          defaultValue={String(d.summary ?? "")}
          className={inputClass}
        />
      </Truong>
      <SuaBuocQuyTrinh banDau={(d.steps as BuocQuyTrinh[] | null) ?? []} khiDoi={khiDoi} />
    </>
  );
}

/** Ảnh của biển báo: xem ở mọi trạng thái, và thay bằng ảnh khác (trừ khi đã ngừng dùng). */
function KhungAnh({ d, busy, an }: { d: Dong; busy: boolean; an: React.ReactNode }) {
  return (
    <div className="mt-4 flex flex-wrap items-start gap-4 rounded-lg border border-line p-3">
      <img
        src={urlAnhBienBao(d.image_uri)}
        alt={`Biển ${d.code}`}
        className="size-24 shrink-0 object-contain"
      />
      {d.trang_thai !== "luu_tru" ? (
        <Form method="post" encType="multipart/form-data" className="grid min-w-0 flex-1 gap-2">
          {an}
          <input type="hidden" name="version" value={d.version} />
          <Label htmlFor="anh-moi">Thay bằng ảnh khác (SVG, PNG, WebP; tối đa 2 MB)</Label>
          <input
            id="anh-moi"
            name="tep"
            type="file"
            required
            accept={NHAN_ANH_BIEN_BAO}
            className={cn(inputClass, "py-2")}
          />
          <div>
            <Button type="submit" name="intent" value="thay-anh" variant="secondary" disabled={busy}>
              Thay ảnh
            </Button>
          </div>
        </Form>
      ) : null}
    </div>
  );
}

/** Tệp đang gắn với biểu mẫu: xem được ở mọi trạng thái, và thay bằng tệp khác (trừ khi đã ngừng dùng). */
function KhungTep({ d, busy, an }: { d: Dong; busy: boolean; an: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-lg border border-line p-3">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
        <Icon name="file" sac="do" className="size-5 shrink-0" />
        <span className="min-w-0 break-words font-medium">{String(d.file_name)}</span>
        <span className="text-sm text-ink-3">{dungLuongTep(Number(d.file_size))}</span>
        <a
          href={`/quan-tri/du-lieu-tra-cuu/tep/${encodeURIComponent(d.code)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center text-primary underline"
        >
          Xem tệp
        </a>
      </p>
      {d.trang_thai !== "luu_tru" ? (
        <Form method="post" encType="multipart/form-data" className="mt-2 grid gap-2">
          {an}
          <input type="hidden" name="version" value={d.version} />
          <Label htmlFor="tep-moi">Thay bằng tệp khác (PDF, Word, Excel; tối đa 20 MB)</Label>
          <input
            id="tep-moi"
            name="tep"
            type="file"
            required
            accept={NHAN_TEP_TAI_LIEU}
            className={cn(inputClass, "py-2")}
          />
          <div>
            <Button type="submit" name="intent" value="thay-tep" variant="secondary" disabled={busy}>
              Thay tệp
            </Button>
          </div>
        </Form>
      ) : null}
    </div>
  );
}

/**
 * Phân loại của quy trình, biểu mẫu để lọc ở trang Quy trình, Biểu mẫu, và ghim lên đầu mục phổ biến.
 * Lưu không đổi trạng thái duyệt hay phiên bản.
 */
function KhungPhanLoai({ loai, d, busy }: { loai: Loai; d: Dong; busy: boolean }) {
  const o = cn(inputClass, "min-h-11");
  return (
    <Form
      method="post"
      className="mt-6 grid gap-3 rounded-lg border border-line p-3"
      key={`pl-${d.code}-${String(d.vehicle)}-${String(d.group_name)}-${String(d.pinned)}`}
    >
      <input type="hidden" name="loai" value={loai} />
      <input type="hidden" name="ma" value={d.code} />
      <h3 className="text-sm font-semibold">Phân loại và ghim</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Truong id="pl-vehicle" nhan="Phương tiện">
          <select id="pl-vehicle" name="vehicle" defaultValue={String(d.vehicle ?? "")} className={o}>
            <option value="">Mọi phương tiện</option>
            {LOAI_XE.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </Truong>
        <Truong id="pl-group" nhan="Loại vi phạm">
          <select id="pl-group" name="group_name" defaultValue={String(d.group_name ?? "")} className={o}>
            <option value="">Không gắn</option>
            {CHU_DE_MUC_PHAT.map((c) => (
              <option key={c.ma} value={c.ten}>
                {c.ten}
              </option>
            ))}
          </select>
        </Truong>
      </div>
      <label htmlFor="pl-pinned" className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
        <input
          id="pl-pinned"
          name="pinned"
          type="checkbox"
          value="1"
          defaultChecked={Boolean(d.pinned)}
          className="size-5 shrink-0"
        />
        Ghim lên đầu mục phổ biến
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" name="intent" value="phan-loai" variant="secondary" disabled={busy}>
          Lưu phân loại
        </Button>
        <span className="text-sm text-ink-3">
          {Number(d.view_count ?? 0).toLocaleString("vi-VN")} lượt mở
        </span>
      </div>
    </Form>
  );
}

/** Một dòng tóm tắt nội dung cần đọc khi duyệt, hiện ngay trên danh sách. */
function tomTatDong(loai: Loai, d: Dong): string {
  switch (loai) {
    case "muc-phat":
      return (
        khoangTien(Number(d.fine_min), Number(d.fine_max)) +
        (d.point_deduction == null ? "" : ` · trừ ${Number(d.point_deduction)} điểm giấy phép lái xe`)
      );
    case "bien-bao":
      return String(d.meaning ?? "");
    case "quy-trinh":
      return [`${Array.isArray(d.steps) ? d.steps.length : 0} bước`, d.summary].filter(Boolean).join(" · ");
    case "toc-do-toi-da":
      return `${Number(d.max_speed)} km/h`;
    case "luat-giay-to":
      return String(d.explanation ?? "");
    case "tai-trong":
      return `${Number(d.limit_kg).toLocaleString("vi-VN")} kg`;
    case "bieu-mau":
      return `${String(d.file_name ?? "")} · ${dungLuongTep(Number(d.file_size))}`;
  }
}

/** Ô ẩn chung của mọi biểu mẫu thao tác trên một dòng. */
function ODong({ loai, d, dangMo, ve }: { loai: Loai; d: Dong; dangMo: string; ve: string }) {
  return (
    <>
      <input type="hidden" name="loai" value={loai} />
      <input type="hidden" name="ma" value={d.code} />
      <input type="hidden" name="trang_thai" value={d.trang_thai} />
      <input type="hidden" name="dang_mo" value={dangMo} />
      <input type="hidden" name="ve" value={ve} />
    </>
  );
}

/** Ô lý do và nút gửi từ chối, mở ra khi bấm "Từ chối". */
function TuChoi({ id, busy, children }: { id: string; busy: boolean; children: React.ReactNode }) {
  return (
    <details className="min-w-0 flex-1">
      <summary
        className={buttonClass({ variant: "secondary", size: "sm", className: "cursor-pointer list-none" })}
      >
        Từ chối
      </summary>
      <Form method="post" className="mt-2 flex flex-col gap-2 sm:flex-row">
        {children}
        <label htmlFor={id} className="text-sm font-medium sm:sr-only">
          Lý do từ chối
        </label>
        <Input id={id} name="ly_do" required minLength={3} maxLength={1000} placeholder="Lý do từ chối" />
        <Button type="submit" name="intent" value="tu-choi" variant="secondary" disabled={busy}>
          Gửi từ chối
        </Button>
      </Form>
    </details>
  );
}

/**
 * Khung chi tiết của dòng đang mở. Nút chính đổi theo trạng thái và việc đã sửa hay chưa: chưa sửa thì
 * "Duyệt" hoặc "Gửi duyệt", đã sửa thì "Lưu và duyệt" hoặc "Lưu và gửi duyệt" để một lần bấm làm cả hai.
 */
function KhungChiTiet({
  loai,
  chon,
  chuDe,
  duocDuyet,
  busy,
  ve,
  duongVe,
  loi,
  ok,
}: {
  loai: Loai;
  chon: ChiTiet;
  chuDe: Array<ChuDeCauHoi & { cap: number }>;
  duocDuyet: boolean;
  busy: boolean;
  ve: string;
  duongVe: string;
  loi: string | null;
  ok: string | null;
}) {
  const [daSua, datDaSua] = useState(false);
  const tt = chon.trang_thai;
  const chuaGui = tt === "nhap" || tt === "tu_choi";
  const an = <ODong loai={loai} d={chon} dangMo={chon.code} ve={ve} />;
  const chinh = duocDuyet
    ? chuaGui || tt === "cho_duyet" || (tt === "da_duyet" && daSua)
      ? daSua
        ? { intent: "luu-duyet", nhan: "Lưu và duyệt" }
        : { intent: "duyet", nhan: "Duyệt" }
      : null
    : chuaGui
      ? daSua
        ? { intent: "luu-gui-duyet", nhan: "Lưu và gửi duyệt" }
        : { intent: "gui-duyet", nhan: "Gửi duyệt" }
      : null;

  return (
    <section
      aria-labelledby="chi-tiet"
      className="order-first rounded-xl border border-line bg-surface p-4 lg:order-none"
    >
      <Link
        to={duongVe}
        className="-mt-1 mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-primary lg:hidden"
      >
        <Icon name="arrowLeft" className="size-4" />
        Quay lại danh sách
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="chi-tiet" className="font-sans text-lg font-semibold">
          {chon.code} · phiên bản {chon.version}
        </h2>
        <Badge tone={TONE_TRANG_THAI[tt]}>{TEN_TRANG_THAI[tt]}</Badge>
      </div>
      {tt === "tu_choi" && chon.reject_reason ? (
        <Notice tone="danger" className="mt-3">
          Lý do từ chối: {chon.reject_reason}
        </Notice>
      ) : null}
      {loai === "bieu-mau" ? <KhungTep d={chon} busy={busy} an={an} /> : null}
      {loai === "bien-bao" ? <KhungAnh d={chon} busy={busy} an={an} /> : null}
      {tt !== "luu_tru" ? (
        <Form method="post" className="mt-4 grid gap-3" onChange={() => datDaSua(true)}>
          {an}
          <input type="hidden" name="version" value={chon.version} />
          <KhungSua loai={loai} d={chon} khiDoi={() => datDaSua(true)} />
          <TruongChuDe chuDe={chuDe} macDinh={chon.topic_id} />
          <Truong id="note" nhan="Ghi chú biên tập">
            <textarea
              id="note"
              name="note"
              rows={2}
              defaultValue={String(chon.note ?? "")}
              className={inputClass}
            />
          </Truong>
          {tt === "da_duyet" && daSua ? (
            <p className="text-sm text-ink-2">
              {duocDuyet
                ? "Lưu và duyệt: dòng tăng phiên bản và được duyệt lại ngay. Lưu thay đổi: dòng về chờ duyệt."
                : "Lưu thay đổi thì dòng về chờ duyệt và tăng phiên bản."}
            </p>
          ) : null}
          <ThanhLuuBieuMau className="bg-surface" loi={loi} ok={ok}>
            <Button type="submit" name="intent" value="luu" variant="secondary" disabled={busy}>
              Lưu thay đổi
            </Button>
            {chinh ? (
              <Button type="submit" name="intent" value={chinh.intent} disabled={busy}>
                {chinh.nhan}
              </Button>
            ) : null}
          </ThanhLuuBieuMau>
        </Form>
      ) : null}
      {/* Dòng chờ duyệt: người duyệt từ chối kèm lý do. Dòng nháp, bị từ chối, đã duyệt: ngừng dùng. */}
      {tt === "cho_duyet" ? (
        duocDuyet ? (
          <div className="mt-4 flex">
            <TuChoi id="ly-do-chi-tiet" busy={busy}>
              {an}
            </TuChoi>
          </div>
        ) : null
      ) : tt !== "luu_tru" ? (
        <Form method="post" className="mt-4 flex flex-wrap gap-2">
          {an}
          <Button type="submit" name="intent" value="luu-tru" variant="secondary" size="sm" disabled={busy}>
            Ngừng dùng
          </Button>
          {/* Dòng chưa từng duyệt chưa vào lượt làm nào nên xóa hẳn được; API kiểm lại. */}
          {chuaGui && !chon.approved_at ? (
            <Button
              type="submit"
              name="intent"
              value="xoa"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={(e) => {
                if (!confirm(`Xóa hẳn ${chon.code}? Không hoàn tác được.`)) e.preventDefault();
              }}
            >
              Xóa hẳn
            </Button>
          ) : null}
        </Form>
      ) : (
        <Form method="post" className="mt-4">
          {an}
          <Button type="submit" name="intent" value="khoi-phuc" variant="secondary" size="sm" disabled={busy}>
            Khôi phục về bản nháp
          </Button>
        </Form>
      )}
      {loai === "quy-trinh" || loai === "bieu-mau" ? (
        <KhungPhanLoai loai={loai} d={chon} busy={busy} />
      ) : null}
      <h3 className="mt-6 text-sm font-semibold text-ink-2">Lịch sử</h3>
      <ol className="mt-2 grid gap-1 text-sm">
        {chon.lich_su.map((h) => (
          <li key={`${h.created_at}-${h.action}-${h.version}`}>
            {formatNgayGio(h.created_at)} · {h.action} · phiên bản {h.version} · {h.actor}
            {h.note ? ` · ${h.note}` : ""}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function DuLieuTraCuu({ loaderData, actionData }: Route.ComponentProps) {
  const { items, tong, trang, dem, dem_cho_duyet, loai, chon, chuDe, loc, duocDuyet, vuaXong } = loaderData;
  const busy = useNavigation().state !== "idle";
  const soTrang = Math.max(1, Math.ceil(tong / MOI_TRANG));
  // Chọn dòng hay quay lại danh sách vẫn ở trang hiện tại; chuyển trang thì bỏ dòng đang chọn.
  const qs = (them: Record<string, string> = {}) => {
    const p = new URLSearchParams({
      loai,
      trang_thai: loc.trang_thai,
      ...(loc.nhom ? { nhom: loc.nhom } : {}),
      ...(loc.q ? { q: loc.q } : {}),
      ...(trang > 1 ? { trang: String(trang) } : {}),
      ...them,
    });
    return `?${p}`;
  };
  const ve = qs().slice(1);
  const loi = actionData && "loi" in actionData ? actionData.loi : null;
  // Lời báo của lần chuyển sang dòng kế tiếp chỉ hiện tới khi có thao tác mới.
  const ok = actionData ? ("ok" in actionData ? actionData.ok : null) : vuaXong;
  const coDongChoDuyet = duocDuyet && items.some((d) => d.trang_thai === "cho_duyet");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Duyệt dữ liệu tra cứu</h1>
        <ButtonLink to={`/quan-tri/du-lieu-tra-cuu/moi${laLoaiSoan(loai) ? `?loai=${loai}` : ""}`}>
          Soạn nội dung tra cứu
        </ButtonLink>
      </div>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">
        Người học chỉ thấy dòng đã duyệt. Sửa dòng đã duyệt thì dòng về chờ duyệt, tăng phiên bản, và tạm rời
        tra cứu nhanh cùng mọi tình huống trỏ tới nó cho tới khi được duyệt lại.
      </p>

      {loi ? (
        <Notice tone="danger" className="mt-4">
          {loi}
        </Notice>
      ) : null}
      {ok ? <Notice className="mt-4">{ok}</Notice> : null}

      <nav aria-label="Loại dữ liệu" className="mt-6 flex flex-wrap gap-2">
        {LOAI.map((l) => (
          <Link
            key={l.id}
            to={`?loai=${l.id}`}
            aria-current={loai === l.id ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-sm",
              loai === l.id
                ? "border-primary bg-primary-soft font-semibold text-primary"
                : "border-line-strong",
            )}
          >
            {l.ten}
            {dem_cho_duyet[l.id] ? (
              <span className="ml-1" title="Số dòng chờ duyệt">
                ({dem_cho_duyet[l.id]}
                <span className="sr-only"> chờ duyệt</span>)
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
      {loai === "luat-giay-to" ? (
        <nav aria-label="Nhóm luật" className="mt-3 flex flex-wrap gap-2 text-sm">
          {[{ id: "", ten: "Mọi nhóm" }, ...NHOM].map((n) => (
            <Link
              key={n.id || "tat-ca"}
              to={`?${new URLSearchParams({ loai, trang_thai: loc.trang_thai, ...(n.id ? { nhom: n.id } : {}) })}`}
              className={cn(
                "inline-flex min-h-11 items-center rounded-lg px-3",
                loc.nhom === n.id ? "bg-surface-2 font-semibold" : "text-ink-2",
              )}
            >
              {n.ten}
            </Link>
          ))}
        </nav>
      ) : null}
      <nav aria-label="Trạng thái" className="mt-3 flex flex-wrap gap-2 text-sm">
        {LOC_TRANG_THAI.map((t) => (
          <Link
            key={t}
            to={`?${new URLSearchParams({ loai, ...(loc.nhom ? { nhom: loc.nhom } : {}), trang_thai: t })}`}
            className={cn(
              "inline-flex min-h-11 items-center rounded-lg px-3",
              loc.trang_thai === t ? "bg-surface-2 font-semibold" : "text-ink-2",
            )}
          >
            {t === "tat_ca" ? "Tất cả" : TEN_TRANG_THAI[t]}
            {t !== "tat_ca" && dem[t] ? ` (${dem[t]})` : ""}
          </Link>
        ))}
      </nav>

      <Form method="get" role="search" className="mt-4 flex max-w-xl gap-2">
        <input type="hidden" name="loai" value={loai} />
        {loc.nhom ? <input type="hidden" name="nhom" value={loc.nhom} /> : null}
        <input type="hidden" name="trang_thai" value={loc.trang_thai} />
        <Label htmlFor="tim-du-lieu" className="sr-only">
          Tìm theo mã hoặc tên
        </Label>
        <input
          id="tim-du-lieu"
          name="q"
          type="search"
          defaultValue={loc.q}
          placeholder="Tìm theo mã hoặc tên"
          className={cn(inputClass, "min-w-0 flex-1")}
        />
        <Button type="submit" variant="secondary" disabled={busy}>
          Tìm
        </Button>
      </Form>

      {/* Điện thoại: dòng đang chọn hiện khung sửa ở trên danh sách; từ 1024px: hai cột cạnh nhau. */}
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          {items.length === 0 ? (
            <EmptyState
              icon="list"
              title={loc.trang_thai === "cho_duyet" ? "Không có dòng nào chờ duyệt" : "Không có dòng nào"}
            />
          ) : (
            <>
              <p className="text-sm text-ink-2">{tong.toLocaleString("vi-VN")} dòng</p>
              {coDongChoDuyet ? (
                <Form
                  method="post"
                  id="duyet-hang-loat"
                  // Danh sách đổi (duyệt xong, chuyển trang) thì ô "Chọn cả trang" trở về chưa tích.
                  key={items.map((d) => `${d.code}:${d.trang_thai}`).join("|")}
                  className="mt-2 flex flex-wrap items-center gap-3"
                >
                  <input type="hidden" name="intent" value="duyet-hang-loat" />
                  <input type="hidden" name="loai" value={loai} />
                  <Button type="submit" disabled={busy}>
                    Duyệt các dòng đã chọn
                  </Button>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-5"
                      onChange={(e) => {
                        for (const el of document.querySelectorAll<HTMLInputElement>(
                          'input[form="duyet-hang-loat"]',
                        )) {
                          el.checked = e.target.checked;
                        }
                      }}
                    />
                    Chọn cả trang
                  </label>
                </Form>
              ) : null}
              <ul className="mt-2 grid gap-2">
                {items.map((d) => {
                  const dangMo = chon?.code === d.code;
                  const choDuyet = d.trang_thai === "cho_duyet";
                  const chuaGui = d.trang_thai === "nhap" || d.trang_thai === "tu_choi";
                  const an = <ODong loai={loai} d={d} dangMo={chon?.code ?? ""} ve={ve} />;
                  return (
                    <li
                      key={d.code}
                      className={cn(
                        "flex rounded-lg border bg-surface",
                        dangMo ? "border-primary" : "border-line",
                      )}
                    >
                      {duocDuyet && choDuyet ? (
                        <label className="flex shrink-0 cursor-pointer items-start py-3.5 pl-3">
                          <input
                            type="checkbox"
                            name="chon"
                            value={d.code}
                            form="duyet-hang-loat"
                            aria-label={`Chọn ${d.code}`}
                            className="size-5"
                          />
                        </label>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <Link
                          to={qs({ ma: d.code })}
                          aria-current={dangMo ? "true" : undefined}
                          className="block rounded-lg p-3 dong-bam"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="break-all font-mono text-xs text-ink-3">{d.code}</span>
                            <Badge tone={TONE_TRANG_THAI[d.trang_thai]}>{TEN_TRANG_THAI[d.trang_thai]}</Badge>
                          </span>
                          <span className="mt-1 block text-[15px]">{d.ten}</span>
                          <span className="mt-1 line-clamp-2 text-sm text-ink-2">{tomTatDong(loai, d)}</span>
                          {d.citation_urn ? (
                            <span className="mt-0.5 block text-sm text-ink-3">
                              Căn cứ: {nhanVienDan(String(d.citation_urn))}
                            </span>
                          ) : null}
                          {d.trang_thai === "tu_choi" && d.reject_reason ? (
                            <span className="mt-1 block text-sm text-danger">
                              Lý do từ chối: {d.reject_reason}
                            </span>
                          ) : null}
                        </Link>
                        {duocDuyet && choDuyet ? (
                          <div className="flex flex-wrap items-start gap-2 px-3 pb-3">
                            <Form method="post">
                              {an}
                              <Button
                                type="submit"
                                name="intent"
                                value="duyet"
                                size="sm"
                                aria-label={`Duyệt ${d.code}`}
                                disabled={busy}
                              >
                                Duyệt
                              </Button>
                            </Form>
                            <TuChoi id={`ly-do-${d.code}`} busy={busy}>
                              {an}
                            </TuChoi>
                          </div>
                        ) : null}
                        {chuaGui ? (
                          <Form method="post" className="px-3 pb-3">
                            {an}
                            <Button
                              type="submit"
                              name="intent"
                              value="gui-duyet"
                              variant="secondary"
                              size="sm"
                              aria-label={`Gửi duyệt ${d.code}`}
                              disabled={busy}
                            >
                              Gửi duyệt
                            </Button>
                          </Form>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {soTrang > 1 ? (
                <nav
                  aria-label="Phân trang"
                  className="mt-4 flex flex-wrap items-center justify-between gap-2"
                >
                  {trang > 1 ? (
                    <ButtonLink to={qs({ trang: String(trang - 1) })} variant="secondary">
                      Trang trước
                    </ButtonLink>
                  ) : (
                    <span />
                  )}
                  <span className="text-sm text-ink-2">
                    Trang {trang}/{soTrang}
                  </span>
                  {trang < soTrang ? (
                    <ButtonLink to={qs({ trang: String(trang + 1) })} variant="secondary">
                      Trang sau
                    </ButtonLink>
                  ) : (
                    <span />
                  )}
                </nav>
              ) : null}
            </>
          )}
        </div>

        {chon ? (
          <KhungChiTiet
            // Lưu xong hoặc đổi trạng thái thì khung dựng lại từ dữ liệu mới và nút chính trở về "chưa sửa".
            key={`${chon.code}-${chon.updated_at}`}
            loai={loai}
            chon={chon}
            chuDe={chuDe}
            duocDuyet={duocDuyet}
            busy={busy}
            ve={ve}
            duongVe={qs()}
            loi={loi}
            ok={ok}
          />
        ) : (
          <p className="text-[15px] text-ink-2">Chọn một dòng để xem và sửa.</p>
        )}
      </div>
    </div>
  );
}
