/**
 * Giao diện riêng của từng trò trên khung lượt chơi (docs/PLAN.md GĐ-G0). Trang chơi online
 * (/tro-choi/luot/:id) và trang chơi offline (/tro-choi/offline) dựng bước bằng cùng bảng này.
 *
 * Mỗi trò khai: component dựng một bước từ phần đề máy chủ gửi, câu trả lời rỗng, và điều kiện
 * "đã chọn đủ để gửi". Thêm một trò: thêm một dòng vào GIAO_DIEN.
 *
 * Từ GĐ-T1, trò còn khai được: tên một bước ("Người lái"), nhãn nút sang bước sau, ẩn nút "Chốt đáp
 * án" khi chính thao tác của trò là nộp (đóng dấu), và màn hướng dẫn ngắn (mô-đun M3). Trò không
 * khai giữ nguyên giao diện cũ.
 *
 * Từ GĐ17c, trò có khối kết quả dài (danh sách lỗi, biên bản, bảng so sánh…) khai `ChiTiet`: khối đó
 * nằm trong "Xem chi tiết" của hộp kết quả và của màn "Xem lại từng câu"; `Buoc` chỉ giữ phần đánh dấu
 * trên bảng chơi (docs/PROMPT_HOP_KET_QUA_TRO_CHOI.md mục 2.5, quy tắc cứng 6).
 */
import type { ReactNode } from "react";

import type { DeCamBien } from "../../lib/cam-bien";
import type { DeChotDem } from "../../lib/chot-dem";
import type { ChiTietDuong, DeCungDuong, TraLoiCungDuong } from "../../lib/cung-duong";
import type { DeDungXe, TraLoiDungXe } from "../../lib/dung-xe";
import type { DePhatNguoi } from "../../lib/duyet-phat-nguoi";
import type { DeGiayTo } from "../../lib/kiem-tra-giay-to";
import type { DeBienBan, TraLoiBienBan } from "../../lib/lap-bien-ban";
import type { DeXeKhach } from "../../lib/len-xe-khach";
import type { KetQuaBuocWeb } from "../../lib/luot-choi";
import type { DeCauHoi, KetQuaCauHoi, TraLoiCauHoi } from "../../lib/ngan-hang";
import type { DeSoiCamera } from "../../lib/soi-camera";
import type { DeSoiXe } from "../../lib/soi-xe-cai-tao";
import type { DeTaiDung } from "../../lib/tai-dung";
import type { DeTramCan } from "../../lib/tram-can";
import type { BuocTruyVet, DeTruyVet } from "../../lib/truy-vet";
import type { DeTuLai } from "../../lib/tu-lai";
import { HienThiCauHoi } from "../cau-hoi/HienThiCauHoi";
import { CamBien, ChiTietRiengCamBien, type TraLoiCamBienWeb } from "./CamBien";
import { CauKhoiDongBienBao, type ChiTietKhoiDong } from "./CauKhoiDongBienBao";
import { ChonKhungPhat, daChonSungBan, type TraLoiSungBanWeb } from "./ChonKhungPhat";
import { ChiTietRiengChotDem, ChotDem, type TraLoiChotDemWeb } from "./ChotDem";
import type { BuocHuongDan } from "./chung/HuongDan";
import { ChiTietRiengDungXe, DungXe, TRA_LOI_RONG_DUNG_XE } from "./DungXe";
import { DuongChay, KetQuaDuong, TomTatDuong } from "./DuongChay";
import {
  ChiTietRiengPhatNguoi,
  DuyetPhatNguoi,
  TRA_LOI_RONG_PHAT_NGUOI,
  type TraLoiPhatNguoiWeb,
} from "./DuyetPhatNguoi";
import {
  ChiTietRiengGiayTo,
  KiemTraGiayTo,
  TRA_LOI_RONG_GIAY_TO,
  type TraLoiGiayToWeb,
} from "./KiemTraGiayTo";
import { ChiTietRiengXeKhach, LenXeKhach, TRA_LOI_RONG_XE_KHACH, type TraLoiXeKhachWeb } from "./LenXeKhach";
import { DapAnBienBan, daChonBienBan, MauBienBan } from "./MauBienBan";
import { ChiTietRiengSoiCamera, SoiCamera, type TraLoiSoiCameraWeb } from "./SoiCamera";
import { ChiTietRiengSoiXe, SoiXeCaiTao, TRA_LOI_RONG_SOI_XE, type TraLoiSoiXeWeb } from "./SoiXeCaiTao";
import { ChiTietRiengTaiDung, TaiDung, type TraLoiTaiDungWeb } from "./TaiDung";
import { ChiTietRiengTramCan, TRA_LOI_RONG_TRAM_CAN, type TraLoiTramCanWeb, TramCan } from "./TramCan";
import { ChiTietRiengTruyVet, type TraLoiTruyVetWeb, TruyVet } from "./TruyVet";
import { ChiTietRiengTuLai, type TraLoiTuLaiWeb, TuLai } from "./TuLai";
import { type DeSungBanWeb, XeQuaChot } from "./XeQuaChot";

