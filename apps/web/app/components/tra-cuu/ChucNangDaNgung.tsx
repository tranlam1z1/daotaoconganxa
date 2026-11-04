import { data } from "react-router";
import { pageMeta } from "../../lib/site";
import { ButtonLink } from "../ui/Button";
import { KhungTraCuu } from "./KhungTraCuu";

export function loader() {
  return data(null, { status: 410 });
}
export function meta() {
  return pageMeta("Chức năng đã ngừng cung cấp", { index: false });
}
export default function ChucNangDaNgung() {
  return (
    <KhungTraCuu
      title="Chức năng đã ngừng cung cấp"
      description="Trang hiện phục vụ học tập và tra cứu cho công chức, viên chức, đảng viên."
    >
      <p className="text-ink-2">
        Chức năng chuyên ngành công an và giao thông tại đường dẫn này đã ngừng cung cấp.
      </p>
      <ButtonLink to="/tra-cuu" className="mt-4">
        Mở danh mục tra cứu
      </ButtonLink>
    </KhungTraCuu>
  );
}
