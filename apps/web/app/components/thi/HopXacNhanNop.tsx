import { Button } from "../ui/Button";
import { HopThoai } from "../ui/HopThoai";

/**
 * Hộp xác nhận nộp bài, ghi rõ số câu chưa làm. Dựng trên hộp thoại dùng chung `HopThoai`; là hộp
 * quan trọng nên bấm ra nền không đóng (vẫn đóng được bằng "Làm tiếp", nút X hoặc Esc).
 */
export function HopXacNhanNop({
  mo,
  soChuaLam,
  dangNop,
  onDong,
  onNop,
}: {
  mo: boolean;
  soChuaLam: number;
  dangNop: boolean;
  onDong: () => void;
  onNop: () => void;
}) {
  return (
    <HopThoai
      mo={mo}
      tieuDe="Nộp bài"
      onDong={onDong}
      quanTrong
      className="md:w-[min(92vw,26rem)]"
      hanhDong={
        <>
          <Button size="lg" variant="secondary" onClick={onDong} disabled={dangNop}>
            Làm tiếp
          </Button>
          <Button size="lg" onClick={onNop} disabled={dangNop}>
            {dangNop ? "Đang nộp" : "Nộp bài"}
          </Button>
        </>
      }
    >
      <p className="text-ink-2">
        {soChuaLam > 0
          ? `Còn ${soChuaLam} câu chưa trả lời; các câu này tính là sai.`
          : "Tất cả các câu đã có câu trả lời."}{" "}
        Sau khi nộp, không sửa được câu trả lời.
      </p>
    </HopThoai>
  );
}