export interface PropsBuoc<De = unknown, TraLoi = unknown> {
  de: De;
  traLoi: TraLoi;
  datTraLoi: (t: TraLoi) => void;
  /** Phần riêng của kết quả sau khi chấm (`ket_qua.chi_tiet`), để tô đúng/sai trên lựa chọn. */
  chiTiet?: unknown;
  daCham: boolean;
  idGoc: string;
  /** Nộp ngay câu trả lời (trò có `anNutChot`: thao tác của trò là nộp). */
  gui?: (t: TraLoi) => void;
  /**
   * GĐ-T17: ảnh chụp bước (`noi_dung`), chỉ trang chơi offline truyền. Trò có đề bước sau phụ thuộc lựa chọn
   * (Truy vết) cần nó để tự dựng phần đề khi không có máy chủ; các trò khác bỏ qua.
   */
  buocOffline?: unknown;
}

export interface PropsChiTiet<De = unknown> {
  de: De;
  /** `ket_qua.chi_tiet` của bước (luôn có khi `ChiTiet` được dựng). */
  chiTiet: unknown;
  ketQua: KetQuaBuocWeb;
}

export interface GiaoDienTroChoi<De = unknown, TraLoi = unknown> {
  Buoc: (p: PropsBuoc<De, TraLoi>) => ReactNode;
  /** Chi tiết riêng của trò trong "Xem chi tiết" (GĐ17c); không khai thì chỉ có giải thích, căn cứ. */
  ChiTiet?: (p: PropsChiTiet<De>) => ReactNode;
  traLoiRong: TraLoi;
  daChon: (t: TraLoi) => boolean;
  /** Tên một bước, ví dụ "Người lái"; mặc định "Câu". */
  tenBuoc?: string;
  /** Nhãn nút sang bước sau; mặc định "Câu tiếp". */
  nutTiep?: string;
  /** Ẩn nút "Chốt đáp án": bước tự nộp qua `gui`. */
  anNutChot?: boolean;
  /** Màn hướng dẫn trước lượt đầu tiên (mô-đun M3). */
  huongDan?: { tieuDe: string; buoc: readonly BuocHuongDan[] };
}

/** Trò mẫu "Trắc nghiệm nhanh": một câu một đáp án hoặc đúng/sai, dùng lại hiển thị câu hỏi GĐ3. */
const TRAC_NGHIEM: GiaoDienTroChoi<DeCauHoi, { chon: string[] }> = {
  Buoc: ({ de, traLoi, datTraLoi, chiTiet, daCham, idGoc }) => (
    <HienThiCauHoi
      de={de}
      traLoi={traLoi as TraLoiCauHoi}
      onChange={(t) => datTraLoi({ chon: t.chon ?? [] })}
      ketQua={daCham ? ((chiTiet as KetQuaCauHoi | null) ?? null) : null}
      khoa={daCham}
      idGoc={idGoc}
      anPhanHoi
    />
  ),
  traLoiRong: { chon: [] },
  daChon: (t) => t.chon.length > 0,
};

/** "Súng bắn tốc độ" (GĐ-G2): thẻ xe qua chốt và ba câu nhỏ. */
const SUNG_BAN_TOC_DO: GiaoDienTroChoi<DeSungBanWeb, TraLoiSungBanWeb> = {
  Buoc: ({ de, traLoi, datTraLoi, chiTiet, daCham }) => (
    <div className="space-y-5">
      <XeQuaChot de={de} tinh={daCham} />
      <ChonKhungPhat de={de} traLoi={traLoi} datTraLoi={datTraLoi} chiTiet={chiTiet} daCham={daCham} />
    </div>
  ),
  traLoiRong: { vi_pham: null, khung: null, bo_sung: null },
  daChon: daChonSungBan,
};

/**
 * "Cung đường biển báo" (GĐ-G8): 3 câu khởi động đoán biển, rồi đường chạy. Đường chạy tự đặt câu
 * trả lời (nhật ký) khi về đích; trước đó nút "Chốt đáp án" khóa.
 */
