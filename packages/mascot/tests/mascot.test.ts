/** Bộ nhân vật: định tuyến, chọn hành động, dựng hình. */
import { describe, expect, test } from "bun:test";
import {
  chonHanhDong,
  chonLoiThoai,
  chonNhanVat,
  chonTrangPhuc,
  danhGiaHanhDong,
  diemKhop,
  HANH_DONG_GOC,
  type HanhDong,
  kiemTraHanhDong,
  type NguCanhPhien,
  NHAN_VAT_GOC,
  type NhanVat,
  TRANG_PHUC,
  TRANG_THAI,
  thayBien,
  trangPhucHopLe,
  veMascot,
} from "../src/index.ts";

const nhanVat: NhanVat[] = NHAN_VAT_GOC.map((n, i) => ({ ...n, id: `p${i + 1}` }));
const tim = (code: string) => nhanVat.find((n) => n.code === code)!;

function phien(p: Partial<NguCanhPhien> = {}): NguCanhPhien {
  return {
    bien: {},
    mucXuatHien: "day_du",
    soLanTrongPhien: 0,
    giayTuLanTruoc: 9999,
    lanChayGanNhat: {},
    soLanTrongPhienTheoCode: {},
    soLanHomNayTheoCode: {},
    daDong: [],
    dangNhapLieu: false,
    ...p,
  };
}

function hanhDong(p: Partial<HanhDong>): HanhDong {
  return {
    id: "h1",
    code: "h1",
    personaId: null,
    trigger: "tra_loi_sai",
    conditions: [],
    priority: 50,
    cooldownSeconds: 60,
    maxPerSession: 3,
    maxPerDay: 10,
    anchor: "goc_phai_duoi",
    state: "binh_thuong",
    pose: "dung",
    effect: "khong",
    speech: [{ text: "xin chào", loai: "loi_dan" }],
    audiences: [],
    courseIds: [],
    enabled: true,
    ...p,
  } as HanhDong;
}

describe("bộ nhân vật", () => {
  test("có đúng bảy nhân vật và một nhân vật mặc định duy nhất", () => {
    expect(nhanVat).toHaveLength(7);
    expect(nhanVat.filter((n) => n.isDefault)).toHaveLength(1);
    expect(tim("muc_thuoc").isDefault).toBe(true);
  });

  test("mã nhân vật không trùng nhau", () => {
    expect(new Set(nhanVat.map((n) => n.code)).size).toBe(nhanVat.length);
  });

  test("mỗi nhân vật có phiếu nhân vật để giữ nhận dạng khi sinh ảnh", () => {
    for (const n of nhanVat) expect(n.characterSheet.length).toBeGreaterThan(60);
  });

  test("nhân vật chỉ mặc trang phục trong danh sách cho phép", () => {
    // Rùa Đá không mặc áo bảo hộ công trường.
    expect(trangPhucHopLe(tim("rua_da"), "bao_ho_cong_truong")).toBe(false);
    expect(chonTrangPhuc(tim("rua_da"), "bao_ho_cong_truong")).toBe("thuong_ngay");
    expect(chonTrangPhuc(tim("muc_thuoc"), "bao_ho_cong_truong")).toBe("bao_ho_cong_truong");
  });
});

