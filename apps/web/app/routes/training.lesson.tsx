/**
 * Một bài giảng `/hoc/:course/:lesson` (docs/PLAN.md GĐ11).
 *
 * Hai chế độ trên cùng dữ liệu: đọc cuộn (mặc định) và slide (`?che_do=slide`, mỗi khối một
 * trang). Cuối bài: "Hoàn thành bài" (đánh dấu đã xong) và kiểm tra nhanh 3–5 câu từ ngân hàng
 * theo chủ đề của bài. Trước phần kết bài là bài tập (tự luận AI chấm, trắc nghiệm) nếu bài có.
 * Nhân vật đồng hành tắt (giả định A8).
 */
import { Link, redirect, useNavigation } from "react-router";

import { BaiTapTrongBai, type KetQuaThaoTacBaiTap } from "../components/bai-giang/BaiTapTrongBai";
import { CheDoSlide } from "../components/bai-giang/CheDoSlide";
import { KhoiNoiDung, laKhoiHoTro } from "../components/bai-giang/KhoiNoiDung";
import { type KetQuaHoanThanh, KiemTraCuoiBai } from "../components/bai-giang/KiemTraCuoiBai";
import { TrinhPhatSachNoi } from "../components/giong-noi/TrinhPhatSachNoi";
import { HopChiaSeBai } from "../components/nhom/HopChiaSeBai";
import { Button } from "../components/ui/Button";
import { useHop } from "../components/ui/HopThoai";
import { Icon } from "../components/ui/Icon";
import type { CheDoXem, KetQuaBaiTap } from "../lib/bai-giang";
import { baiGiang, chuyenDeHoc } from "../lib/bai-giang.server";
import { cn } from "../lib/cn";
import { taoPhien } from "../lib/luyen-tap.server";
import type { KetQuaChiaSeVaoNhom, KetQuaThaoTacNhom, NhomTomTat } from "../lib/nhom";
import { chiaSeMuc, nhomCuaToi } from "../lib/nhom.server";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/training.lesson";

export function meta({ data }: Route.MetaArgs) {
  return pageMeta(data?.bai.bai.title ?? "Bài giảng", { description: data?.bai.bai.summary ?? undefined });
}

/**
 * Nhóm đang hoạt động của người đọc, cho nút "Chia sẻ vào nhóm" (docs/PLAN.md GĐ16b). Vai trò không
 * vào được nhóm, hay API lỗi thì coi như không có nhóm: trang bài vẫn mở.
 */
async function nhomDeChiaSe(token: string): Promise<NhomTomTat[]> {
  try {
    return (await nhomCuaToi(token)).items.filter((g) => g.trang_thai === "hoat_dong");
  } catch {
    return [];
  }
}

export async function loader({ request, params }: Route.LoaderArgs) {
  // Nội dung bài cần tài khoản đã được xác minh cán bộ.
  const { token } = await yeuCauDangNhap(request);
  const url = new URL(request.url);
  const cheDo: CheDoXem = url.searchParams.get("che_do") === "slide" ? "slide" : "doc";
  const [bai, chuyenDe, nhomChiaSe] = await Promise.all([
    baiGiang(request, params.course, params.lesson),
    chuyenDeHoc(request, params.course),
    nhomDeChiaSe(token),
  ]);

  // Loại khối chưa dựng vẫn hiện dạng chữ thô; ghi nhật ký để biết cần dựng thêm loại nào.
  const chuaHoTro = [...new Set(bai.khoi.map((k) => k.kind).filter((k) => !laKhoiHoTro(k)))];
  if (chuaHoTro.length) {
    console.warn(
      `[bai-giang] ${params.course}/${params.lesson}: khối chưa hỗ trợ, hiện chữ thô: ${chuaHoTro.join(", ")}`,
    );
  }

  const viTri = chuyenDe.loTrinh.findIndex((b) => b.slug === params.lesson);
  const baiSau = viTri >= 0 ? (chuyenDe.loTrinh[viTri + 1] ?? null) : null;
  return {
    bai,
    cheDo,
    chuyenDe: { slug: chuyenDe.chuyenDe.slug, title: chuyenDe.chuyenDe.title },
    soBai: viTri + 1,
    tongBai: chuyenDe.loTrinh.length,
    baiSau: baiSau ? { slug: baiSau.slug, title: baiSau.title } : null,
    nhomChiaSe,
  };
}

type KetQuaThaoTac = { hoanThanh: KetQuaHoanThanh } | { loi: string } | KetQuaThaoTacNhom;