const CUNG_DUONG: GiaoDienTroChoi<DeCungDuong, TraLoiCungDuong> = {
  Buoc: ({ de, traLoi, datTraLoi, chiTiet, daCham, idGoc }) => {
    if (de.loai === "doan") {
      return (
        <CauKhoiDongBienBao
          de={de}
          chon={traLoi.loai === "doan" ? traLoi.chon : null}
          datChon={(id) => datTraLoi({ loai: "doan", chon: id })}
          chiTiet={chiTiet as ChiTietKhoiDong | null | undefined}
          daCham={daCham}
          idGoc={idGoc}
        />
      );
    }
    if (daCham && chiTiet) return <TomTatDuong chiTiet={chiTiet as ChiTietDuong} />;
    return <DuongChay de={de} onXong={datTraLoi} />;
  },
  // Câu khởi động chỉ tô phương án trên bảng chơi; đường chạy có bảng từng biển (đề xuất Đ12).
  ChiTiet: ({ chiTiet }) =>
    (chiTiet as { loai?: string }).loai === "duong" ? (
      <KetQuaDuong chiTiet={chiTiet as ChiTietDuong} />
    ) : null,
  traLoiRong: { loai: "doan", chon: null },
  daChon: (t) => (t.loai === "doan" ? t.chon !== null : true),
};

/** "Lập biên bản" (GĐ-G3): lời kể và biểu mẫu 4 ô, không tính giờ. */
const LAP_BIEN_BAN: GiaoDienTroChoi<DeBienBan, TraLoiBienBan> = {
  Buoc: ({ de, traLoi, datTraLoi, chiTiet, daCham }) => (
    <MauBienBan de={de} traLoi={traLoi} datTraLoi={datTraLoi} chiTiet={chiTiet} daCham={daCham} />
  ),
  ChiTiet: DapAnBienBan,
  traLoiRong: { dong: [], bo_sung: [] },
  daChon: daChonBienBan,
};

/** "Kiểm tra giấy tờ" (GĐ-T1): soi giấy tờ, đánh dấu chi tiết sai, đóng dấu là nộp. */
const KIEM_TRA_GIAY_TO: GiaoDienTroChoi<DeGiayTo, TraLoiGiayToWeb> = {
  Buoc: ({ de, traLoi, datTraLoi, chiTiet, daCham, gui }) => (
    <KiemTraGiayTo
      de={de}
      traLoi={traLoi}
      datTraLoi={datTraLoi}
      chiTiet={chiTiet}
      daCham={daCham}
      gui={gui}
    />
  ),
  ChiTiet: ChiTietRiengGiayTo,
  traLoiRong: TRA_LOI_RONG_GIAY_TO,
  daChon: (t) => t.quyet_dinh !== null,
  tenBuoc: "Người lái",
  nutTiep: "Người lái tiếp theo",
  anNutChot: true,
  huongDan: {
    tieuDe: "Kiểm tra giấy tờ",
    buoc: [
      {
        tieuDe: "Soi giấy tờ",
        moTa: "Mỗi người lái đưa giấy tờ lên bàn. Chạm vào một giấy tờ để phóng to và đọc từng dòng; so với xe, với lời người lái và ngày kiểm tra.",
      },
      {
        tieuDe: "Đánh dấu chỗ sai",
        moTa: 'Thấy chi tiết sai (hết hạn, lệch biển số, sai hạng…), chạm vào dòng đó để đánh dấu. Người lái không có giấy nào thì đánh dấu "không có giấy này". Đánh dấu nhầm bị trừ điểm.',
      },
      {
        tieuDe: "Đóng dấu",
        moTa: "Giấy tờ hợp lệ: đóng dấu Cho qua. Có chỗ sai: đóng dấu Giữ lại, các chi tiết đã đánh dấu là lý do. Đóng dấu là nộp, không sửa lại được.",
      },
    ],
  },
};

