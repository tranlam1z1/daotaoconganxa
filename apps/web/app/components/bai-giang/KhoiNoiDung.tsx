/**
 * Một khối nội dung của bài giảng (docs/PLAN.md GĐ11). Dùng chung cho chế độ đọc cuộn và chế độ
 * slide: hai chế độ chỉ khác cách xếp khối, không khác cách vẽ một khối.
 *
 * Chỉ dựng đầy đủ các loại trong KHOI_BAI_GIANG. Loại khác hiện dạng văn bản thô; trang gọi ghi
 * cảnh báo vào nhật ký máy chủ để biết cần dựng thêm loại nào.
 */
import { useState } from "react";

import { chuTrongDuLieu, KHOI_BAI_GIANG, type KhoiBaiGiang } from "../../lib/bai-giang";
import { dieuHrefFromUrn } from "../../lib/citation";
import { cn } from "../../lib/cn";
import { renderMarkdown, renderMarkdownInline } from "../../lib/markdown";
import { Button, ButtonLink } from "../ui/Button";
import { Icon } from "../ui/Icon";

const chuoi = (v: unknown) => (typeof v === "string" ? v : "");
const mang = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function Md({ md, className }: { md: string; className?: string }) {
  return (
    <div
      className={cn("prose-bai text-base leading-relaxed [&_p+p]:mt-3 [&_strong]:font-semibold", className)}
      // renderMarkdown đã lọc HTML nguy hiểm (lib/markdown.ts).
      // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML đã được sanitizeHtml lọc
      dangerouslySetInnerHTML={{ __html: renderMarkdown(md) }}
    />
  );
}

function Inline({ md }: { md: string }) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML đã được sanitizeHtml lọc
  return <span dangerouslySetInnerHTML={{ __html: renderMarkdownInline(md) }} />;
}

export function laKhoiHoTro(kind: string): boolean {
  return (KHOI_BAI_GIANG as readonly string[]).includes(kind);
}