describe("định tuyến nhân vật", () => {
  test("người học tự chọn thắng mọi tầng khác", () => {
    const kq = chonNhanVat({
      nhanVat,
      nguoiHocChonId: tim("hoi_han").id,
      chuyenDeChiDinhId: tim("rua_da").id,
      audiences: ["lanh_dao"],
    });
    expect(kq.nhanVat?.code).toBe("hoi_han");
    expect(kq.lyDo).toBe("nguoi_hoc_chon");
  });

  test("chuyên đề khoá quyền đổi thì lựa chọn của người học bị bỏ qua", () => {
    const kq = chonNhanVat({
      nhanVat,
      nguoiHocChonId: tim("hoi_han").id,
      khoaDoi: true,
      chuyenDeChiDinhId: tim("rua_da").id,
    });
    expect(kq.nhanVat?.code).toBe("rua_da");
    expect(kq.lyDo).toBe("chuyen_de_chi_dinh");
  });

  test("bài đánh giá thì Cân Nhắc chiếm quyền, trên cả chỉ định của chuyên đề", () => {
    const kq = chonNhanVat({
      nhanVat,
      nguCanh: "bai_danh_gia",
      banGiao: new Map([["bai_danh_gia", tim("can_nhac").id]]),
      chuyenDeChiDinhId: tim("muc_thuoc").id,
    });
    expect(kq.nhanVat?.code).toBe("can_nhac");
    expect(kq.lyDo).toBe("ban_giao_ngu_canh");
  });

  test("không ai chỉ định thì chọn theo đối tượng và chủ đề", () => {
    expect(chonNhanVat({ nhanVat, audiences: ["nguoi_dan"] }).nhanVat?.code).toBe("sang_to");
    expect(chonNhanVat({ nhanVat, audiences: ["ke_toan"], topics: ["chi_phi"] }).nhanVat?.code).toBe(
      "dan_do",
    );
    expect(chonNhanVat({ nhanVat, audiences: ["lanh_dao"] }).nhanVat?.code).toBe("seu_dau_do");
  });

  test("đối tượng nặng hơn chủ đề: cách nói quyết định người học có nghe không", () => {
    // Chuyên đề chi phí nhưng dành cho lãnh đạo -> Sếu Đầu Đỏ, không phải Đắn Đo.
    const kq = chonNhanVat({ nhanVat, audiences: ["lanh_dao"], topics: ["chi_phi"] });
    expect(kq.nhanVat?.code).toBe("seu_dau_do");
    expect(diemKhop(tim("seu_dau_do"), ["lanh_dao"], ["chi_phi"])).toBeGreaterThan(
      diemKhop(tim("dan_do"), ["lanh_dao"], ["chi_phi"]),
    );
  });

  test("không khớp gì thì về nhân vật mặc định", () => {
    const kq = chonNhanVat({ nhanVat, audiences: ["doi_tuong_la"] });
    expect(kq.nhanVat?.code).toBe("muc_thuoc");
    expect(kq.lyDo).toBe("mac_dinh");
  });

  test("nhân vật bị tắt không được chọn", () => {
    const tat = nhanVat.map((n) => (n.code === "sang_to" ? { ...n, enabled: false } : n));
    expect(chonNhanVat({ nhanVat: tat, audiences: ["nguoi_dan"] }).nhanVat?.code).not.toBe("sang_to");
  });
});