/** "Dừng xe đúng quy trình" (GĐ-T4): chuỗi cử chỉ; kéo thẻ kết quả vào hướng xử lý là nộp. */
const DUNG_XE: GiaoDienTroChoi<DeDungXe, TraLoiDungXe> = {
  Buoc: ({ de, traLoi, datTraLoi, chiTiet, daCham, gui }) => (
    <DungXe de={de} traLoi={traLoi} datTraLoi={datTraLoi} chiTiet={chiTiet} daCham={daCham} gui={gui} />
  ),
  ChiTiet: ChiTietRiengDungXe,
  traLoiRong: TRA_LOI_RONG_DUNG_XE,
  daChon: (t) => t.nhat_ky.length > 0,
  tenBuoc: "Tình huống",
  nutTiep: "Tiếp",
  anNutChot: true,
  huongDan: {
    tieuDe: "Dừng xe đúng quy trình",
    buoc: [
      {
        tieuDe: "Vuốt lên để ra hiệu lệnh",
        moTa: "Vuốt lên trong ô là giơ tay ra hiệu lệnh dừng xe. Đây là quy ước của trò chơi, không phải tư thế hiệu lệnh thật.",
      },
      {
        tieuDe: "Chạm, kéo, giữ theo đúng thứ tự",
        moTa: "Chạm chỗ cho xe dừng và lời muốn nói; kéo từng giấy tờ vào khay Đạt hoặc Không đạt; giữ nút máy đo đủ thời gian. Làm sai thứ tự hay bỏ bước thì tình huống xấu đi.",
      },
      {
        tieuDe: "Kéo kết quả để kết thúc",
        moTa: 'Kéo thẻ kết quả vào hướng xử lý là nộp. Bấm "Xem chi tiết" ở hộp kết quả để so từng bước của bạn với quy trình chuẩn.',
      },
    ],
  },
};

/** "Cắm biển cho tuyến đường" (GĐ-T3): cắm biển, chạy thử tối đa 3 lần, nộp là gửi nhật ký. */
const CAM_BIEN: GiaoDienTroChoi<DeCamBien, TraLoiCamBienWeb> = {
  Buoc: ({ de, traLoi, datTraLoi, chiTiet, daCham, gui }) => (
    <CamBien
      de={de}
      traLoi={traLoi}
      datTraLoi={datTraLoi}
      chiTiet={chiTiet}
      daCham={daCham}
      gui={gui}
      chiTietTrongHop
    />
  ),
  ChiTiet: ChiTietRiengCamBien,
  traLoiRong: null,
  daChon: (t) => t !== null,
  tenBuoc: "Đoạn đường",
  anNutChot: true,
  huongDan: {
    tieuDe: "Cắm biển cho tuyến đường",
    buoc: [
      {
        tieuDe: "Cắm biển",
        moTa: "Đoạn đường nhìn từ trên xuống, xe chạy từ dưới lên. Kéo biển từ khay vào ô đánh số cạnh đường, hoặc chạm biển rồi chạm ô. Chạm ô đã cắm để gỡ biển.",
      },
      {
        tieuDe: "Cho xe chạy thử",
        moTa: "Xe chạy qua đoạn đường và làm theo biển bạn cắm. Thiếu biển hoặc sai biển thì xe phải phanh gấp, có dấu cảnh báo ở chỗ nguy hiểm. Được chạy thử 3 lần.",
      },
      {
        tieuDe: "Nộp bố trí",
        moTa: "Bố trí của lần chạy thử cuối cùng là bố trí được chấm: biển đúng +10, biển chấp nhận được +5, biển sai −5, cắm vào chỗ nên để trống −3.",
      },
    ],
  },
};

/** "Soi camera" (GĐ-T5): xem phim camera, dừng hình, khoanh xe, gắn thẻ lỗi; nộp là gửi nhật ký. */
const SOI_CAMERA: GiaoDienTroChoi<DeSoiCamera, TraLoiSoiCameraWeb> = {
  Buoc: ({ de, traLoi, datTraLoi, chiTiet, daCham, gui }) => (
    <SoiCamera
      de={de}
      traLoi={traLoi}
      datTraLoi={datTraLoi}
      chiTiet={chiTiet}
      daCham={daCham}
      gui={gui}
      chiTietTrongHop
    />
  ),
  ChiTiet: ChiTietRiengSoiCamera,
  traLoiRong: null,
  daChon: (t) => t !== null,
  tenBuoc: "Đoạn phim",
  anNutChot: true,
  huongDan: {
    tieuDe: "Soi camera",
    buoc: [
      {
        tieuDe: "Dừng hình",
        moTa: 'Xem camera giao thông. Thấy xe vi phạm thì bấm "Dừng hình" ngay: dừng càng sát lúc vi phạm càng được điểm. Được tua lại 5 giây, tối đa 3 lần.',
      },
      {
        tieuDe: "Khoanh xe",
        moTa: "Kéo một khung hoặc vẽ vòng quanh xe vi phạm; chạm thẳng vào xe cũng được. Khung trùm cả xe khác thì vẫn tính nếu không quá 2 xe khác; khoanh xe không vi phạm bị trừ 5 điểm.",
      },
      {
        tieuDe: "Gắn thẻ lỗi",
        moTa: 'Kéo thẻ lỗi đúng (vượt đèn đỏ, đi sai làn, dừng xe sai nơi, không đội mũ bảo hiểm) vào khung, rồi "Tiếp tục". Hết phim thì "Nộp kết quả".',
      },
    ],
  },
};

