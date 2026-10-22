/**
 * Thêm và sửa văn bản trong kho. Một tệp phục vụ hai route: /quan-tri/van-ban/moi và
 * /quan-tri/van-ban/sua?urn=… (URN có dấu "/" nên đi qua query thay vì tham số đường dẫn).
 *
 * Nội dung soạn bằng Markdown như bản số hóa: API tách thành Phần/Chương/Điều/khoản khi lưu, nên
 * trước khi lưu có nút xem trước cấu trúc để bắt lỗi đánh số. Loại và số ký hiệu tạo nên URN mà
 * mọi căn cứ trỏ tới, nên chỉ đặt khi tạo. Xóa cần quản trị viên, có hộp xác nhận liệt kê nơi
 * đang dẫn chiếu văn bản.
 *
 * Nạp từ PDF: API cất tệp làm tệp gốc và đoán thuộc tính từ trang đầu (bản quét thì không đoán
 * được); trang chỉ điền thuộc tính vào biểu mẫu, người soạn soát lại rồi mới lưu. Văn bản lưu kèm
 * tệp gốc, ô Nội dung để trống, và trang đọc hiện tệp đó. Bản chữ tạo sau bằng nút "Đọc bằng AI"
 * ở trang đọc (document.read.tsx).
 */
import { useEffect, useRef, useState } from "react";
import { Form, Link, redirect, useFetcher, useNavigation } from "react-router";