describe("chọn hành động", () => {
  const ds = [hanhDong({ code: "a", priority: 40 }), hanhDong({ code: "b", priority: 80 })];

  test("chọn hành động ưu tiên cao nhất", () => {
    expect(chonHanhDong("tra_loi_sai", ds, phien()).hanhDong?.code).toBe("b");
  });

  test("không chen ngang khi người học đang nhập liệu", () => {
    const kq = chonHanhDong("tra_loi_sai", ds, phien({ dangNhapLieu: true }));
    expect(kq.hanhDong).toBeNull();
    expect(kq.lyDoImLang).toBe("dang_nhap_lieu");
  });

  // Hạn mức tần suất chung chỉ áp cho lần nhân vật TỰ lên tiếng, nên các phép thử dưới đây
  // dùng `vao_bai` (chủ động) chứ không dùng `tra_loi_sai` (phản hồi cho thao tác người học).
  const chuDong = [hanhDong({ code: "cd", trigger: "vao_bai", priority: 60 })];

  test("hạn mức phiên chặn hành động chủ động", () => {
    const kq = chonHanhDong("vao_bai", chuDong, phien({ soLanTrongPhien: 8 }));
    expect(kq.lyDoImLang).toBe("vuot_han_muc_phien");
  });

  test("chưa đủ khoảng cách giữa hai lần xuất hiện chủ động thì im lặng", () => {
    expect(chonHanhDong("vao_bai", chuDong, phien({ giayTuLanTruoc: 30 })).hanhDong).toBeNull();
  });

  test("hành động đã bị người học đóng thì nghỉ", () => {
    const kq = chonHanhDong("tra_loi_sai", ds, phien({ daDong: ["b"] }));
    expect(kq.hanhDong?.code).toBe("a");
  });

  test("chế độ yên lặng im mọi thứ, TRỪ sự kiện pháp lý", () => {
    const yen = phien({ mucXuatHien: "yen_lang" });
    expect(chonHanhDong("tra_loi_sai", ds, yen).hanhDong).toBeNull();

    const canhBao = [hanhDong({ code: "hh", trigger: "can_cu_het_hieu_luc", priority: 100 })];
    expect(chonHanhDong("can_cu_het_hieu_luc", canhBao, yen).hanhDong?.code).toBe("hh");
  });

  test("tắt hẳn vẫn phải báo căn cứ hết hiệu lực", () => {
    const canhBao = [hanhDong({ code: "hh", trigger: "can_cu_het_hieu_luc" })];
    const tat = phien({ mucXuatHien: "tat", soLanTrongPhien: 50, giayTuLanTruoc: 0 });
    expect(chonHanhDong("can_cu_het_hieu_luc", canhBao, tat).hanhDong?.code).toBe("hh");
  });

  test("phản hồi cho thao tác của người học không bị hạn mức tần suất chung chặn", () => {
    // Đây từng là lỗi thật: nhân vật chào đầu bài xong thì im lặng suốt, kể cả khi người học
    // vừa nộp bài sai — đúng lúc họ đang chờ nghe. Hạn mức "một lần mỗi ba phút" chỉ áp cho
    // lần nhân vật TỰ lên tiếng.
    const vuaChao = phien({ soLanTrongPhien: 1, giayTuLanTruoc: 5 });
    expect(chonHanhDong("tra_loi_sai", ds, vuaChao).hanhDong?.code).toBe("b");
    // Còn sự kiện chủ động thì vẫn phải chờ đủ khoảng cách.
    const chuDong = [hanhDong({ code: "cd", trigger: "vao_bai" })];
    expect(chonHanhDong("vao_bai", chuDong, vuaChao).lyDoImLang).toBe("chua_du_khoang_cach");
  });

  test("phản hồi vẫn chịu hạn mức riêng của từng hành động", () => {
    // Bỏ hạn mức chung không có nghĩa là một câu được lặp vô hạn trong cùng một phiên.
    const nc = phien({
      giayTuLanTruoc: 5,
      soLanTrongPhienTheoCode: { b: 99 },
      soLanHomNayTheoCode: { b: 99 },
    });
    expect(chonHanhDong("tra_loi_sai", ds, nc).hanhDong?.code).toBe("a");
  });

  test("người học tự bấm gọi thì hạn mức tần suất không áp dụng", () => {
    // Hạn mức tồn tại để nhân vật không chen ngang, không phải để từ chối một yêu cầu
    // trực tiếp. Đây từng là lỗi thật: nút "gọi trợ giúp" bấm vào không có phản hồi.
    const bi = phien({
      soLanTrongPhien: 99,
      giayTuLanTruoc: 0,
      daDong: ["cd"],
      soLanTrongPhienTheoCode: { cd: 99 },
      soLanHomNayTheoCode: { cd: 99 },
      lanChayGanNhat: { cd: 0 },
    });
    expect(chonHanhDong("vao_bai", chuDong, bi).hanhDong).toBeNull();
    expect(chonHanhDong("vao_bai", chuDong, { ...bi, nguoiHocGoi: true }).hanhDong?.code).toBe("cd");
  });

  test("gọi trực tiếp vẫn trả lời kể cả ở chế độ yên lặng và chế độ tắt", () => {
    for (const muc of ["yen_lang", "tat"] as const) {
      const nc = phien({ mucXuatHien: muc, nguoiHocGoi: true });
      expect(chonHanhDong("vao_bai", chuDong, nc).hanhDong?.code).toBe("cd");
    }
  });

  test("gọi trực tiếp vẫn phải thoả điều kiện của hành động", () => {
    // Bỏ hạn mức không có nghĩa là bỏ luôn điều kiện: hành động sai điều kiện vẫn không chạy.
    const co = [
      hanhDong({ code: "c", conditions: [{ truong: "so_lan_sai", toan_tu: "lon_hon", gia_tri: 2 }] }),
    ];
    const nc = phien({ bien: { so_lan_sai: 1 }, nguoiHocGoi: true });
    expect(chonHanhDong("tra_loi_sai", co, nc).lyDoImLang).toBe("khong_khop_dieu_kien");
  });

  test("chế độ ít chỉ cho qua hành động ưu tiên cao", () => {
    const it = phien({ mucXuatHien: "it" });
    expect(chonHanhDong("tra_loi_sai", [hanhDong({ code: "a", priority: 40 })], it).hanhDong).toBeNull();
    expect(chonHanhDong("tra_loi_sai", [hanhDong({ code: "b", priority: 80 })], it).hanhDong?.code).toBe("b");
  });

  test("điều kiện không thoả thì im lặng và nói rõ lý do", () => {
    const co = [
      hanhDong({ code: "c", conditions: [{ truong: "so_lan_sai", toan_tu: "lon_hon", gia_tri: 2 }] }),
    ];
    expect(chonHanhDong("tra_loi_sai", co, phien({ bien: { so_lan_sai: 1 } })).lyDoImLang).toBe(
      "khong_khop_dieu_kien",
    );
    expect(chonHanhDong("tra_loi_sai", co, phien({ bien: { so_lan_sai: 3 } })).hanhDong?.code).toBe("c");
  });

  test("lời thoại xoay vòng để không lặp lại một câu", () => {
    const hd = hanhDong({ speech: [{ text: "một" }, { text: "hai" }] });
    expect(chonLoiThoai(hd, 0)?.text).toBe("một");
    expect(chonLoiThoai(hd, 1)?.text).toBe("hai");
    expect(chonLoiThoai(hd, 2)?.text).toBe("một");
  });

  test("lời pháp lý không có viện dẫn bị loại, dù cấu hình sai", () => {
    const hd = hanhDong({
      speech: [
        { text: "Điều 91 quy định...", loai: "loi_phap_ly" },
        { text: "Mình mở căn cứ nhé", loai: "loi_dan" },
      ],
    });
    expect(chonLoiThoai(hd, 0)?.loai).toBe("loi_dan");
  });
});