/** "Tự lái qua phố" (GĐ-T9): lái bằng nút, tới đích hoặc dừng lượt là nộp nhật ký lái. */
const TU_LAI: GiaoDienTroChoi<DeTuLai, TraLoiTuLaiWeb> = {
  Buoc: ({ de, traLoi, datTraLoi, chiTiet, daCham, gui }) => (
    <TuLai de={de} traLoi={traLoi} datTraLoi={datTraLoi} chiTiet={chiTiet} daCham={daCham} gui={gui} />
  ),
  ChiTiet: ChiTietRiengTuLai,
  traLoiRong: null,
  daChon: (t) => t !== null,
  tenBuoc: "Khu phố",
  anNutChot: true,
  huongDan: {
    tieuDe: "Tự lái qua phố",
    buoc: [
      {
        tieuDe: "Giữ Ga, giữ Phanh",
        moTa: "Giữ nút Ga để xe chạy nhanh dần, giữ Phanh để giảm tốc, nhả cả hai thì xe chậm dần. Nhìn biển tốc độ ở góc trên, đi tới cờ đích theo mũi tên chỉ hướng.",
      },
      {
        tieuDe: "Rẽ, chuyển làn, xi nhan",
        moTa: "Gần nơi giao nhau, chạm Rẽ trái hoặc Rẽ phải để chọn hướng; giữa phố, chạm để chuyển làn; đứng yên thì chạm Quay đầu. Nhớ bật xi nhan đúng bên trước khi rẽ.",
      },
      {
        tieuDe: "Biên bản cuối lượt",
        moTa: 'Trò âm thầm ghi mọi lỗi: vượt đèn đỏ, quá tốc độ, đi sai phần đường, không nhường người đi bộ, vào đường cấm, va chạm. Tới đích thì có biên bản trong "Xem chi tiết"; đóng hộp kết quả rồi chạm "Xem lại lúc…" để xem lại lúc xảy ra từng lỗi.',
      },
    ],
  },
};

/** "Duyệt hồ sơ phạt nguội" (GĐ-T11): chạm chỗ thiếu, vuốt trái gửi, vuốt phải trả lại; vuốt là nộp. */
const DUYET_PHAT_NGUOI: GiaoDienTroChoi<DePhatNguoi, TraLoiPhatNguoiWeb> = {
  Buoc: ({ de, traLoi, datTraLoi, chiTiet, daCham, gui }) => (
    <DuyetPhatNguoi
      de={de}
      traLoi={traLoi}
      datTraLoi={datTraLoi}
      chiTiet={chiTiet}
      daCham={daCham}
      gui={gui}
    />
  ),
  ChiTiet: ChiTietRiengPhatNguoi,
  traLoiRong: TRA_LOI_RONG_PHAT_NGUOI,
  daChon: (t) => t.quyet_dinh !== null,
  tenBuoc: "Hồ sơ",
  nutTiep: "Hồ sơ tiếp theo",
  anNutChot: true,
  huongDan: {
    tieuDe: "Duyệt hồ sơ phạt nguội",
    buoc: [
      {
        tieuDe: "Soi hồ sơ",
        moTa: "Mỗi thẻ là một hồ sơ camera ghi lại: ảnh vi phạm, ảnh phóng to biển số, thời điểm, vị trí, thiết bị và hạn kiểm định, hành vi hệ thống đề xuất. Đối chiếu từng phần với ảnh.",
      },
      {
        tieuDe: "Chạm chỗ thiếu",
        moTa: "Biển số không đọc được hoặc đọc sai, thiếu thời điểm, ảnh không thấy rõ hành vi, hành vi đề xuất không khớp ảnh, thiết bị hết hạn kiểm định: chạm vào đúng phần đó. Chạm lại để bỏ. Chạm nhầm bị trừ 2 điểm.",
      },
      {
        tieuDe: "Vuốt để quyết định",
        moTa: "Đủ căn cứ: vuốt trái để gửi thông báo. Thiếu căn cứ: vuốt phải để trả lại, sau khi đã chạm chỗ thiếu. Gửi nhầm hồ sơ thiếu căn cứ mất nhiều điểm hơn trả nhầm. Có nút thay cho vuốt.",
      },
    ],
  },
};