/** Chia sẻ bài vào từng nhóm đã chọn; nhóm lỗi (ví dụ đã có bài này) báo riêng, không chặn nhóm khác. */
async function chiaSeVaoNhom(token: string, f: FormData): Promise<KetQuaThaoTacNhom> {
  const intent = "chia-se-nhom";
  const lessonId = String(f.get("lesson_id") ?? "");
  const chon = f.getAll("nhom").map(String);
  if (!chon.length) return { intent, loi: "Chọn ít nhất một nhóm." };
  const ten = new Map((await nhomCuaToi(token)).items.map((g) => [g.id, g.ten]));
  const chiaSe = await Promise.all(
    chon.map(async (id): Promise<KetQuaChiaSeVaoNhom> => {
      const tenNhom = ten.get(id) ?? "Nhóm";
      try {
        await chiaSeMuc(token, id, { loai: "bai_hoc", lesson_id: lessonId });
        return { id, ten: tenNhom, ok: true };
      } catch (err) {
        if (err instanceof LoiApi) return { id, ten: tenNhom, ok: false, loi: err.message };
        throw err;
      }
    }),
  );
  return { intent, ok: true, chiaSe };
}

/**
 * Ghi danh của người học trong chuyên đề: trang bài gửi kèm nếu đã có; chưa có (lần đầu làm bài
 * tập của chuyên đề) thì ghi danh luôn, vì lượt làm bài phải gắn với một ghi danh.
 */
async function ghiDanhDeLamBai(token: string, f: FormData, chuyenDe: string): Promise<string> {
  const id = String(f.get("ghi_danh_id") ?? "");
  if (id) return id;
  const { ghiDanh } = await goiApiQuanTri<{ ghiDanh: { id: string } }>(
    token,
    `/v1/dao-tao/chuyen-de/${encodeURIComponent(chuyenDe)}/ghi-danh`,
    { body: {} },
  );
  return ghiDanh.id;
}

/** Nộp bài tập hoặc đề nghị phúc khảo; lỗi nghiệp vụ trả về để hiện ngay dưới bài tập đó. */
async function thaoTacBaiTap(token: string, f: FormData, chuyenDe: string): Promise<KetQuaThaoTacBaiTap> {
  const intent = f.get("intent") === "phuc-khao" ? "phuc-khao" : "nop-bai-tap";
  const hoatDongId = String(f.get("hoat_dong_id") ?? "");
  try {
    const ghiDanhId = await ghiDanhDeLamBai(token, f, chuyenDe);
    const duong = `/v1/dao-tao/hoat-dong/${encodeURIComponent(hoatDongId)}`;
    if (intent === "phuc-khao") {
      await goiApiQuanTri(token, `${duong}/phuc-khao`, {
        body: { ghiDanhId, lyDo: String(f.get("ly_do") ?? "").trim() },
      });
      return { intent, hoatDongId, ok: true };
    }
    const traLoi =
      f.get("loai") === "trac_nghiem"
        ? { chon: f.getAll("chon").map(String) }
        : { bai_viet: String(f.get("bai_viet") ?? "") };
    const { ketQua } = await goiApiQuanTri<{ ketQua: KetQuaBaiTap }>(token, `${duong}/nop`, {
      body: { ghiDanhId, traLoi },
      // AI chấm tự luận ngay trong lượt nộp, lâu hơn một lời gọi API thường.
      timeoutMs: 90_000,
    });
    return { intent, hoatDongId, ketQua };
  } catch (err) {
    if (err instanceof LoiApi) return { intent, hoatDongId, loi: err.message };
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return {
        intent,
        hoatDongId,
        loi: "Chấm bài lâu hơn dự kiến. Tải lại trang sau ít phút để xem kết quả.",
      };
    }
    throw err;
  }
}

