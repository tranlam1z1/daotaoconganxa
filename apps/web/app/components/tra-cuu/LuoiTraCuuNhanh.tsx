import { Link } from "react-router";

import { Icon, type IconName } from "../ui/Icon";

const O_TRA_CUU_NHANH: Array<{ to: string; icon: IconName; title: string; text: string }> = [
  {
    to: "/tra-cuu-nhanh/muc-phat",
    icon: "banknote",
    title: "Mức phạt",
    text: "Gõ hành vi, chọn loại xe: ra mức tiền, hình thức bổ sung, số điểm bị trừ.",
  },
  {
    to: "/tra-cuu-nhanh/toc-do",
    icon: "gauge",
    title: "Tốc độ",
    text: "Nhập tốc độ cho phép và tốc độ đo được: ra mức phạt tương ứng.",
  },
  {
    to: "/tra-cuu-nhanh/quy-trinh",
    icon: "steps",
    title: "Quy trình, biểu mẫu",
    text: "Các bước xử lý vi phạm theo thứ tự, và biểu mẫu nghiệp vụ để mở xem hoặc tải về.",
  },
  {
    to: "/tra-cuu-nhanh/bien-bao",
    icon: "sign",
    title: "Biển báo",
    text: "Tìm biển theo tên hoặc mã, lọc theo nhóm; xem ý nghĩa và căn cứ.",
  },
];

/** Bốn ô lớn Mức phạt · Tốc độ · Quy trình, biểu mẫu (GĐ5) · Biển báo (GĐ12), dùng ở trang Tra cứu và Tra cứu nhanh. */
export function LuoiTraCuuNhanh() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {O_TRA_CUU_NHANH.map((o) => (
        <li key={o.to}>
          <Link
            to={o.to}
            className="flex h-full min-h-28 flex-col rounded-xl border border-line bg-surface p-5 shadow-card the-bam"
          >
            <span className="flex items-center gap-3 text-xl font-semibold">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                <Icon name={o.icon} className="size-6" />
              </span>
              {o.title}
            </span>
            <span className="mt-2 text-base leading-relaxed text-ink-2">{o.text}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