/** "Trạm cân tải trọng" (GĐ-T12): ghim cặp số, ước phần trăm, đóng một trong ba dấu; đóng dấu là nộp. */
const TRAM_CAN: GiaoDienTroChoi<DeTramCan, TraLoiTramCanWeb> = {
  Buoc: ({ de, traLoi, datTraLoi, chiTiet, daCham, gui }) => (
    <TramCan de={de} traLoi={traLoi} datTraLoi={datTraLoi} chiTiet={chiTiet} daCham={daCham} gui={gui} />
  ),
  ChiTiet: ChiTietRiengTramCan,
  traLoiRong: TRA_LOI_RONG_TRAM_CAN,
  daChon: (t) => t.dau !== null,
  tenBuoc: "Xe",
  nutTiep: "Xe tiếp theo",
  anNutChot: true,
  huongDan: {
    tieuDe: "Trạm cân tải trọng",
    buoc: [
      {
        tieuDe: "Ghim cặp số",
        moTa: "Chạm một số trên phiếu cân rồi chạm số giới hạn cần so (trên giấy kiểm định, giấy phép lưu hành hoặc bảng tải trọng tại trạm). Trò hiện hiệu số kg của cặp. Ghim được nhiều cặp; cặp đang chọn là căn cứ.",
      },
      {
        tieuDe: "Ước phần trăm vượt",
        moTa: "Kéo thanh trượt (hoặc bấm −, +) tới phần trăm vượt của cặp căn cứ. Lệch không quá 2 điểm phần trăm thì được điểm. Không vượt thì để 0%; đúng bằng giới hạn là không vượt.",
      },
      {
        tieuDe: "Đóng dấu",
        moTa: "Cho đi: không số nào vượt. Hạ tải: có số vượt nhưng chưa tới khung bị xử phạt. Lập biên bản: có số vượt vào khung bị xử phạt. Đóng dấu là nộp. (Ý nghĩa hai dấu Hạ tải, Lập biên bản đang chờ đơn vị chuyên môn xác nhận.)",
      },
    ],
  },
};

/** "Lên xe khách" (GĐ-T13): đếm người, soi giấy tờ và giám sát, đóng dấu, sắp lỗi; đóng dấu là nộp. */
const LEN_XE_KHACH: GiaoDienTroChoi<DeXeKhach, TraLoiXeKhachWeb> = {
  Buoc: ({ de, traLoi, datTraLoi, chiTiet, daCham, gui }) => (
    <LenXeKhach de={de} traLoi={traLoi} datTraLoi={datTraLoi} chiTiet={chiTiet} daCham={daCham} gui={gui} />
  ),
  ChiTiet: ChiTietRiengXeKhach,
  traLoiRong: TRA_LOI_RONG_XE_KHACH,
  daChon: (t) => t.dau !== null,
  tenBuoc: "Xe",
  nutTiep: "Xe tiếp theo",
  anNutChot: true,
  huongDan: {
    tieuDe: "Lên xe khách",
    buoc: [
      {
        tieuDe: "Đếm người",
        moTa: "Sơ đồ khoang xe nhìn từ trên. Chạm từng người (ngồi, đứng lối đi, nằm sàn) để đếm; chạm lại để bỏ. Hành lý, áo treo, túi không phải người: chạm vào là đếm dư. Chỉnh ô Số người vượt bằng − và +; không vượt thì để 0.",
      },
      {
        tieuDe: "Soi giấy tờ, giám sát",
        moTa: "Từ màn 3, thẻ Giấy tờ có lệnh vận chuyển và phù hiệu; từ màn 4, thẻ Giám sát có các đoạn chạy, dừng và tổng thời gian lái. Chạm đúng dòng sai để đánh dấu. Chạm nhầm bị trừ 2 điểm.",
      },
      {
        tieuDe: "Đóng dấu, sắp lỗi",
        moTa: "Không có lỗi: đóng dấu Cho đi. Có lỗi: Lập biên bản, rồi kéo các lỗi đã chỉ ra vào biên bản theo thứ tự nặng đến nhẹ (theo mức phạt tối đa; bằng nhau thì thứ tự nào cũng đúng). Đóng dấu là nộp.",
      },
    ],
  },
};

