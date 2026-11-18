/**
 * Luyện tập (docs/PLAN.md GĐ4): chọn chủ đề để làm 10 câu, hoặc luyện lại câu đã sai.
 * Bố cục: lối tắt sang các khu học khác, băng "Luyện câu sai" (khi có), rồi danh mục chủ đề:
 * mỗi chủ đề gốc là một thẻ trải ngang, chủ đề cấp 1 là thẻ trong lưới, chủ đề sâu hơn là dòng
 * trong thẻ cấp 1. Bấm nút là vào phiên ngay, không có bước chọn thêm.
 */
import { Form, Link, redirect, useNavigation } from "react-router";

import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Notice } from "../components/ui/Field";
import { Icon, type IconName, type Sac } from "../components/ui/Icon";
import { KhungNoiDung } from "../components/ui/KhungNoiDung";
import { cn } from "../lib/cn";
import { type ChuDeLuyenTap, layChuDe, taoPhien } from "../lib/luyen-tap.server";
import { LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/luyen-tap._index";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Luyện tập", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  const { items, so_cau_sai } = await layChuDe(token);
  return { chuDe: sapXepTheoCay(items).filter((t) => t.so_cau > 0), soCauSai: so_cau_sai };
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  const f = await request.formData();
  const nguon = f.get("nguon") === "cau_sai" ? "cau_sai" : "chu_de";
  try {
    const { id } = await taoPhien(token, { nguon, chu_de: String(f.get("chu_de") ?? "") || undefined });
    return redirect(`/luyen-tap/${id}`);
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
}

type ChuDeCay = ChuDeLuyenTap & { cap: number };

/** Chủ đề theo thứ tự cây, kèm độ sâu để chủ đề con thụt vào dưới chủ đề cha. */
function sapXepTheoCay(ds: ChuDeLuyenTap[]): ChuDeCay[] {
  const coId = new Set(ds.map((t) => t.id));
  const con = new Map<string | null, ChuDeLuyenTap[]>();
  for (const t of ds) {
    const cha = t.parent_id && coId.has(t.parent_id) ? t.parent_id : null;
    con.set(cha, [...(con.get(cha) ?? []), t]);
  }
  const ra: ChuDeCay[] = [];
  const di = (cha: string | null, cap: number) => {
    for (const t of con.get(cha) ?? []) {
      ra.push({ ...t, cap });
      di(t.id, cap + 1);
    }
  };
  di(null, 0);
  return ra;
}

/** Một chủ đề gốc và các chủ đề cấp 1 của nó; chủ đề sâu hơn gom vào chủ đề cấp 1 phía trên. */
interface NhomChuDe {
  goc: ChuDeCay;
  con: Array<{ chuDe: ChuDeCay; chau: ChuDeCay[] }>;
}

function nhomTheoGoc(ds: ChuDeCay[]): NhomChuDe[] {
  const ra: NhomChuDe[] = [];
  for (const t of ds) {
    const nhom = ra.at(-1);
    if (t.cap === 0 || !nhom) ra.push({ goc: t, con: [] });
    else if (t.cap === 1 || nhom.con.length === 0) nhom.con.push({ chuDe: t, chau: [] });
    else nhom.con.at(-1)?.chau.push(t);
  }
  return ra;
}

const phanTramDung = (t: ChuDeLuyenTap) => (t.so_cau ? Math.round((t.da_lam_dung / t.so_cau) * 100) : 0);

/** Biểu tượng theo tên chủ đề: tên do quản trị đặt tự do nên dò theo từ khóa, không khớp thì là sách. */
const BIEU_TUONG_CHU_DE: Array<[RegExp, IconName]> = [
  [/giấy phép|trừ điểm|phục hồi điểm/i, "idCard"],
  [/pháp luật|văn bản|thứ bậc|hiệu lực/i, "scale"],
  [/tốc độ|khoảng cách/i, "gauge"],
  [/nồng độ cồn|bị cấm/i, "ban"],
  [/quy tắc|báo hiệu|biển báo/i, "trafficLight"],
  [/tuần tra|kiểm soát|chỉ huy/i, "shield"],
  [/vận tải|tải trọng/i, "truck"],
  [/tai nạn/i, "alert"],
  [/vi phạm|xử phạt|biên bản/i, "file"],
  [/phương tiện|người lái|xe/i, "car"],
  [/giao thông|đường/i, "road"],
];

const bieuTuongCua = (ten: string): IconName => BIEU_TUONG_CHU_DE.find(([re]) => re.test(ten))?.[1] ?? "book";

/** Lối tắt sang các khu học khác: một cột trên điện thoại, ba cột khi đủ chỗ. */
const CONG_CU: Array<{ to: string; ten: string; mo: string; icon: IconName; sac: Sac }> = [
  { to: "/hoc", ten: "Bài giảng", mo: "Đọc bài, kiểm tra nhanh", icon: "cap", sac: "chinh" },
  { to: "/nhom", ten: "Nhóm học cùng", mo: "Theo dõi tiến độ đồng đội", icon: "nhom", sac: "ngoc" },
  { to: "/luyen-tap/offline", ten: "Không cần mạng", mo: "Tải chủ đề về máy", icon: "book", sac: "tim" },
];

/** Nhãn phần trăm góc thẻ: xong hết có dấu tích, chưa đúng câu nào thì ghi "Chưa làm". */
function NhanPhanTram({ t }: { t: ChuDeLuyenTap }) {
  const pt = phanTramDung(t);
  if (pt === 100)
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok">
        <Icon name="check" kieu="net" className="size-3.5" />
        100%
      </span>
    );
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
        t.da_lam_dung ? "bg-ok-soft text-ok" : "bg-muted-soft text-muted",
      )}
    >
      {t.da_lam_dung ? `${pt}%` : "Chưa làm"}
    </span>
  );
}

