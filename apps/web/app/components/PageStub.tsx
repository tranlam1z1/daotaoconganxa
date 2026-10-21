import type { ReactNode } from "react";

import { EmptyState } from "./ui/EmptyState";
import type { IconName } from "./ui/Icon";
import { PageHeader } from "./ui/PageHeader";

/**
 * Khung tạm cho trang chưa dựng xong ở giao diện mới: tiêu đề thật và danh sách chức năng
 * sẽ có. Thay bằng nội dung thật khi dựng từng trang; câu thông báo ở đây nói về chính trang
 * nên không được giữ lại lâu (QUY-TAC-HANH-VAN.md §2.1).
 */
export function PageStub({
  eyebrow,
  title,
  description,
  features,
  icon,
  actions,
  embedded = false,
  thongBao = "Trang đang được dựng lại trên giao diện mới",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Chức năng trang sẽ cung cấp, mỗi mục một câu ngắn. */
  features: string[];
  icon?: IconName;
  actions?: ReactNode;
  /** true khi trang nằm trong một layout đã có khung và đầu trang riêng. */
  embedded?: boolean;
  /** Câu báo trạng thái trong khung, thay câu mặc định cho trang mới chưa từng có. */
  thongBao?: string;
}) {
  const body = (
    <EmptyState icon={icon} title={thongBao}>
      <ul className="mt-1 space-y-1 text-left">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" />
            {f}
          </li>
        ))}
      </ul>
    </EmptyState>
  );

  if (embedded) {
    return (
      <section>
        <h2 className="mb-4 text-xl font-semibold">{title}</h2>
        {body}
      </section>
    );
  }

  return (
    <div className="wrap py-10">
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
      <div className="mt-8">{body}</div>
    </div>
  );
}