/** "Dựng chốt an toàn ban đêm" (GĐ-T15): đặt vật của chốt, chạy thử tối đa 2 lần, nộp là gửi nhật ký. */
const CHOT_DEM: GiaoDienTroChoi<DeChotDem, TraLoiChotDemWeb> = {
  Buoc: ({ de, traLoi, datTraLoi, chiTiet, daCham, gui }) => (
    <ChotDem de={de} traLoi={traLoi} datTraLoi={datTraLoi} chiTiet={chiTiet} daCham={daCham} gui={gui} />
  ),
  ChiTiet: ChiTietRiengChotDem,
  traLoiRong: null,
  daChon: (t) => t !== null,
  tenBuoc: "Đoạn đường",
  anNutChot: true,
  huongDan: {
    tieuDe: "Dựng chốt an toàn ban đêm",
    buoc: [
      {
        tieuDe: "Đặt vật của chốt",
        moTa: "Đoạn đường ban đêm nhìn từ trên xuống, xe chạy từ dưới lên, chốt đánh dấu màu cam. Kéo biển, cọc, đèn, xe tuần tra, chiến sĩ từ túi đồ vào ô trên đường, hoặc chạm vật rồi chạm ô. Chạm vật đã đặt để chỉnh từng mét, đổi cột, xoay biển về phía xe tới.",
      },
      {
        tieuDe: "Chạy thử",
        moTa: "Dòng xe chạy qua trong 60 giây. Kết quả cho biết xe nào phanh gấp, xe nào đi vào vùng nguy hiểm quanh chiến sĩ, hàng chờ dài bao nhiêu, biển nào quá gần chốt hoặc bị khuất. Được chạy thử 2 lần; sau đó vẫn sửa được.",
      },
      {
        tieuDe: "Nộp bố trí",
        moTa: 'Bố trí lúc nộp được chấm theo sáu tiêu chí: khoảng cách biển đầu tiên, hàng cọc liền mạch, chiến sĩ an toàn, số xe phanh gấp, độ dài hàng chờ, biển không bị khuất. Ngưỡng hiện ở "Xem chi tiết" của hộp kết quả (số minh họa, chờ đơn vị xác nhận).',
      },
    ],
  },
};

/** "Soi xe cải tạo" (GĐ-T14): khoanh chỗ khác giấy, nối dòng giấy, đo bằng thước; đóng dấu là nộp. */
const SOI_XE_CAI_TAO: GiaoDienTroChoi<DeSoiXe, TraLoiSoiXeWeb> = {
  Buoc: ({ de, traLoi, datTraLoi, chiTiet, daCham, gui }) => (
    <SoiXeCaiTao de={de} traLoi={traLoi} datTraLoi={datTraLoi} chiTiet={chiTiet} daCham={daCham} gui={gui} />
  ),
  ChiTiet: ChiTietRiengSoiXe,
  traLoiRong: TRA_LOI_RONG_SOI_XE,
  daChon: (t) => t.dau !== null,
  tenBuoc: "Xe",
  nutTiep: "Xe tiếp theo",
  anNutChot: true,
  huongDan: {
    tieuDe: "Soi xe cải tạo",
    buoc: [
      {
        tieuDe: "So hình với giấy",
        moTa: "Mỗi xe có hình nhìn nghiêng, nhìn sau và giấy chứng nhận kiểm định ghi thông số xe gốc: kích thước bao, thùng, cỡ lốp, số chỗ, màu sơn, đèn. Tìm chỗ xe thực tế khác giấy.",
      },
      {
        tieuDe: "Khoanh và nối",
        moTa: "Kéo khung hoặc vẽ vòng quanh chỗ khác giấy (chạm nhẹ để đặt khung nhỏ, hoặc nút Thêm khung). Chọn khung rồi chạm dòng giấy tương ứng. Khung trên 25% hình bị loại; khoanh nhầm trừ 2 điểm. Có Phóng to và Thước đo (mm).",
      },
      {
        tieuDe: "Đóng dấu",
        moTa: "Không có chỗ nào khác giấy: Đạt. Có: Không đạt. Đóng dấu là nộp.",
      },
    ],
  },
};

/** "Truy vết xe bỏ trốn" (GĐ-T17): mở camera, khóa xe, đặt điểm chặn; chốt điểm chặn là nộp. */
const TRUY_VET: GiaoDienTroChoi<DeTruyVet, TraLoiTruyVetWeb> = {
  Buoc: ({ de, traLoi, datTraLoi, chiTiet, daCham, gui, buocOffline }) => (
    <TruyVet
      de={de}
      traLoi={traLoi}
      datTraLoi={datTraLoi}
      chiTiet={chiTiet}
      daCham={daCham}
      gui={gui}
      buocOffline={buocOffline as BuocTruyVet | undefined}
    />
  ),
  ChiTiet: ChiTietRiengTruyVet,
  traLoiRong: null,
  daChon: (t) => t !== null,
  tenBuoc: "Vụ",
  anNutChot: true,
  huongDan: {
    tieuDe: "Truy vết xe bỏ trốn",
    buoc: [
      {
        tieuDe: "Đọc tin báo, chọn camera",
        moTa: "Tin báo nêu loại xe, màu, vài ký tự biển số, hướng chạy. Chạm camera trên bản đồ: trò cho biết xe tới đó sớm nhất lúc nào (tính theo quãng đường từ lần khóa gần nhất). Mỗi lần xem tốn một lượt; camera không thấy xe tốn thêm 30 giây.",
      },
      {
        tieuDe: "Chạm để khóa xe",
        moTa: "Xem đoạn cảnh 10 giây, chạm vào xe khớp mô tả (hoặc chọn trong danh sách xe) để xem kỹ loại, màu, biển số. Xe đang chọn được khóa khi mở camera tiếp theo. Khóa đúng +5, khóa nhầm −3. Nhìn xe rẽ về đâu để chọn camera kế tiếp.",
      },
      {
        tieuDe: "Đặt điểm chặn",
        moTa: "Khi đoán được đường xe đi, đặt điểm chặn trên một ô đường phía trước xe: xe phải tới đó muộn hơn giờ hiện tại ít nhất 60 giây. Chặn đúng +20, cộng 2 điểm mỗi lượt xem còn dư (tối đa 10).",
      },
    ],
  },
};