export function KhoiNoiDung({ khoi }: { khoi: KhoiBaiGiang }) {
  const d = khoi.data;
  switch (khoi.kind) {
    case "giang":
      return <Md md={chuoi(d.md)} />;

    case "can_cu": {
      const urn = chuoi(d.urn) || khoi.citations[0] || "";
      return (
        <figure className="rounded-xl border border-line bg-surface p-4">
          <figcaption className="text-sm font-semibold text-primary">Căn cứ</figcaption>
          <p className="mt-1 font-semibold">{chuoi(d.nhan)}</p>
          <blockquote className="mt-2 border-l-4 border-line-strong pl-3 text-base leading-relaxed text-ink-2">
            {chuoi(d.nguyen_van)}
          </blockquote>
          {urn ? (
            <ButtonLink to={dieuHrefFromUrn(urn)} variant="secondary" className="mt-3">
              Mở điều khoản gốc
            </ButtonLink>
          ) : null}
        </figure>
      );
    }

    case "tom_tat":
      return (
        <section className="rounded-xl border border-ok bg-ok-soft p-4">
          <h3 className="font-semibold">Ghi nhớ</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-base leading-relaxed">
            {mang(d.y).map((y, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: danh sách ý cố định của khối
              <li key={i}>
                <Inline md={chuoi(y)} />
              </li>
            ))}
          </ul>
        </section>
      );

    case "canh_bao":
      return (
        <aside role="note" className="rounded-xl border-l-4 border-warn bg-warn-soft p-4">
          <p className="font-semibold">Lưu ý</p>
          <Md md={chuoi(d.md)} className="mt-1" />
        </aside>
      );

    case "bang_tra": {
      const cot = mang(d.cot).map(chuoi);
      const tieuDe = chuoi(d.tieu_de);
      // Mỗi cột cần khoảng 9rem để chữ không vỡ vụn; bảng hai cột vừa màn điện thoại, không phải cuộn.
      // Tiêu đề nằm ngoài vùng cuộn để không trôi theo khi cuộn ngang.
      return (
        <div className="overflow-hidden rounded-xl border border-line">
          {tieuDe ? <p className="px-3 pt-3 font-semibold">{tieuDe}</p> : null}
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: vùng cuộn ngang cần nhận tiêu điểm để cuộn bằng phím */}
          <section className="bang-cuon" aria-label={tieuDe || "Bảng tra"} tabIndex={0}>
            <table
              className="w-full text-left text-[15px]"
              style={cot.length > 2 ? { minWidth: `${cot.length * 9}rem` } : undefined}
            >
              <thead className="bg-surface-2">
                <tr>
                  {cot.map((c) => (
                    <th key={c} className="px-3 py-2 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mang(d.dong).map((dong, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: bảng chỉ đọc
                  <tr key={i} className="border-t border-line align-top">
                    {mang(dong).map((o, j) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: bảng chỉ đọc
                      <td key={j} className="px-3 py-2">
                        {chuoi(o) || String(o ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      );
    }

    case "so_do_trinh_tu":
      return (
        <ol className="space-y-3">
          {mang(d.buoc).map((b, i) => {
            const buoc = (b ?? {}) as Record<string, unknown>;
            return (
              <li key={chuoi(buoc.ma) || i} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-on-primary">
                  {i + 1}
                </span>
                <div className="pt-1">
                  <p className="font-semibold">{chuoi(buoc.nhan)}</p>
                  {chuoi(buoc.mo_ta) ? <p className="mt-0.5 text-ink-2">{chuoi(buoc.mo_ta)}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      );

    case "the_lat":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {mang(d.the).map((t, i) => {
            const the = (t ?? {}) as Record<string, unknown>;
            // biome-ignore lint/suspicious/noArrayIndexKey: thẻ cố định của khối
            return <TheLat key={i} truoc={chuoi(the.truoc)} sau={chuoi(the.sau)} />;
          })}
        </div>
      );

    case "hoi_nhanh":
      return <HoiNhanh d={d} />;

    case "kich_ban":
      return (
        <div className="space-y-3">
          {mang(d.luot).map((l, i) => {
            const luot = (l ?? {}) as Record<string, unknown>;
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: lời thoại cố định của khối
                key={i}
                className={cn("max-w-[90%] rounded-xl p-3", i % 2 ? "ml-auto bg-info-soft" : "bg-surface-2")}
              >
                <p className="text-sm font-semibold">{chuoi(luot.vai)}</p>
                <p className="mt-1 text-base leading-relaxed">{chuoi(luot.loi)}</p>
              </div>
            );
          })}
        </div>
      );

    default:
      // Loại khối chưa dựng: hiện chữ thô để người học không mất nội dung.
      return (
        <div className="rounded-xl border border-dashed border-line-strong p-4 text-base leading-relaxed">
          {chuTrongDuLieu(d).map((s, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: chữ thô chỉ đọc
            <p key={i} className={i ? "mt-2" : undefined}>
              {s}
            </p>
          ))}
        </div>
      );
  }
}

function TheLat({ truoc, sau }: { truoc: string; sau: string }) {
  const [lat, setLat] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setLat((x) => !x)}
      aria-pressed={lat}
      className={cn(
        "min-h-28 rounded-xl border p-4 text-left text-base leading-relaxed transition-colors",
        lat ? "border-primary bg-surface" : "border-line bg-surface-2 font-semibold",
      )}
    >
      {lat ? sau : truoc}
      <span className="mt-2 block text-sm font-normal text-ink-3">
        {lat ? "Bấm để lật lại" : "Bấm để xem"}
      </span>
    </button>
  );
}

/** Câu tự kiểm tra trong bài: chấm ngay trên trình duyệt, không tính điểm. */
function HoiNhanh({ d }: { d: Record<string, unknown> }) {
  const [chon, setChon] = useState<string | null>(null);
  const dapAn = chuoi(d.dap_an);
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-primary">Tự kiểm tra</p>
      <p className="mt-1 text-base font-semibold leading-relaxed">{chuoi(d.cau_hoi)}</p>
      <div className="mt-3 grid gap-2">
        {mang(d.phuong_an).map((p) => {
          const pa = (p ?? {}) as Record<string, unknown>;
          const id = chuoi(pa.id);
          const daChon = chon === id;
          const dung = chon !== null && id === dapAn;
          return (
            <Button
              key={id}
              variant="secondary"
              disabled={chon !== null}
              onClick={() => setChon(id)}
              className={cn(
                "min-h-12 justify-start whitespace-normal text-left text-base font-normal",
                dung && "border-ok bg-ok-soft",
                daChon && !dung && "border-danger bg-danger-soft",
              )}
            >
              {chuoi(pa.text)}
            </Button>
          );
        })}
      </div>
      {chon !== null ? (
        <div className="mt-3 text-base leading-relaxed" role="status">
          <p
            className={cn(
              "flex items-center gap-2 font-semibold",
              chon === dapAn ? "text-ok" : "text-danger",
            )}
          >
            <Icon name={chon === dapAn ? "check" : "x"} kieu="net" className="size-5 shrink-0" />
            {chon === dapAn ? "Đúng." : "Chưa đúng."}
          </p>
          {chuoi(d.giai_thich) ? <p className="mt-1">{chuoi(d.giai_thich)}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