import { StatusBadge } from "../components/ui/Badge";
import { Button, buttonClass } from "../components/ui/Button";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { HopThoai, useHop } from "../components/ui/HopThoai";
import { ThanhLuuBieuMau } from "../components/ui/ThanhDinhDay";
import { docHrefFromUrn } from "../lib/citation";
import { cn } from "../lib/cn";
import { formatNgayGio } from "../lib/format";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { duVaiTro, urlTrang, yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import {
  API_VAN_BAN,
  type ChiTietVanBan,
  type DanhMucVanBan,
  duongSuaVanBan,
  type HangDoi,
  type KetQuaTuPdf,
  loiBaoHangDoi,
  NHAN_DEM,
  PDF_TOI_DA_MB,
  type ThamChieu,
  type TomTatPhanTich,
} from "../lib/van-ban-quan-tri";
import type { Route } from "./+types/quan-tri.van-ban.sua";

export function meta({ data }: Route.MetaArgs) {
  const d = data?.chiTiet?.document;
  return pageMeta(d ? `Sửa ${d.shortTitle}` : "Thêm văn bản", { index: false });
}

const E = encodeURIComponent;

export async function loader({ request }: Route.LoaderArgs) {
  const { token, nguoiDung } = await yeuCauVaiTro(request, "quan_ly");
  const url = urlTrang(request);
  const danhMuc = await goiApiQuanTri<DanhMucVanBan>(token, `${API_VAN_BAN}/loai`);
  const coTheXoa = duVaiTro(nguoiDung, "quan_tri");
  if (url.pathname.endsWith("/moi")) return { danhMuc, chiTiet: null, xungDot: [], coTheXoa, vuaTao: null };

  const urn = url.searchParams.get("urn");
  if (!urn) throw redirect("/quan-tri/van-ban");
  let chiTiet: ChiTietVanBan;
  try {
    chiTiet = await goiApiQuanTri<ChiTietVanBan>(token, `${API_VAN_BAN}/${E(urn)}`);
  } catch (e) {
    // 400: URN trên đường dẫn sai dạng, cũng là không có văn bản này.
    if (e instanceof LoiApi && (e.status === 404 || e.status === 400))
      throw new Response("Không tìm thấy văn bản.", { status: 404 });
    throw e;
  }
  // Lệnh sửa đổi không áp được lên nội dung hiện tại (thường do đổi số Điều/khoản khi sửa).
  const xungDot = chiTiet.markdown
    ? await goiApiQuanTri<{ xungDot: Array<{ op: string; targetPath: string; reason: string }> }>(
        token,
        `${API_VAN_BAN}/${E(urn)}/kiem-tra`,
      ).then(
        (r) => r.xungDot,
        () => [],
      )
    : [];
  const hd = url.searchParams.get("hd");
  return {
    danhMuc,
    chiTiet,
    xungDot,
    coTheXoa,
    vuaTao: url.searchParams.has("moi") ? { hangDoi: (hd || null) as HangDoi | null } : null,
  };
}

type KetQua =
  | { loi: string; thamChieu?: ThamChieu[] }
  | { ok: string; tomTat: TomTatPhanTich | null }
  | { xemTruoc: TomTatPhanTich }
  | { pdf: KetQuaTuPdf };

const chu = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const chuHoacNull = (v: FormDataEntryValue | null) => chu(v) || null;

export async function action({ request }: Route.ActionArgs): Promise<KetQua> {
  const { token } = await yeuCauVaiTro(request, "quan_ly");
  const urn = new URL(request.url).searchParams.get("urn");
  const f = await request.formData();
  const intent = chu(f.get("intent")) || "luu";
  // Giữ nguyên Markdown (kể cả dòng trống đầu/cuối): so sánh "nội dung không đổi" dựa vào đúng chuỗi này.
  const markdown = String(f.get("markdown") ?? "").replace(/\r\n/g, "\n");
  try {
    if (intent === "tu_pdf") {
      const tep = f.get("tep");
      if (!(tep instanceof File) || !tep.size) return { loi: "Chưa chọn tệp PDF." };
      const form = new FormData();
      form.set("tep", tep, tep.name);
      // Văn bản vài trăm trang đọc mất vài giây, cộng thời gian tải tệp lên.
      return {
        pdf: await goiApiQuanTri<KetQuaTuPdf>(token, `${API_VAN_BAN}/tu-pdf`, { form, timeoutMs: 120_000 }),
      };
    }

    if (intent === "xem_truoc") {
      if (!markdown.trim()) return { loi: "Nội dung văn bản đang trống." };
      return {
        xemTruoc: await goiApiQuanTri<TomTatPhanTich>(token, `${API_VAN_BAN}/xem-truoc`, {
          body: { markdown },
        }),
      };
    }

    if (intent === "xoa" && urn) {
      const epBuoc = f.get("epBuoc") === "1" ? "?epBuoc=1" : "";
      await goiApiQuanTri(token, `${API_VAN_BAN}/${E(urn)}${epBuoc}`, { method: "DELETE" });
      throw redirect(`/quan-tri/van-ban?daXoa=${E(chu(f.get("soKyHieu")) || urn)}`);
    }

    const body = {
      title: chu(f.get("title")),
      issuer: chuHoacNull(f.get("issuer")),
      signer: chuHoacNull(f.get("signer")),
      issuedDate: chuHoacNull(f.get("issuedDate")),
      effectiveFrom: chuHoacNull(f.get("effectiveFrom")),
      effectiveTo: chuHoacNull(f.get("effectiveTo")),
      status: chuHoacNull(f.get("status")),
      summary: chuHoacNull(f.get("summary")),
      fields: chu(f.get("fields"))
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      markdown,
      // Bản quét vừa nạp: lưu tệp PDF gốc thay cho nội dung chữ.
      tepGoc: chuHoacNull(f.get("tepGoc")),
    };
    if (body.title.length < 5) return { loi: "Tên văn bản cần ít nhất 5 ký tự." };
    // Văn bản đã có: API biết nó có tệp gốc hay không, nên để API kiểm nội dung trống.
    if (!urn && !markdown.trim() && !body.tepGoc) return { loi: "Nội dung văn bản đang trống." };

    if (!urn) {
      const kq = await goiApiQuanTri<{ urn: string; hangDoi: HangDoi | null }>(token, API_VAN_BAN, {
        body: {
          ...body,
          docType: chu(f.get("docType")),
          soKyHieu: chu(f.get("soKyHieu")),
          locality: chuHoacNull(f.get("locality")),
        },
      });
      throw redirect(`${duongSuaVanBan(kq.urn)}&moi=1&hd=${kq.hangDoi ?? ""}`);
    }

    const kq = await goiApiQuanTri<{
      doiNoiDung: boolean;
      tomTat: TomTatPhanTich | null;
      hangDoi: HangDoi | null;
    }>(token, `${API_VAN_BAN}/${E(urn)}`, { method: "PUT", body });
    return {
      ok: kq.tomTat
        ? `Đã lưu và tách lại cấu trúc văn bản.${loiBaoHangDoi(kq.hangDoi)}`
        : "Đã lưu thuộc tính. Nội dung không đổi nên không tách lại cấu trúc.",
      tomTat: kq.tomTat,
    };
  } catch (e) {
    if (e instanceof LoiApi) {
      const thamChieu = (e.details as { thamChieu?: ThamChieu[] } | undefined)?.thamChieu;
      return { loi: e.message, ...(thamChieu ? { thamChieu } : {}) };
    }
    throw e;
  }
}

export default function SuaVanBan({ loaderData, actionData }: Route.ComponentProps) {
  const { chiTiet } = loaderData;
  // Chuyển sang văn bản khác thì dựng lại biểu mẫu, không giữ Markdown đang soạn của văn bản trước.
  return (
    <BieuMauVanBan key={chiTiet?.document.urn ?? "moi"} loaderData={loaderData} actionData={actionData} />
  );
}

function BieuMauVanBan({ loaderData, actionData }: Pick<Route.ComponentProps, "loaderData" | "actionData">) {
  const { danhMuc, chiTiet, xungDot, coTheXoa, vuaTao } = loaderData;
  const d = chiTiet?.document ?? null;
  const busy = useNavigation().state !== "idle";
  const [markdown, setMarkdown] = useState(chiTiet?.markdown ?? "");
  const [loiTep, setLoiTep] = useState<string | null>(null);
  const xemTruoc = useFetcher<KetQua>();
  const hop = useHop<"xoa">();

  const loi = actionData && "loi" in actionData ? actionData.loi : null;
  const ok =
    actionData && "ok" in actionData
      ? actionData.ok
      : vuaTao
        ? `Đã thêm văn bản.${loiBaoHangDoi(vuaTao.hangDoi)}`
        : null;
  const tomTatLuu = actionData && "tomTat" in actionData ? actionData.tomTat : null;
  const ketQuaXemTruoc = xemTruoc.data && "xemTruoc" in xemTruoc.data ? xemTruoc.data.xemTruoc : null;
  const loiXemTruoc = xemTruoc.data && "loi" in xemTruoc.data ? xemTruoc.data.loi : null;
  const lenhSuaDoi = chiTiet?.thamChieu.find((t) => t.loai === "lenh_sua_doi")?.so ?? 0;

  // Nạp từ PDF: kết quả về thì điền các thuộc tính đoán được vào biểu mẫu; tệp thành tệp gốc của văn bản.
  const napPdf = useFetcher<KetQua>();
  const [tenPdf, setTenPdf] = useState("");
  const bieuMau = useRef<HTMLFormElement>(null);
  /** Giá trị trang tự điền từ PDF trước đó: nạp tệp khác thì được thay, ô người soạn đã gõ thì giữ. */
  const tuDien = useRef<Record<string, string>>({});
  const dangNapPdf = napPdf.state !== "idle";
  const pdf = napPdf.data && "pdf" in napPdf.data ? napPdf.data.pdf : null;
  const loiPdf = napPdf.data && "loi" in napPdf.data ? napPdf.data.loi : null;
  /** Tệp PDF vừa nạp đã cất vào kho: lưu văn bản thì gắn tệp này làm tệp gốc, trang đọc hiện tệp đó. */
  const tepGoc = pdf?.tepGoc ?? null;
  /** Có tệp gốc thì ô Nội dung để trống được: bản chữ tạo sau bằng nút "Đọc bằng AI" ở trang đọc. */
  const coTepGoc = Boolean(tepGoc || (chiTiet?.coTepGoc && !chiTiet.markdown));
  /** URL blob của tệp PDF vừa chọn: xem trước ngay trong trang, trước khi lưu văn bản. */
  const [urlXemPdf, setUrlXemPdf] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (urlXemPdf) URL.revokeObjectURL(urlXemPdf);
    },
    [urlXemPdf],
  );

  useEffect(() => {
    if (!pdf) return;
    const o = (ten: string) =>
      bieuMau.current?.elements.namedItem(ten) as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement
        | null;
    const dien = (ten: string, v: string | undefined, epBuoc = false) => {
      const x = o(ten);
      if (!x || !v) return false;
      if (!epBuoc && x.value.trim() && x.value !== tuDien.current[ten]) return false;
      x.value = v;
      tuDien.current[ten] = v;
      return true;
    };
    const tt = pdf.thuocTinh;
    // Ô loại văn bản luôn có sẵn một giá trị: chỉ đổi theo PDF khi số ký hiệu cũng lấy từ PDF.
    if (dien("soKyHieu", tt.soKyHieu)) dien("docType", tt.docType, true);
    dien("title", tt.title);
    dien("issuer", tt.issuer);
    dien("issuedDate", tt.issuedDate);
    dien("effectiveFrom", tt.effectiveFrom);
    dien("signer", tt.signer);
  }, [pdf]);

  async function docTep(file: File | undefined) {
    setLoiTep(null);
    if (!file) return;
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
      if (file.size > PDF_TOI_DA_MB * 1024 * 1024) {
        setLoiTep(`Tệp PDF quá lớn (tối đa ${PDF_TOI_DA_MB} MB).`);
        return;
      }
      setTenPdf(file.name);
      setUrlXemPdf(URL.createObjectURL(file));
      const fd = new FormData();
      fd.set("intent", "tu_pdf");
      fd.set("tep", file);
      napPdf.submit(fd, { method: "post", encType: "multipart/form-data" });
      return;
    }
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      setLoiTep("Chỉ nhận tệp PDF, .md hoặc .txt. Tệp Word hãy lưu lại thành PDF rồi nạp.");
      return;
    }
    setMarkdown((await file.text()).replace(/\r\n/g, "\n"));
  }

  const ketQuaPdf = dangNapPdf ? (
    <p className="mt-3 text-sm text-ink-2" role="status">
      Đang đọc tệp {tenPdf}…
    </p>
  ) : loiPdf ? (
    <Notice tone="danger" className="mt-3">
      {loiPdf}
    </Notice>
  ) : pdf ? (
    <div className="mt-3 space-y-3">
      <Notice>
        {pdf.tuyen === "pdf_text"
          ? `Đã điền các thuộc tính đọc được từ ${tenPdf} (${pdf.soTrang} trang). ${
              pdf.thuocTinh.signer
                ? `Người ký: ${pdf.thuocTinh.signer}.`
                : "Chưa đọc được người ký, hãy điền tay ô Người ký."
            } Hãy soát lại rồi mới lưu.`
          : `Tệp ${tenPdf} là bản quét (ảnh chụp trang giấy) nên không đọc được thuộc tính: hãy điền số ký hiệu, tên và các thuộc tính bằng tay.`}{" "}
        Văn bản lưu kèm tệp PDF này và trang đọc hiện tệp đó, ô Nội dung để trống. Muốn có bản chữ để tìm kiếm
        và dẫn căn cứ tới từng Điều, khoản thì mở trang đọc rồi bấm Đọc bằng AI.
      </Notice>
      {pdf.daCo && pdf.daCo.urn !== d?.urn ? (
        <Notice tone="danger">
          Văn bản số {pdf.daCo.soKyHieu} đã có trong kho.{" "}
          <Link to={duongSuaVanBan(pdf.daCo.urn)} className="font-semibold underline">
            Mở văn bản đó
          </Link>{" "}
          thay vì thêm bản thứ hai.
        </Notice>
      ) : null}
      {urlXemPdf ? <XemTruocPdf href={urlXemPdf} tieuDe={tenPdf} moSan /> : null}
    </div>
  ) : null;

  return (
    <section>
      <Link
        to="/quan-tri/van-ban"
        className="hidden min-h-11 items-center text-sm font-medium text-primary md:flex"
      >
        Về danh sách văn bản
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{d ? `${d.docTypeName} số ${d.soKyHieu}` : "Thêm văn bản"}</h2>
        {d ? <StatusBadge status={d.status} /> : null}
        {d && (chiTiet?.markdown || chiTiet?.coTepGoc) ? (
          <Link
            to={docHrefFromUrn(d.urn)}
            className="flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
          >
            Xem trang đọc
          </Link>
        ) : null}
      </div>
      {chiTiet?.phienBanGoc ? (
        <p className="mt-1 text-sm text-ink-2">
          Nội dung gốc lưu lúc {formatNgayGio(chiTiet.phienBanGoc.luuLuc)}
          {chiTiet.phienBanGoc.nguon === "quan-tri" && chiTiet.phienBanGoc.nguoiSua
            ? ` bởi ${chiTiet.phienBanGoc.nguoiSua}`
            : chiTiet.phienBanGoc.nguon
              ? ` (nguồn: ${chiTiet.phienBanGoc.nguon})`
              : ""}
          {chiTiet.soPhienBan > 1 ? ` · ${chiTiet.soPhienBan} phiên bản` : ""}
        </p>
      ) : null}

      {loi ? (
        <Notice tone="danger" className="mt-4">
          {loi}
        </Notice>
      ) : null}
      {ok ? <Notice className="mt-4">{ok}</Notice> : null}
      {d && chiTiet?.coTepGoc && !chiTiet.markdown ? (
        <Notice className="mt-4">
          Trang đọc của văn bản này đang hiện tệp PDF gốc. Muốn có bản chữ thì mở trang đọc rồi bấm Đọc bằng
          AI, hoặc dán bản chữ vào ô Nội dung rồi lưu. Tệp gốc vẫn mở được ở mục Thông tin thêm.
        </Notice>
      ) : null}
      {tomTatLuu ? <KetQuaPhanTich tomTat={tomTatLuu} className="mt-4" /> : null}

      {lenhSuaDoi > 0 ? (
        <Notice className="mt-4">
          Có {lenhSuaDoi} lệnh sửa đổi từ văn bản khác nhắm vào văn bản này. Nội dung theo từng thời điểm được
          dựng từ nội dung gốc cộng các lệnh đó, nên giữ nguyên số Điều, khoản, điểm khi sửa.
        </Notice>
      ) : null}
      {xungDot.length > 0 ? (
        <Notice tone="danger" className="mt-4">
          <p className="font-semibold">
            {xungDot.length} lệnh sửa đổi không áp dụng được lên nội dung hiện tại:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {xungDot.slice(0, 10).map((x) => (
              <li key={`${x.op}-${x.targetPath}`}>
                {x.op} {x.targetPath}: {x.reason}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {d ? null : (
        <div className="mt-4 rounded-xl border border-line bg-surface p-4">
          <h3 className="font-sans text-base font-semibold">Nạp từ tệp PDF</h3>
          <p className="mt-1 text-sm text-ink-2">
            Chọn tệp PDF của văn bản. Tệp bôi đen được chữ (bản tải từ Công báo hoặc cổng văn bản) thì trang
            điền sẵn số ký hiệu, tên, ngày, người ký để bạn soát lại; bản quét thì điền tay. Trang đọc hiện
            chính tệp PDF này, bản chữ tạo sau bằng nút Đọc bằng AI ở trang đọc. Chưa có tệp thì điền tay ở
            dưới.
          </p>
          <label
            className={buttonClass({
              variant: "secondary",
              className: cn("mt-3 cursor-pointer", dangNapPdf && "pointer-events-none opacity-60"),
            })}
          >
            {dangNapPdf ? "Đang đọc tệp…" : "Chọn tệp PDF"}
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              disabled={dangNapPdf}
              onChange={(e) => {
                docTep(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {loiTep ? (
            <Notice tone="danger" className="mt-3">
              {loiTep}
            </Notice>
          ) : null}
          {ketQuaPdf}
        </div>
      )}

      <Form method="post" ref={bieuMau} className="mt-6 space-y-6">
        <input type="hidden" name="intent" value="luu" />
        {tepGoc ? <input type="hidden" name="tepGoc" value={tepGoc} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {d ? null : (
            <>
              <div>
                <Label htmlFor="vb-loai">Loại văn bản</Label>
                <select
                  id="vb-loai"
                  name="docType"
                  required
                  defaultValue="nd"
                  className={cn(inputClass, "pr-8")}
                >
                  {danhMuc.items.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="vb-skh">Số ký hiệu</Label>
                <Input
                  id="vb-skh"
                  name="soKyHieu"
                  required
                  placeholder="Ví dụ: 168/2024/NĐ-CP"
                  aria-describedby="vb-skh-goi-y"
                />
                <p id="vb-skh-goi-y" className="mt-1 text-xs text-ink-3">
                  Loại và số ký hiệu không đổi được sau khi tạo.
                </p>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="vb-dia-phuong">Mã địa phương (chỉ với văn bản của địa phương)</Label>
                <Input
                  id="vb-dia-phuong"
                  name="locality"
                  pattern="[a-z0-9\-]*"
                  placeholder="Ví dụ: thanh-hoa"
                  className="font-mono"
                />
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <Label htmlFor="vb-ten">Tên văn bản (trích yếu)</Label>
            <textarea
              id="vb-ten"
              name="title"
              required
              minLength={5}
              rows={2}
              defaultValue={d?.title ?? ""}
              className={cn(inputClass, "py-2")}
            />
          </div>
          <div>
            <Label htmlFor="vb-co-quan">Cơ quan ban hành</Label>
            <Input
              id="vb-co-quan"
              name="issuer"
              defaultValue={d?.issuer ?? ""}
              placeholder="Ví dụ: Chính phủ"
            />
          </div>
          <div>
            <Label htmlFor="vb-nguoi-ky">Người ký</Label>
            <Input id="vb-nguoi-ky" name="signer" defaultValue={d?.signer ?? ""} />
          </div>
          <div>
            <Label htmlFor="vb-ngay-bh">Ngày ban hành</Label>
            <Input id="vb-ngay-bh" name="issuedDate" type="date" defaultValue={d?.issuedDate ?? ""} />
          </div>
          <div>
            <Label htmlFor="vb-trang-thai">Trạng thái hiệu lực</Label>
            <select
              id="vb-trang-thai"
              name="status"
              defaultValue={d?.status ?? ""}
              className={cn(inputClass, "pr-8")}
            >
              <option value="">Tự tính theo ngày hiệu lực</option>
              {danhMuc.trangThai.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="vb-hieu-luc">Ngày có hiệu lực</Label>
            <Input id="vb-hieu-luc" name="effectiveFrom" type="date" defaultValue={d?.effectiveFrom ?? ""} />
          </div>
          <div>
            <Label htmlFor="vb-het-hieu-luc">Ngày hết hiệu lực (nếu có)</Label>
            <Input id="vb-het-hieu-luc" name="effectiveTo" type="date" defaultValue={d?.effectiveTo ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="vb-tom-tat">Tóm tắt (không bắt buộc)</Label>
            <textarea
              id="vb-tom-tat"
              name="summary"
              rows={2}
              defaultValue={d?.summary ?? ""}
              className={cn(inputClass, "py-2")}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="vb-linh-vuc">Mã lĩnh vực (cách nhau bởi dấu phẩy, không bắt buộc)</Label>
            <Input
              id="vb-linh-vuc"
              name="fields"
              defaultValue={d?.fields.join(", ") ?? ""}
              className="font-mono"
            />
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <Label htmlFor="vb-noi-dung" className="mb-0">
              Nội dung (Markdown)
            </Label>
            <label className="lun flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-sm font-medium text-primary hover:bg-surface-2">
              Mở tệp PDF hoặc .md
              <input
                type="file"
                accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain"
                className="sr-only"
                disabled={dangNapPdf}
                onChange={(e) => {
                  docTep(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {/* Văn bản mới: lỗi tệp và kết quả nạp PDF hiện ở khung "Nạp từ tệp PDF" đầu trang. */}
          {d && loiTep ? (
            <Notice tone="danger" className="my-2">
              {loiTep}
            </Notice>
          ) : null}
          {d ? <div className="mb-3">{ketQuaPdf}</div> : null}
          {/* Tệp gốc đã lưu: mở cạnh ô Nội dung để đối chiếu bản chữ. Vừa nạp tệp mới thì xem tệp mới ở trên. */}
          {d && chiTiet?.coTepGoc && !pdf ? (
            <XemTruocPdf href={`${docHrefFromUrn(d.urn)}/tep-goc`} tieuDe={d.soKyHieu} />
          ) : null}
          <textarea
            id="vb-noi-dung"
            name="markdown"
            required={!coTepGoc}
            rows={24}
            spellCheck={false}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            aria-describedby="vb-noi-dung-goi-y"
            className={cn(inputClass, "py-2 font-mono text-sm leading-relaxed")}
          />
          <details id="vb-noi-dung-goi-y" className="mt-2 text-sm text-ink-2">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium">
              Cách viết để tách đúng cấu trúc
            </summary>
            <ul className="list-disc space-y-1 pl-5">
              <li>Chương, mục: dòng "Chương I", "Mục 1", tên chương hoặc mục ở dòng ngay sau.</li>
              <li>Điều: "Điều 5. Tên điều" trên một dòng.</li>
              <li>Khoản: dòng bắt đầu "1.", "2."; điểm: "a)", "b)".</li>
              <li>Phụ lục: dòng bắt đầu "Phụ lục".</li>
              <li>Phần quốc hiệu, căn cứ ban hành ở đầu tệp giữ nguyên như văn bản gốc.</li>
            </ul>
          </details>
          <div className="mt-3">
            <Button
              type="button"
              variant="secondary"
              disabled={xemTruoc.state !== "idle" || !markdown.trim()}
              onClick={() => xemTruoc.submit({ intent: "xem_truoc", markdown }, { method: "post" })}
            >
              {xemTruoc.state !== "idle" ? "Đang tách cấu trúc…" : "Xem trước cấu trúc"}
            </Button>
          </div>
          {loiXemTruoc ? (
            <Notice tone="danger" className="mt-3">
              {loiXemTruoc}
            </Notice>
          ) : null}
          {ketQuaXemTruoc ? <KetQuaPhanTich tomTat={ketQuaXemTruoc} coMucLuc className="mt-3" /> : null}
        </div>

        <ThanhLuuBieuMau loi={loi} ok={ok}>
          <Button type="submit" disabled={busy} className="min-h-12 w-full md:w-auto">
            {d ? "Lưu văn bản" : "Thêm văn bản"}
          </Button>
        </ThanhLuuBieuMau>
      </Form>

      {d && coTheXoa ? (
        <div className="mt-10 rounded-xl border border-danger/40 p-4">
          <h3 className="font-sans text-lg font-semibold">Xóa văn bản</h3>
          <p className="mt-1 text-sm text-ink-2">
            Xóa nội dung, các phiên bản, quan hệ và lệnh sửa đổi do văn bản này đặt ra. Không hoàn tác được;
            tệp gốc trên kho lưu trữ vẫn còn để nạp lại.
          </p>
          <button type="button" className={NUT_XOA_VIEN} onClick={() => hop.mo("xoa")}>
            Xóa văn bản…
          </button>
          {/* key theo lần mở: ô gõ xác nhận của lần trước không còn. */}
          <HopXoa
            key={hop.lan}
            mo={hop.la("xoa")}
            onDong={hop.dong}
            soKyHieu={d.soKyHieu}
            thamChieu={
              actionData && "thamChieu" in actionData && actionData.thamChieu
                ? actionData.thamChieu
                : (chiTiet?.thamChieu ?? [])
            }
            busy={busy}
          />
        </div>
      ) : null}
    </section>
  );
}

/** Xem trước tệp PDF ngay trong trang soạn: tệp vừa chọn (URL blob) hoặc tệp gốc đã lưu. */
function XemTruocPdf({ href, tieuDe, moSan = false }: { href: string; tieuDe: string; moSan?: boolean }) {
  const [mo, setMo] = useState(moSan);
  return (
    <details open={mo} onToggle={(e) => setMo(e.currentTarget.open)} className="text-sm">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium text-primary">
        Xem trước tệp PDF
      </summary>
      {/* Điện thoại thường không hiện PDF trong khung: mở tệp ở thẻ mới. */}
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={buttonClass({ variant: "secondary", className: "md:hidden" })}
      >
        Mở tệp PDF
      </a>
      {/* Chỉ dựng khung khi mở: trang soạn không tải cả tệp khi chưa cần. */}
      {mo ? (
        <iframe
          src={href}
          title={`Xem trước tệp PDF: ${tieuDe}`}
          className="mt-2 hidden h-[80vh] w-full rounded-2xl border border-line bg-surface md:block"
        />
      ) : null}
    </details>
  );
}

// cn() chỉ nối chuỗi, không gộp lớp trùng, nên nút màu đỏ tự đặt đủ lớp thay vì ghép vào Button.
const NUT_XOA_VIEN =
  "mt-3 inline-flex min-h-11 items-center justify-center rounded-btn border border-danger px-4 text-sm font-semibold text-danger hover:bg-danger-soft";
const NUT_XOA =
  "inline-flex min-h-11 items-center justify-center rounded-btn bg-danger px-4 text-sm font-semibold text-canvas disabled:opacity-50";

function HopXoa({
  mo,
  onDong,
  soKyHieu,
  thamChieu,
  busy,
}: {
  mo: boolean;
  onDong: () => void;
  soKyHieu: string;
  thamChieu: ThamChieu[];
  busy: boolean;
}) {
  const [go, setGo] = useState("");
  const khop = go.trim() === soKyHieu;
  return (
    <HopThoai mo={mo} tieuDe={`Xóa văn bản ${soKyHieu}?`} onDong={onDong} quanTrong>
      <Form method="post">
        <input type="hidden" name="intent" value="xoa" />
        <input type="hidden" name="soKyHieu" value={soKyHieu} />
        {thamChieu.length > 0 ? <input type="hidden" name="epBuoc" value="1" /> : null}
        {thamChieu.length > 0 ? (
          <>
            <p>
              Văn bản đang được dẫn chiếu ở những nơi sau. Xóa thì các căn cứ này sẽ trỏ tới văn bản không
              còn:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {thamChieu.map((t) => (
                <li key={t.loai}>
                  {t.nhan}: {t.so}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>Không có câu hỏi, bài giảng hay dữ liệu tra cứu nào đang dẫn chiếu văn bản này.</p>
        )}
        <Label htmlFor="xoa-xac-nhan" className="mt-4">
          Gõ số ký hiệu <span className="font-mono text-ink">{soKyHieu}</span> để xác nhận
        </Label>
        <Input
          id="xoa-xac-nhan"
          value={go}
          onChange={(e) => setGo(e.target.value)}
          autoComplete="off"
          className="font-mono"
        />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onDong}>
            Hủy
          </Button>
          <button type="submit" disabled={!khop || busy} className={NUT_XOA}>
            Xóa vĩnh viễn
          </button>
        </div>
      </Form>
    </HopThoai>
  );
}

function KetQuaPhanTich({
  tomTat,
  coMucLuc = false,
  className,
}: {
  tomTat: TomTatPhanTich;
  coMucLuc?: boolean;
  className?: string;
}) {
  const dem = NHAN_DEM.filter(([k]) => tomTat.dem[k]).map(([k, nhan]) => `${tomTat.dem[k]} ${nhan}`);
  return (
    <div className={cn("rounded-xl border border-line bg-surface p-4 text-sm", className)}>
      <p className="font-semibold">
        Tách được {dem.length ? dem.join(", ") : "0 điều"} ({tomTat.soNut} nút).
      </p>
      {tomTat.dem.dieu ? null : (
        <p className="mt-1 text-danger">Không nhận ra Điều nào. Kiểm tra lại dòng "Điều 1. …".</p>
      )}
      {tomTat.canhBao.length > 0 ? (
        <div className="mt-2">
          <p className="font-medium text-warn">{tomTat.canhBao.length} cảnh báo:</p>
          <ul className="mt-1 list-disc pl-5 text-ink-2">
            {tomTat.canhBao.slice(0, 20).map((w, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: cảnh báo có thể trùng nội dung, chỉ hiển thị
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {coMucLuc && tomTat.mucLuc.length > 0 ? (
        <details className="mt-2">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">Mục lục</summary>
          <ol className="max-h-96 overflow-y-auto">
            {tomTat.mucLuc.map((m, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: mục lục chỉ hiển thị, nhãn có thể trùng khi đánh số lỗi
                key={i}
                style={{ paddingLeft: `${m.depth * 1}rem` }}
                className={cn("py-0.5", m.kind === "dieu" ? "text-ink-2" : "font-semibold")}
              >
                {m.label}
                {m.heading ? `. ${m.heading}` : ""}
                {m.kind === "dieu" && m.soKhoan ? (
                  <span className="text-ink-3"> · {m.soKhoan} khoản</span>
                ) : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
