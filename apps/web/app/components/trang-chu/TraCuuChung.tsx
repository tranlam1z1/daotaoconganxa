import { OTimVanBan } from "../tra-cuu/OTimVanBan";

/** Ô tìm dùng chung, gửi tới chức năng tìm văn bản hiện có. */
export function TraCuuChung() {
  return (
    <section
      aria-labelledby="tra-cuu-chung"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6"
    >
      <h2 id="tra-cuu-chung" className="text-xl font-semibold">
        Tra cứu văn bản
      </h2>
      <p className="mt-2 text-sm text-ink-2">
        Nhập số hiệu, tên văn bản, điều khoản hoặc từ khóa công việc cần tra.
      </p>
      <OTimVanBan q="" />
    </section>
  );
}