describe("kịch bản gieo sẵn", () => {
  test("mọi hành động gieo sẵn đều hợp lệ", () => {
    for (const hd of HANH_DONG_GOC) expect(kiemTraHanhDong(hd)).toEqual([]);
  });

  test("mã hành động không trùng nhau", () => {
    expect(new Set(HANH_DONG_GOC.map((h) => h.code)).size).toBe(HANH_DONG_GOC.length);
  });

  test("cảnh báo hiệu lực có ưu tiên cao nhất và không có thời gian nghỉ", () => {
    const hd = HANH_DONG_GOC.find((h) => h.code === "canh_bao_het_hieu_luc")!;
    expect(hd.priority).toBe(100);
    expect(hd.cooldownSeconds).toBe(0);
  });

  test("không hành động nào tự phát biểu nội dung pháp lý", () => {
    for (const hd of HANH_DONG_GOC) {
      for (const s of hd.speech) {
        if (s.loai === "loi_phap_ly") expect(s.citations?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  test("thay biến trong lời thoại, giữ nguyên biến chưa có giá trị", () => {
    expect(thayBien("Có {{so_the}} thẻ", { so_the: 6 })).toBe("Có 6 thẻ");
    expect(thayBien("Có {{so_the}} thẻ", {})).toBe("Có {{so_the}} thẻ");
  });
});

describe("đo hiệu quả", () => {
  test("người học tắt mascot quá nhiều thì hành động tự bị vô hiệu hoá", () => {
    const dg = danhGiaHanhDong({ hien: 200, bamCta: 20, dong: 30, tatMascot: 6 });
    expect(dg.nenTuTat).toBe(true);
  });

  test("dưới 30 lượt hiện thì không kết luận gì", () => {
    const dg = danhGiaHanhDong({ hien: 10, bamCta: 0, dong: 9, tatMascot: 3 });
    expect(dg.nenTuTat).toBe(false);
    expect(dg.canhBao).toEqual([]);
  });
});

describe("dựng hình SVG", () => {
  test("dựng được mọi tổ hợp nhân vật × trạng thái mà không ném lỗi", () => {
    let dem = 0;
    for (const nv of nhanVat) {
      for (const tt of TRANG_THAI) {
        const svg = veMascot({ persona: nv, state: tt, costume: chonTrangPhuc(nv) });
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg).toContain("</svg>");
        dem++;
      }
    }
    expect(dem).toBe(7 * 12);
  });

  test("dựng được mọi trang phục hợp lệ của từng nhân vật", () => {
    for (const nv of nhanVat) {
      for (const tp of nv.allowedCostumes) {
        expect(veMascot({ persona: nv, costume: tp })).toContain("</svg>");
      }
    }
  });

  test("có nhan đề đọc được bằng trình đọc màn hình", () => {
    const svg = veMascot({ persona: tim("muc_thuoc"), state: "vui" });
    expect(svg).toContain("<title");
    expect(svg).toContain("Mực Thước");
    expect(svg).toContain('role="img"');
  });

  test("chế độ tĩnh không sinh chuyển động nào", () => {
    const dong = veMascot({ persona: tim("muc_thuoc"), state: "an_mung" });
    const tinh = veMascot({ persona: tim("muc_thuoc"), state: "an_mung", tinh: true });
    expect(dong).toContain("animateTransform");
    expect(tinh).not.toContain("animate");
  });

  test("trạng thái khác nhau cho ra hình khác nhau", () => {
    const a = veMascot({ persona: tim("muc_thuoc"), state: "vui" });
    const b = veMascot({ persona: tim("muc_thuoc"), state: "canh_bao" });
    expect(a).not.toBe(b);
  });

  test("tên nhân vật được thoát ký tự, không chèn được thẻ lạ", () => {
    const doc = { ...tim("muc_thuoc"), fullName: "<script>x</script>" };
    expect(veMascot({ persona: doc })).not.toContain("<script>");
  });

  test("số trang phục và trạng thái đúng như thiết kế", () => {
    expect(TRANG_THAI).toHaveLength(12);
    expect(TRANG_PHUC).toHaveLength(10);
  });
});
