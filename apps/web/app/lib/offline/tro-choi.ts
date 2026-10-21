/**
 * Luật trò chơi chạy trên máy khi mất mạng (docs/PLAN.md GĐ-G0).
 *
 * Import thẳng mã nguồn của packages/dao-tao như cham.ts: điện thoại sinh lượt và chấm bằng
 * CÙNG hàm với máy chủ, nên phản hồi người chơi thấy lúc offline khớp kết quả máy chủ chấm lại
 * khi đồng bộ. Máy chủ sinh lại lượt từ gói đã cấp và seed, không tin kết quả chấm của máy.
 */

export { taoRng } from "../../../../../packages/dao-tao/src/de-thi.ts";
export { layTroChoi, type TroChoiBatKy } from "../../../../../packages/dao-tao/src/tro-choi/dang-ky.ts";
export {
  type BuocLuot,
  chamBuocCoGio,
  type KetQuaBuoc,
  tongKetLuot,
} from "../../../../../packages/dao-tao/src/tro-choi/khung.ts";
