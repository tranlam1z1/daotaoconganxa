/**
 * Nhãn tiếng Việt và cách nhóm quan hệ theo ke-hoach/03-mo-hinh-du-lieu.md §2.6.
 * "Văn bản cha" = văn bản thứ bậc cao hơn mà văn bản này căn cứ / quy định chi tiết.
 * "Văn bản con" = ngược lại. "Ảnh hưởng liên quan" = sửa đổi, bãi bỏ, thay thế,
 * đình chỉ, đính chính, hướng dẫn, dẫn chiếu.
 */

/** Nhóm hiển thị của một quan hệ đối với văn bản đang xem. */
export type RelationGroup = "van_ban_cha" | "van_ban_con" | "anh_huong" | "khac";

interface RelationDef {
  /** Nhãn khi văn bản đang xem là `from` (chiều đi ra). */
  out: string;
  /** Nhãn khi văn bản đang xem là `to` (chiều đi vào). */
  in: string;
  /** Nhóm khi chiều đi ra. */
  groupOut: RelationGroup;
  /** Nhóm khi chiều đi vào. */
  groupIn: RelationGroup;
}

export const RELATION_TYPES: Record<string, RelationDef> = {
  can_cu: { out: "Căn cứ vào", in: "Là căn cứ của", groupOut: "van_ban_cha", groupIn: "van_ban_con" },
  la_can_cu_cua: { out: "Là căn cứ của", in: "Căn cứ vào", groupOut: "van_ban_con", groupIn: "van_ban_cha" },
  huong_dan: {
    out: "Quy định chi tiết, hướng dẫn",
    in: "Được hướng dẫn bởi",
    groupOut: "van_ban_cha",
    groupIn: "van_ban_con",
  },
  duoc_huong_dan_boi: {
    out: "Được hướng dẫn bởi",
    in: "Quy định chi tiết, hướng dẫn",
    groupOut: "van_ban_con",
    groupIn: "van_ban_cha",
  },
  sua_doi: {
    out: "Sửa đổi, bổ sung",
    in: "Bị sửa đổi, bổ sung bởi",
    groupOut: "anh_huong",
    groupIn: "anh_huong",
  },
  bi_sua_doi_boi: {
    out: "Bị sửa đổi, bổ sung bởi",
    in: "Sửa đổi, bổ sung",
    groupOut: "anh_huong",
    groupIn: "anh_huong",
  },
  bai_bo: { out: "Bãi bỏ", in: "Bị bãi bỏ bởi", groupOut: "anh_huong", groupIn: "anh_huong" },
  bi_bai_bo_boi: { out: "Bị bãi bỏ bởi", in: "Bãi bỏ", groupOut: "anh_huong", groupIn: "anh_huong" },
  thay_the: { out: "Thay thế", in: "Bị thay thế bởi", groupOut: "anh_huong", groupIn: "anh_huong" },
  bi_thay_the_boi: { out: "Bị thay thế bởi", in: "Thay thế", groupOut: "anh_huong", groupIn: "anh_huong" },
  dinh_chinh: { out: "Đính chính", in: "Được đính chính bởi", groupOut: "anh_huong", groupIn: "anh_huong" },
  hop_nhat: { out: "Hợp nhất", in: "Được hợp nhất tại", groupOut: "anh_huong", groupIn: "anh_huong" },
  dinh_chi: {
    out: "Đình chỉ, ngưng hiệu lực",
    in: "Bị đình chỉ, ngưng hiệu lực bởi",
    groupOut: "anh_huong",
    groupIn: "anh_huong",
  },
  cong_bo_het_hieu_luc: {
    out: "Công bố hết hiệu lực",
    in: "Được công bố hết hiệu lực bởi",
    groupOut: "anh_huong",
    groupIn: "anh_huong",
  },
  dan_chieu: { out: "Dẫn chiếu tới", in: "Được dẫn chiếu bởi", groupOut: "anh_huong", groupIn: "anh_huong" },
  ap_dung_chuyen_tiep: {
    out: "Quy định chuyển tiếp cho",
    in: "Được áp dụng chuyển tiếp theo",
    groupOut: "anh_huong",
    groupIn: "anh_huong",
  },
  cha_con: { out: "Văn bản con", in: "Văn bản cha", groupOut: "van_ban_con", groupIn: "van_ban_cha" },
};

export function relationLabel(type: string, direction: "out" | "in"): string {
  const def = RELATION_TYPES[type];
  if (!def) return type;
  return direction === "out" ? def.out : def.in;
}

export function relationGroup(type: string, direction: "out" | "in"): RelationGroup {
  const def = RELATION_TYPES[type];
  if (!def) return "khac";
  return direction === "out" ? def.groupOut : def.groupIn;
}

export const GROUP_LABELS: Record<RelationGroup, string> = {
  van_ban_cha: "Văn bản cha (căn cứ, được hướng dẫn)",
  van_ban_con: "Văn bản con (quy định chi tiết, hướng dẫn)",
  anh_huong: "Văn bản ảnh hưởng liên quan",
  khac: "Quan hệ khác",
};

/** Nhãn tiếng Việt của trạng thái hiệu lực văn bản. */
export const DOC_STATUS_LABELS: Record<string, string> = {
  chua_hieu_luc: "Chưa có hiệu lực",
  con_hieu_luc: "Còn hiệu lực",
  het_hieu_luc_mot_phan: "Hết hiệu lực một phần",
  het_hieu_luc: "Hết hiệu lực",
  ngung_hieu_luc: "Ngưng hiệu lực",
  khong_xac_dinh: "Không xác định",
};

/** Nhãn tiếng Việt của trạng thái nút. */
export const NODE_STATUS_LABELS: Record<string, string> = {
  active: "Đang áp dụng",
  amended: "Đã được sửa đổi, bổ sung",
  repealed: "Đã bị bãi bỏ",
  suspended: "Bị ngưng hiệu lực",
  added: "Được bổ sung",
};

/** Nhãn tiếng Việt của loại phiên bản. */
export const VERSION_KIND_LABELS: Record<string, string> = {
  original: "Bản gốc",
  corrigendum: "Bản đính chính",
  consolidated_official: "Văn bản hợp nhất chính thức",
  consolidated_auto: "Bản hợp nhất tự động",
  reissue: "Bản ban hành lại",
};

/** Nhãn tiếng Việt của lệnh sửa đổi. */
export const AMEND_OP_LABELS: Record<string, string> = {
  replace: "Sửa đổi, bổ sung (thay nội dung)",
  insert_after: "Bổ sung sau",
  insert_before: "Bổ sung trước",
  append_child: "Bổ sung vào cuối",
  delete: "Xóa",
  repeal: "Bãi bỏ",
  suspend: "Ngưng hiệu lực",
  rename: "Sửa tên",
  replace_phrase: "Thay thế cụm từ",
};