/** "Tái dựng hiện trường" (GĐ-T10): đặt xe theo dấu vết, mô phỏng, gắn thẻ lỗi; chốt kết luận là nộp. */
const TAI_DUNG: GiaoDienTroChoi<DeTaiDung, TraLoiTaiDungWeb> = {
  Buoc: ({ de, traLoi, datTraLoi, chiTiet, daCham, gui }) => (
    <TaiDung de={de} traLoi={traLoi} datTraLoi={datTraLoi} chiTiet={chiTiet} daCham={daCham} gui={gui} />
  ),
  ChiTiet: ChiTietRiengTaiDung,
  traLoiRong: null,
  daChon: (t) => t !== null,
  tenBuoc: "Vụ",
  anNutChot: true,
  huongDan: {
    tieuDe: "Tái dựng hiện trường",
    buoc: [
      {
        tieuDe: "Đọc dấu vết",
        moTa: "Sơ đồ nhìn từ trên xuống, phía trên là hướng bắc. Viền đứt là vị trí cuối của xe; vệt liền là vết phanh, vệt đứt là vết trượt sau va chạm; mảnh vỡ ở chỗ va chạm. Vết phanh càng dài, xe càng nhanh; đường ướt, đường sỏi thì vết dài hơn.",
      },
      {
        tieuDe: "Dựng xe, mô phỏng",
        moTa: "Kéo từng xe tới vị trí ban đầu (hoặc chọn xe rồi chạm lên sơ đồ, chỉnh bằng nút mũi tên), xoay hướng, chọn tốc độ và hành động. Bấm Mô phỏng để so với dấu vết; được mô phỏng 20 lần, 1–3 lần được thưởng nhiều nhất.",
      },
      {
        tieuDe: "Kết luận",
        moTa: "Ở tab Kết luận, kéo thẻ lỗi vào xe có lỗi, rồi Chốt kết luận. Đây là mô phỏng minh họa để học cách đọc dấu vết, không phải phương pháp giám định.",
      },
    ],
  },
};

export const GIAO_DIEN: Readonly<Record<string, GiaoDienTroChoi<any, any>>> = {
  thu_nghiem: TRAC_NGHIEM,
  sung_ban_toc_do: SUNG_BAN_TOC_DO,
  cung_duong_bien_bao: CUNG_DUONG,
  lap_bien_ban: LAP_BIEN_BAN,
  kiem_tra_giay_to: KIEM_TRA_GIAY_TO,
  dung_xe: DUNG_XE,
  cam_bien: CAM_BIEN,
  soi_camera: SOI_CAMERA,
  tu_lai: TU_LAI,
  duyet_phat_nguoi: DUYET_PHAT_NGUOI,
  tram_can: TRAM_CAN,
  len_xe_khach: LEN_XE_KHACH,
  chot_dem: CHOT_DEM,
  soi_xe_cai_tao: SOI_XE_CAI_TAO,
  truy_vet: TRUY_VET,
  tai_dung_hien_truong: TAI_DUNG,
};

export function giaoDienCua(ma: string): GiaoDienTroChoi<unknown, unknown> | undefined {
  return Object.hasOwn(GIAO_DIEN, ma) ? GIAO_DIEN[ma] : undefined;
}

/** Chi tiết riêng của trò cho `ChiTietKetQua`; trò không khai hoặc kết quả không có `chi_tiet` thì null. */
export function chiTietRieng(
  gd: GiaoDienTroChoi<unknown, unknown>,
  de: unknown,
  ketQua: KetQuaBuocWeb,
): ReactNode {
  const ChiTiet = gd.ChiTiet;
  return ChiTiet && ketQua.chi_tiet != null ? (
    <ChiTiet de={de} chiTiet={ketQua.chi_tiet} ketQua={ketQua} />
  ) : null;
}
