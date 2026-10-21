/**
 * Chấm và rút câu trên máy khi luyện tập offline (docs/PLAN.md GĐ13).
 *
 * Import thẳng mã nguồn của packages/dao-tao: cùng một thuật toán rút câu, đảo phương án và
 * chấm với máy chủ, nên kết quả người học thấy lúc offline khớp kết quả máy chủ chấm lại khi
 * đồng bộ. Các tệp này là TypeScript thuần, không chạm CSDL hay mạng, nên chạy được trong trình
 * duyệt. Đây là ngoại lệ có chủ đích của giả định A2 (web chỉ gọi API): luật chấm phải chạy
 * được khi không có API.
 */

export {
  chamCauHoi,
  type KetQuaCauHoi,
  type TraLoiCauHoi,
} from "../../../../../packages/dao-tao/src/cau-hoi.ts";
export type {
  CauHoiNguon,
  CauTrongDe,
} from "../../../../../packages/dao-tao/src/de-thi.ts";
export { rutCauLuyenTap, SO_CAU_MOI_PHIEN } from "../../../../../packages/dao-tao/src/luyen-tap.ts";
