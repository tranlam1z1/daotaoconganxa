import { Link } from "react-router";
import { TEN_NHOM_HOC_TAP } from "../../../../../packages/dao-tao/src/nhom-doi-tuong";
import { Icon } from "../ui/Icon";

const NHOM = [
  {
    ma: "cong_chuc_cap_xa",
    icon: "congSo",
    moTa: "Chuyên đề dành cho công chức cấp xã trong danh mục hiện có.",
  },
  { ma: "vien_chuc", icon: "canBo", moTa: "Chuyên đề dành cho viên chức." },
  { ma: "dang_vien", icon: "co", moTa: "Chuyên đề dành cho đảng viên." },
] as const;

export function AudienceGroups({ choXacMinh }: { choXacMinh: boolean }) {
  return (
    <section aria-labelledby="nhom-noi-dung" className="home-audience-section">
      <div className="home-section-heading">
        <h2 id="nhom-noi-dung">
          <Icon name="layers" kieu="net" className="size-6 text-primary" />
          Học tập theo nhóm
        </h2>
      </div>
      <div className="home-audiences">
        {NHOM.map((nhom) => (
          <Link
            key={nhom.ma}
            to={choXacMinh ? "/tai-khoan" : `/hoc?nhom=${nhom.ma}`}
            className={`home-audience home-audience-${nhom.ma} the-bam`}
          >
            <span className="home-audience-icon">
              <Icon name={nhom.icon} kieu="net" className="size-8" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold">{TEN_NHOM_HOC_TAP[nhom.ma]}</span>
              <span className="mt-1 block text-sm leading-relaxed text-ink-2">{nhom.moTa}</span>
            </span>
            <Icon name="chevronRight" kieu="net" className="size-5 shrink-0" />
          </Link>
        ))}
      </div>
    </section>
  );
}