export async function action({
  request,
  params,
}: Route.ActionArgs): Promise<KetQuaThaoTac | KetQuaThaoTacBaiTap | Response> {
  const { token } = await yeuCauDangNhap(request);
  const f = await request.formData();
  if (f.get("intent") === "nop-bai-tap" || f.get("intent") === "phuc-khao") {
    return await thaoTacBaiTap(token, f, params.course);
  }
  try {
    if (f.get("intent") === "chia-se-nhom") return await chiaSeVaoNhom(token, f);
    if (f.get("intent") === "hoan-thanh") {
      const kq = await goiApiQuanTri<KetQuaHoanThanh>(
        token,
        `/v1/dao-tao/chuyen-de/${encodeURIComponent(params.course)}/bai/${encodeURIComponent(params.lesson)}/hoan-thanh`,
        { body: {} },
      );
      return { hoanThanh: { daXongTruoc: kq.daXongTruoc } };
    }
    if (f.get("intent") === "kiem-tra") {
      const soCau = Number(f.get("so_cau") ?? 5);
      const { id } = await taoPhien(token, {
        nguon: "chu_de",
        chu_de: String(f.get("chu_de") ?? ""),
        so_cau: Number.isFinite(soCau) ? Math.min(10, Math.max(3, soCau)) : 5,
      });
      return redirect(`/luyen-tap/${id}`);
    }
    return { loi: "Thao tác không hợp lệ." };
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
}

export default function TrainingLesson({ loaderData, actionData }: Route.ComponentProps) {
  const { bai, cheDo, chuyenDe, soBai, tongBai, baiSau, nhomChiaSe } = loaderData;
  const busy = useNavigation().state !== "idle";
  const hop = useHop<"chia-se">();
  const hoanThanh = actionData && "hoanThanh" in actionData ? actionData.hoanThanh : undefined;
  const loi = actionData && "loi" in actionData ? actionData.loi : undefined;
  const coso = `/hoc/${chuyenDe.slug}/${bai.bai.slug}`;

  const ketBai = (
    <div className="grid gap-4">
      <BaiTapTrongBai hoatDong={bai.hoatDong ?? []} ghiDanhId={bai.ghiDanhId} />
      <KiemTraCuoiBai bai={bai} busy={busy} hoanThanh={hoanThanh} loi={loi} />
      {baiSau ? (
        <Link
          to={`/hoc/${chuyenDe.slug}/${baiSau.slug}${cheDo === "slide" ? "?che_do=slide" : ""}`}
          className="flex min-h-12 items-center rounded-xl border border-line bg-surface px-4 py-3 text-base dong-bam"
        >
          <span>
            <span className="block text-sm text-ink-2">Bài tiếp theo</span>
            <span className="block font-semibold">{baiSau.title}</span>
          </span>
        </Link>
      ) : (
        <Link
          to={`/hoc/${chuyenDe.slug}`}
          className="flex min-h-12 items-center rounded-xl border border-line bg-surface px-4 py-3 text-base dong-bam"
        >
          Đây là bài cuối của chuyên đề. Về danh sách bài
        </Link>
      )}
    </div>
  );

  return (
    <article className={cn("wrap py-4 md:py-6", cheDo === "slide" ? "max-w-4xl" : "max-w-3xl")}>
      <p className="text-sm">
        <Link
          to={`/hoc/${chuyenDe.slug}`}
          className="hidden min-h-11 items-center text-primary hover:underline md:inline-flex"
        >
          {chuyenDe.title}
        </Link>
        <span className="text-ink-2">
          <span className="hidden md:inline"> · </span>
          {soBai > 0 ? `Bài ${soBai}/${tongBai} · ` : null}
          khoảng {bai.bai.estimatedMinutes} phút
        </span>
      </p>
      <h1 className="mt-1 text-xl font-semibold leading-tight sm:text-3xl md:mt-2">{bai.bai.title}</h1>

      {/* Nhóm học cùng (docs/PLAN.md GĐ16b): chỉ hiện khi có ít nhất một nhóm. */}
      {nhomChiaSe.length ? (
        <div className="mt-3">
          <Button size="lg" variant="secondary" onClick={() => hop.mo("chia-se")} aria-haspopup="dialog">
            <Icon name="nhom" />
            Chia sẻ vào nhóm
          </Button>
          <HopChiaSeBai
            key={hop.lan}
            mo={hop.la("chia-se")}
            onDong={hop.dong}
            nhom={nhomChiaSe}
            lessonId={bai.bai.id}
          />
        </div>
      ) : null}

      <nav aria-label="Cách xem bài" className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
        {(
          [
            ["doc", "Đọc cuộn", coso],
            ["slide", "Xem từng trang", `${coso}?che_do=slide`],
          ] as const
        ).map(([ma, nhan, to]) => (
          <Link
            key={ma}
            to={to}
            replace
            aria-current={cheDo === ma ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-center rounded-lg text-[15px]",
              cheDo === ma ? "bg-surface font-semibold text-primary shadow-sm" : "text-ink-2 hover:text-ink",
            )}
          >
            {nhan}
          </Link>
        ))}
      </nav>

      {/* Sách nói (docs/PLAN.md GĐ14): bài chưa có bản đọc thì không hiện. */}
      <div className="mt-3 empty:hidden">
        <TrinhPhatSachNoi baiId={bai.bai.id} khoiHien={bai.khoi.map((k) => k.id)} />
      </div>

      <div className="mt-4 md:mt-6">
        {cheDo === "slide" ? (
          <CheDoSlide khoi={bai.khoi} ketBai={ketBai} tieuDe={bai.bai.title} chuyenDe={chuyenDe.title} />
        ) : (
          // minmax(0,1fr): cột lưới mặc định giãn theo khối rộng nhất (bảng tra), làm tràn cả trang trên mobile.
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
            {bai.khoi.map((k) => (
              <KhoiNoiDung key={k.id} khoi={k} />
            ))}
            {ketBai}
          </div>
        )}
      </div>
    </article>
  );
}
