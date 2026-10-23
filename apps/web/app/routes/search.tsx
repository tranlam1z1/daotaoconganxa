/**
 * Tra cứu văn bản: khung tìm (gõ hoặc nói) và "Danh sách tra cứu" gồm các thẻ văn bản đánh số
 * (docs/PLAN.md GĐ1). Trạng thái hiệu lực trên thẻ tính theo hôm nay. Hai tab trên cùng nối với trang
 * Quy trình, Biểu mẫu.
 * - Chưa nhập từ khóa: liệt kê cả kho, văn bản ban hành gần đây lên đầu, có phân trang.
 * - Có từ khóa: kết quả tìm kiếm (cấp điều, khoản) gộp theo văn bản; mỗi thẻ kèm các điều khoản khớp.
 */
import { useNavigation } from "react-router";
import { KhungTraCuu } from "../components/tra-cuu/KhungTraCuu";

import { OTimVanBan } from "../components/tra-cuu/OTimVanBan";
import { TabVanBanBieuMau } from "../components/tra-cuu/TabVanBanBieuMau";
import { TheVanBan } from "../components/tra-cuu/TheVanBan";
import { ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { getDocuments, search } from "../lib/api";
import { cn } from "../lib/cn";
import { pageMeta } from "../lib/site";
import { gopTheoVanBan, TU_KHOA_TOI_DA, tuVanBan } from "../lib/tra-cuu-van-ban";
import type { Route } from "./+types/search";

export function meta({ location }: Route.MetaArgs) {
  const q = new URLSearchParams(location.search).get("q")?.trim().slice(0, 80);
  return pageMeta(q ? `Tra cứu: ${q}` : "Tra cứu văn bản", { index: false });
}

const MOI_TRANG = 20;
/** Số điều, khoản lấy về để gộp theo văn bản; cũng là mức tối đa API trả trong một lần gọi. */
const SO_KET_QUA_GOP = 100;

export async function loader({ request }: Route.LoaderArgs) {
  const p = new URL(request.url).searchParams;
  const q = (p.get("q") ?? "").trim();
  const page = Math.max(1, Number(p.get("page") ?? "1") || 1);

  if (!q) {
    const ds = await getDocuments({ sort: "moi_nhat", page, limit: MOI_TRANG });
    return { q, quaDai: false, page, vanBan: ds.items.map(tuVanBan), total: ds.total };
  }
  // API từ chối từ khóa quá dài; báo ngay tại trang thay vì để lỗi máy chủ. Không điền lại vào ô tìm.
  if (q.length > TU_KHOA_TOI_DA) return { q: "", quaDai: true, page: 1, vanBan: [], total: 0 };

  // Gộp theo văn bản nên lấy một lần đủ nhiều điều khoản, không phân trang theo điều khoản.
  const kq = await search({ q, limit: SO_KET_QUA_GOP });
  const vanBan = gopTheoVanBan(kq.hits);
  return { q, quaDai: false, page: 1, vanBan, total: vanBan.length };
}

export default function SearchPage({ loaderData }: Route.ComponentProps) {
  const { q, quaDai, page, vanBan, total } = loaderData;
  const busy = useNavigation().state === "loading";

  // Chỉ danh sách cả kho (chưa nhập từ khóa) mới phân trang.
  const conNua = !q && page * MOI_TRANG < total;
  const hrefTrang = (n: number) => (n > 1 ? `/tim-kiem?page=${n}` : "/tim-kiem");

  return (
    <KhungTraCuu
      title="Tra cứu văn bản pháp luật"
      description="Tìm kiếm văn bản, điều khoản và căn cứ pháp luật."
    >
      <TabVanBanBieuMau chon="van-ban" />
      <div className="mt-4">
        <OTimVanBan q={q} />
      </div>

      <section
        aria-labelledby="tk-danh-sach"
        className={cn("mt-6 border-t border-line pt-4", busy && "opacity-60")}
        aria-busy={busy}
      >
        <h2 id="tk-danh-sach" className="font-sans text-xl font-semibold">
          Danh sách tra cứu
        </h2>
        {quaDai ? (
          <EmptyState icon="search" title="Từ khóa quá dài" className="mt-3">
            <p>Từ khóa tối đa {TU_KHOA_TOI_DA} ký tự. Hãy rút gọn rồi tra lại.</p>
          </EmptyState>
        ) : vanBan.length === 0 ? (
          q ? (
            <EmptyState icon="search" title={`Không tìm thấy quy định khớp với “${q}”`} className="mt-3">
              <p>Thử từ khóa ngắn hơn hoặc đặt câu hỏi cho trợ lý AI.</p>
            </EmptyState>
          ) : (
            <EmptyState icon="book" title="Chưa có văn bản nào" className="mt-3" />
          )
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-3" aria-live="polite">
              {q
                ? `${total.toLocaleString("vi-VN")} văn bản có nội dung khớp “${q}”`
                : `${total.toLocaleString("vi-VN")} văn bản, mới ban hành xếp trước`}
            </p>
            <ol className="mt-3 grid gap-3">
              {vanBan.map((vb, i) => (
                <TheVanBan key={vb.urn} vb={vb} stt={(page - 1) * MOI_TRANG + i + 1} q={q} />
              ))}
            </ol>
            {page > 1 || conNua ? (
              <nav aria-label="Trang danh sách" className="mt-6 flex justify-between gap-3">
                {page > 1 ? (
                  <ButtonLink to={hrefTrang(page - 1)} variant="secondary">
                    Trang trước
                  </ButtonLink>
                ) : (
                  <span />
                )}
                {conNua ? (
                  <ButtonLink to={hrefTrang(page + 1)} variant="secondary">
                    Trang sau
                  </ButtonLink>
                ) : null}
              </nav>
            ) : null}
          </>
        )}

        {q ? (
          <div className="mt-8 rounded-xl border border-line bg-surface-2 p-4">
            <p className="text-[15px] text-ink-2">
              Trợ lý AI trả lời bằng lời thường, kèm điều, khoản căn cứ để đối chiếu.
            </p>
            <ButtonLink
              to={`/hoi-dap?q=${encodeURIComponent(q)}`}
              variant="secondary"
              // Từ khóa dài: nhãn xuống dòng trong nút thay vì tràn ra ngoài màn hình.
              className="mt-3 max-w-full whitespace-normal break-words py-2 text-center"
            >
              Hỏi trợ lý AI về “{q}”
            </ButtonLink>
          </div>
        ) : null}
      </section>
    </KhungTraCuu>
  );
}