function ThanhChuDe({ t, className }: { t: ChuDeLuyenTap; className?: string }) {
  const pt = phanTramDung(t);
  return (
    <span
      className={cn("block h-2 overflow-hidden rounded-full bg-surface-2", className)}
      role="progressbar"
      aria-label={`Tiến độ chủ đề ${t.name}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pt}
    >
      <span className="block h-full rounded-full bg-ok" style={{ width: `${pt}%` }} />
    </span>
  );
}

/** Nút vào phiên 10 câu của một chủ đề. Tên chủ đề nằm trong nút (ẩn với mắt) cho trình đọc màn hình. */
function NutLuyen({
  t,
  nhan,
  tenDoc,
  variant,
  dangTao,
  className,
}: {
  t: ChuDeLuyenTap;
  nhan: string;
  tenDoc: string;
  variant: "primary" | "secondary";
  dangTao: boolean;
  className?: string;
}) {
  return (
    <Form method="post" className={className}>
      <input type="hidden" name="nguon" value="chu_de" />
      <input type="hidden" name="chu_de" value={t.code} />
      <Button type="submit" variant={variant} disabled={dangTao} className="w-full">
        {nhan}
        <span className="sr-only">: {tenDoc}</span>
      </Button>
    </Form>
  );
}

/** Thẻ chủ đề gốc trải hết bề ngang: luyện lẫn câu của mọi chủ đề con. */
function TheChuDeGoc({ t, coCon, dangTao }: { t: ChuDeLuyenTap; coCon: boolean; dangTao: boolean }) {
  const ten = coCon ? `Tất cả: ${t.name}` : t.name;
  return (
    <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card the-co-nut sm:p-5 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="hinh-noi grid size-12 shrink-0 place-items-center rounded-btn bg-primary-soft">
          <Icon name="layers" className="size-6" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold break-words">{ten}</h3>
          <p className="text-sm text-ink-2">
            {coCon ? "Câu hỏi lẫn từ mọi chủ đề bên dưới · " : ""}
            {t.so_cau} câu hỏi
          </p>
        </div>
      </div>
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center md:shrink-0">
        <div className="min-w-0 flex-1 md:w-44 md:flex-none">
          <p className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold tabular-nums">
              {t.da_lam_dung}/{t.so_cau} câu đúng
            </span>
            <span className="font-semibold tabular-nums text-ok">{phanTramDung(t)}%</span>
          </p>
          <ThanhChuDe t={t} className="mt-1.5" />
        </div>
        <NutLuyen
          t={t}
          nhan="Luyện tập"
          tenDoc={ten}
          variant="primary"
          dangTao={dangTao}
          className="w-full sm:w-auto sm:shrink-0"
        />
      </div>
    </div>
  );
}

/** Thẻ chủ đề cấp 1; chủ đề nhỏ hơn (nếu có) là các dòng bấm được để luyện riêng. */
function TheChuDe({ t, chau, dangTao }: { t: ChuDeLuyenTap; chau: ChuDeLuyenTap[]; dangTao: boolean }) {
  const xong = t.da_lam_dung >= t.so_cau;
  return (
    <li className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card the-co-nut sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "hinh-noi grid size-11 shrink-0 place-items-center rounded-btn",
              xong ? "bg-ok-soft" : "bg-surface-2",
            )}
          >
            <Icon name={bieuTuongCua(t.name)} sac={xong ? "luc" : undefined} className="size-6" />
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold leading-snug break-words">{t.name}</h4>
            <p className="text-sm text-ink-3">{t.so_cau} câu hỏi</p>
          </div>
        </div>
        <NhanPhanTram t={t} />
      </div>

      <div>
        <p className="mb-1.5 flex justify-between gap-2 text-sm text-ink-2">
          <span>{xong ? "Hoàn thành" : "Tiến độ"}</span>
          <span className="font-medium tabular-nums text-ink">
            {t.da_lam_dung}/{t.so_cau} câu đúng
          </span>
        </p>
        <ThanhChuDe t={t} />
      </div>

      {chau.length ? (
        <ul className="-mx-2 border-t border-line pt-2" aria-label={`Chủ đề nhỏ của ${t.name}`}>
          {chau.map((c) => (
            <li key={c.id}>
              <Form method="post">
                <input type="hidden" name="nguon" value="chu_de" />
                <input type="hidden" name="chu_de" value={c.code} />
                <button
                  type="submit"
                  disabled={dangTao}
                  className="flex min-h-11 w-full items-center gap-3 rounded-btn border border-transparent px-2 py-1.5 text-left text-sm dong-bam disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1 break-words">{c.name}</span>
                  <span className="shrink-0 tabular-nums text-ink-3">
                    {c.da_lam_dung}/{c.so_cau}
                    <span className="sr-only"> câu đúng</span>
                  </span>
                  <Icon name="chevronRight" kieu="net" className="size-4 text-ink-3" />
                </button>
              </Form>
            </li>
          ))}
        </ul>
      ) : null}

      <NutLuyen
        t={t}
        nhan={xong ? "Ôn lại" : "Luyện tập"}
        tenDoc={t.name}
        variant="secondary"
        dangTao={dangTao}
        className="mt-auto"
      />
    </li>
  );
}

export default function LuyenTap({ loaderData, actionData }: Route.ComponentProps) {
  const { chuDe, soCauSai } = loaderData;
  const nav = useNavigation();
  const dangTao = nav.state !== "idle" && nav.formMethod === "POST";
  const nhom = nhomTheoGoc(chuDe);
  const tongCau = nhom.reduce((s, n) => s + n.goc.so_cau, 0);
  const tongDung = nhom.reduce((s, n) => s + n.goc.da_lam_dung, 0);

  return (
    <KhungNoiDung
      title="Luyện tập"
      icon="cap"
      description="Chọn một chủ đề để làm 10 câu trắc nghiệm. Mỗi câu có đáp án, giải thích và điều khoản làm căn cứ sau khi nộp bài."
    >
      <div className="space-y-6 sm:space-y-8">
        {actionData?.loi ? (
          <Notice tone="danger" className="mt-4">
            {actionData.loi}
          </Notice>
        ) : null}

        {/* Bài giảng (GĐ11), nhóm học cùng (GĐ16b), luyện tập không cần mạng (GĐ13). */}
        <nav aria-label="Cách học khác" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CONG_CU.map((o) => (
            <Link
              key={o.to}
              to={o.to}
              className="flex min-h-16 items-center gap-3 rounded-card border border-line bg-surface p-3 shadow-card dong-bam sm:p-3.5"
            >
              <span className="hinh-noi grid size-10 shrink-0 place-items-center rounded-btn bg-surface-2">
                <Icon name={o.icon} sac={o.sac} className="size-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug">{o.ten}</span>
                <span className="mt-0.5 block text-xs text-ink-3">{o.mo}</span>
              </span>
            </Link>
          ))}
        </nav>

        {soCauSai > 0 ? (
          <section
            aria-labelledby="cau-sai-tieu-de"
            className="bang-cau-sai flex flex-col gap-4 rounded-card p-5 shadow-card md:flex-row md:items-center md:justify-between md:p-6"
          >
            <div className="flex items-start gap-4">
              <span className="bang-cau-sai-o grid size-12 shrink-0 place-items-center rounded-card">
                <Icon name="alert" kieu="net" className="size-7" />
              </span>
              <div>
                <span className="bang-cau-sai-o inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold">
                  Nên ôn lại
                </span>
                <h2 id="cau-sai-tieu-de" className="mt-1 text-lg font-bold">
                  Bạn có {soCauSai} câu trả lời chưa đúng
                </h2>
                <p className="mt-0.5 text-sm">Luyện lại ngay để củng cố kiến thức trước kỳ thi.</p>
              </div>
            </div>
            <Form method="post" className="md:shrink-0">
              <input type="hidden" name="nguon" value="cau_sai" />
              {/* Nút nền giấy trên băng đỏ; không qua buttonClass vì cn không gộp được lớp màu trùng. */}
              <button
                type="submit"
                disabled={dangTao}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-btn bg-surface px-5 text-base font-semibold text-primary shadow-card lun hover:bg-surface-2 disabled:opacity-50 md:w-auto"
              >
                <Icon name="turn" kieu="net" sac="chinh" />
                Luyện câu sai ({soCauSai})
              </button>
            </Form>
          </section>
        ) : null}

        <section aria-labelledby="chu-de-tieu-de" className="space-y-4 border-t border-line pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="chu-de-tieu-de" className="text-lg font-semibold">
              Danh mục chủ đề
            </h2>
            {tongCau > 0 ? (
              <p className="text-sm text-ink-2">
                Đã làm đúng{" "}
                <span className="font-semibold tabular-nums text-ink">
                  {tongDung}/{tongCau}
                </span>{" "}
                câu
              </p>
            ) : null}
          </div>

          {nhom.length === 0 ? (
            <EmptyState className="bg-surface-2" icon="cap" title="Chưa có chủ đề nào có câu hỏi">
              <p>Câu hỏi được đưa vào luyện tập sau khi được duyệt trong ngân hàng câu hỏi.</p>
            </EmptyState>
          ) : (
            nhom.map((n) => (
              <div key={n.goc.id} className="space-y-3">
                <TheChuDeGoc t={n.goc} coCon={n.con.length > 0} dangTao={dangTao} />
                {n.con.length ? (
                  <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {n.con.map(({ chuDe: t, chau }) => (
                      <TheChuDe key={t.id} t={t} chau={chau} dangTao={dangTao} />
                    ))}
                  </ul>
                ) : null}
              </div>
            ))
          )}
        </section>
      </div>
    </KhungNoiDung>
  );
}
