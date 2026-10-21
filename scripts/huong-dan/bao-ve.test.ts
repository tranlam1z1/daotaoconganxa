import { describe, expect, test } from "bun:test";

import {
  type BaiHuongDan,
  dungKho,
  htmlBai,
  type MetaBai,
  timBaiChoTrang,
} from "../../apps/web/app/lib/huong-dan.ts";
import { danhGia } from "./bao-ve.ts";
import { docKho, docKhoa } from "./kho.ts";
import { dacDiemGiaoDien, docCayRoute, soSanhDacDiem } from "./nguon.ts";

const TRANG_MAU = `
export default function Trang() {
  const [mo, setMo] = useState<boolean>(false);
  return (
    <div className="p-4">
      {/* Nút mở bảng lọc */}
      <button type="button" onClick={() => setMo((v) => !v)} className="rounded">
        Lọc kết quả
      </button>
      <Link to="/tim-kiem" className="underline">Tra cứu</Link>
      <AsOfPicker value={x} />
    </div>
  );
}`;

describe("chữ ký giao diện", () => {
  test("ghi nhận nút, liên kết và thành phần con kèm nhãn tĩnh", () => {
    expect(dacDiemGiaoDien(TRANG_MAU)).toEqual([
      "<AsOfPicker>",
      'a to=/tim-kiem "Tra cứu"',
      'button type=button "Lọc kết quả"',
    ]);
  });

  test("đổi lớp CSS, comment hay logic không làm đổi chữ ký", () => {
    const sua = TRANG_MAU.replace('className="rounded"', 'className="rounded-lg px-3"')
      .replace("Nút mở bảng lọc", "Bảng lọc")
      .replace("!v", "v === false");
    expect(dacDiemGiaoDien(sua)).toEqual(dacDiemGiaoDien(TRANG_MAU));
  });

  test("thêm chức năng thì chữ ký đổi và chỉ ra đúng phần mới", () => {
    const them = TRANG_MAU.replace(
      "<AsOfPicker",
      '<button type="submit" aria-label="Xuất danh sách">Xuất</button>\n      <AsOfPicker',
    );
    const { them: moi, bot } = soSanhDacDiem(
      { "routes/x.tsx": dacDiemGiaoDien(TRANG_MAU) },
      { "routes/x.tsx": dacDiemGiaoDien(them) },
    );
    expect(moi).toEqual(['routes/x.tsx: button type=submit aria-label=Xuất danh sách "Xuất"']);
    expect(bot).toEqual([]);
  });

  test("không nhầm generic TypeScript hay phép so sánh là thẻ JSX", () => {
    const ma = "const a: Array<string> = []; const b = useState<boolean>(false); if (i < n) f<T>(x);";
    expect(dacDiemGiaoDien(ma)).toEqual([]);
  });
});

describe("dựng bài hướng dẫn", () => {
  const meta: MetaBai = {
    tieu_de: "Tra cứu",
    tom_tat: "Tìm văn bản.",
    routes: ["routes/search.tsx"],
    anh: [
      {
        ten: "tim-kiem-o-nhap",
        chu_thich: "Ô tìm kiếm",
        url: "/tim-kiem",
        danh_dau: [{ o: "#o", ghi_chu: "Nhập số ký hiệu" }],
      },
    ],
  };
  const kho = dungKho(
    {
      tieu_de: "HD",
      chuong: [{ id: "c", tieu_de: "C", bai: ["tim-kiem", "thieu"] }],
      khong_can_huong_dan: [],
    },
    { "tim-kiem": meta, khung: { ...meta, routes: ["routes/document.tsx"], anh: [] } },
    { "tim-kiem": "## Bước 1\n\n![Ô tìm kiếm](anh:tim-kiem-o-nhap)\n", khung: "" },
  );

  test("đánh số bài, báo bài thiếu tệp", () => {
    expect(kho.dsBai.map((b) => b.so)).toEqual(["1.1"]);
    expect(kho.thieu).toEqual(["thieu"]);
  });

  test("ảnh thành hình có số, chú thích và chú giải đánh số", () => {
    const html = htmlBai(kho.dsBai[0] as BaiHuongDan, { urlAnh: (t) => `/anh/${t}.png`, lechTieuDe: 1 });
    expect(html).toContain("<h3>Bước 1</h3>");
    expect(html).toContain('<img src="/anh/tim-kiem-o-nhap.png"');
    expect(html).toContain("Hình 1.1.1. Ô tìm kiếm");
    expect(html).toContain('<span class="hd-so" aria-hidden="true">1</span>');
    expect(html).not.toContain("hdhinh");
  });

  test("route lá được ưu tiên hơn route khung", () => {
    expect(timBaiChoTrang(kho, ["root", "routes/search"])?.id).toBe("tim-kiem");
    expect(timBaiChoTrang(kho, ["root", "routes/khac"])).toBeNull();
  });
});

describe("toàn vẹn tài liệu hướng dẫn trong kho mã", () => {
  test("mọi trang có giao diện đều có bài hướng dẫn hoặc được miễn", async () => {
    const { kho, baiCoTep } = docKho();
    const bc = danhGia(kho, baiCoTep, docKhoa(), await docCayRoute());
    expect(bc.routeChuaCo.map((r) => r.file)).toEqual([]);
  });

  test("mục lục, tệp bài và kịch bản chụp hình khớp nhau", async () => {
    const { kho, baiCoTep } = docKho();
    const bc = danhGia(kho, baiCoTep, docKhoa(), await docCayRoute());
    expect(bc.loiNoiDung).toEqual([]);
  });
});
