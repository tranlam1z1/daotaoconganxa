/**
 * Một lượt chơi trên khung trò chơi chung (docs/PLAN.md GĐ-G0): chơi từng bước, xem kết quả, xem
 * lại lượt đã xong.
 *
 * Mỗi bước: đề do máy chủ gửi (không có đáp án), đồng hồ theo thời gian còn lại máy chủ báo, nút
 * "Chốt đáp án". Máy chủ chấm; kết quả hiện trong hộp (GĐ17a: "Đúng"/"Chưa đúng", giải thích thu gọn
 * sau "Xem chi tiết", nút đi tiếp trong hộp). Đóng hộp thì đáy trang có "Xem lại kết quả" và nút đi
 * tiếp. Đề bước sau chỉ được lấy khi bấm "Câu tiếp", để đồng hồ của bước sau không chạy trong lúc
 * người chơi đọc kết quả. Vì vậy action trả lời KHÔNG làm tải lại loader (shouldRevalidate).
 *
 * Hiệu ứng theo docs/VISUAL_STYLE.md: màn mở đầu, thẻ câu trượt vào, phản hồi đúng/sai, rung ngang
 * khi sai, nhãn combo, lớp phủ hết giờ, màn kết quả có sao và điểm chạy số, lớp chúc mừng lên cấp và
 * huy hiệu. Chỉ đổi phần hiển thị; chấm điểm, XP vẫn hoàn toàn ở máy chủ.
 *
 * Trò có màn (GĐ-T1): màn mở đầu nêu tên màn; trò có giờ cả lượt hiện đồng hồ cả ca, hết giờ thì chốt
 * lượt; màn kết quả có nút chơi lại màn đó và chơi màn tiếp theo. Trò có thể tự đặt tên bước, nhãn nút,
 * ẩn nút "Chốt đáp án" (thao tác của trò là nộp) và có màn hướng dẫn trước lượt đầu tiên.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Form,
  Link,
  redirect,
  type ShouldRevalidateFunctionArgs,
  useFetcher,
  useNavigation,
  useSubmit,
} from "react-router";

import { ChiTietKetQua } from "../components/tro-choi/chung/ChiTietKetQua";
import { HopKetQuaCau, NutXemLaiKetQua } from "../components/tro-choi/chung/HopKetQuaCau";
import { HuongDan, NutCachChoi, useHuongDan } from "../components/tro-choi/chung/HuongDan";
import { DongHoBuoc } from "../components/tro-choi/DongHoBuoc";
import { chiTietRieng, giaoDienCua } from "../components/tro-choi/giao-dien";
import { DauMan } from "../components/tro-choi/hieu-ung/DauMan";
import { LopChucMung } from "../components/tro-choi/hieu-ung/LopChucMung";
import { NhanCombo } from "../components/tro-choi/hieu-ung/NhanCombo";
import { KhungGame } from "../components/tro-choi/KhungGame";
import { DongDiem } from "../components/tro-choi/PhanHoiBuoc";
import { DanhSachBuoc, TongKetLuot } from "../components/tro-choi/TongKetLuot";
import { Button, ButtonLink } from "../components/ui/Button";
import { Notice } from "../components/ui/Field";
import { cn } from "../lib/cn";
import type { TongQuanDiem } from "../lib/diem-thuong";
import { chuoiDung, huyHieuTrongLuot, vuaLenCap } from "../lib/hieu-ung";
import { dapAnNgan } from "../lib/ket-qua-cau";
import type { KetQuaBuocWeb, LuotChoiWeb } from "../lib/luot-choi";
import { batDauLuot, ketThucLuot, layLuot, traLoiBuoc } from "../lib/luot-choi.server";
import type { DeCauHoi, KetQuaCauHoi } from "../lib/ngan-hang";
import { goiApiQuanTri, khongTimThay, LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/tro-choi.luot";

export function meta({ data }: Route.MetaArgs) {
  return pageMeta(data?.luot.ten ?? "Lượt chơi", { index: false });
}

/** Lượt vừa xong trong khoảng này thì màn kết quả chạy hiệu ứng; mở lại sau đó thì hiện tĩnh. */
const VUA_XONG_MS = 60_000;

export async function loader({ request, params }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  const luot = await layLuot(token, params.id).catch(khongTimThay);
  const vuaXong = Boolean(luot.ket_thuc && Date.now() - Date.parse(luot.ket_thuc) < VUA_XONG_MS);
  // Lên cấp, huy hiệu mới: chỉ để chúc mừng, suy từ tổng quan điểm (máy chủ đã tính). Lỗi thì bỏ qua.
  let chucMung: { lenCap: { cap: number } | null; huyHieu: TongQuanDiem["huy_hieu"] } | null = null;
  if (vuaXong && (luot.tong_ket?.xp ?? 0) > 0) {
    const tq = await goiApiQuanTri<TongQuanDiem>(token, "/v1/toi/tong-quan").catch(() => null);
    if (tq) {
      const lenCap = vuaLenCap({
        xpTong: tq.xp_tong,
        xpLuot: luot.tong_ket!.xp,
        tuXpCapHienTai: tq.cap.tuXp,
        cap: tq.cap.cap,
      });
      const huyHieu = huyHieuTrongLuot(tq.huy_hieu, luot.ket_thuc);
      if (lenCap || huyHieu.length) chucMung = { lenCap: lenCap ? { cap: tq.cap.cap } : null, huyHieu };
    }
  }
  return { luot, vuaXong, chucMung };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  const f = await request.formData();
  const intent = f.get("intent");
  try {
    if (intent === "ket-thuc") {
      await ketThucLuot(token, params.id);
      return redirect(`/tro-choi/luot/${params.id}`);
    }
    if (intent === "choi-lai") {
      const man = Number(f.get("man")) || null;
      const moi = await batDauLuot(token, String(f.get("ma") ?? ""), man);
      return redirect(`/tro-choi/luot/${moi.id}`);
    }
    const thuTu = Number(f.get("thu_tu"));
    const kq = await traLoiBuoc(token, params.id, thuTu, JSON.parse(String(f.get("tra_loi") ?? "{}")));
    return { thuTu: kq.thu_tu, ketQua: kq.ket_qua, conBuoc: kq.con_buoc };
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message, thuTu: Number(f.get("thu_tu")) || null };
    throw err;
  }
}

/** Trả lời một bước không tải lại lượt: tải lại sẽ mở (và bắt đầu tính giờ) bước sau quá sớm. */
export function shouldRevalidate({ formData, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formData?.get("intent") === "tra-loi") return false;
  return defaultShouldRevalidate;
}

export default function LuotChoi({ loaderData }: Route.ComponentProps) {
  const { luot, vuaXong, chucMung } = loaderData;
  const gd = giaoDienCua(luot.ma);
  const busy = useNavigation().state !== "idle";
  // Lớp chúc mừng hiện sau khi sao và điểm chạy xong.
  const [hienChucMung, datHienChucMung] = useState(false);
  useEffect(() => {
    if (!chucMung) return;
    const t = setTimeout(() => datHienChucMung(true), 2200);
    return () => clearTimeout(t);
  }, [chucMung]);

  if (!gd) {
    return (
      <KhungGame tieuDe={luot.ten}>
        <Notice tone="danger">Trình duyệt chưa có giao diện cho trò chơi này. Hãy tải lại trang.</Notice>
      </KhungGame>
    );
  }

  if (luot.trang_thai !== "dang_choi" || !luot.buoc_hien_tai) {
    const daXong = luot.trang_thai !== "dang_choi";
    return (
      <KhungGame tieuDe={luot.ten}>
        {daXong && luot.man ? <p className="mb-3 text-center text-sm text-ink-2">{luot.man.ten}</p> : null}
        {daXong && luot.man && (luot.tong_ket?.sao ?? 0) === 0 ? (
          <p className="mb-3 text-center text-sm">Cần đạt từ 1 sao (50% điểm) để mở màn tiếp theo.</p>
        ) : null}
        {daXong ? (
          <TongKetLuot
            luot={luot}
            hoatAnh={vuaXong}
            hanhDong={
              <>
                {luot.man && (luot.tong_ket?.sao ?? 0) >= 1 && luot.man.so < luot.man.so_man ? (
                  <Form method="post" replace>
                    <input type="hidden" name="intent" value="choi-lai" />
                    <input type="hidden" name="ma" value={luot.ma} />
                    <input type="hidden" name="man" value={luot.man.so + 1} />
                    <Button type="submit" className="g-nut w-full" disabled={busy}>
                      Chơi màn {luot.man.so + 1}
                    </Button>
                  </Form>
                ) : null}
                <Form method="post" replace>
                  <input type="hidden" name="intent" value="choi-lai" />
                  <input type="hidden" name="ma" value={luot.ma} />
                  {luot.man ? <input type="hidden" name="man" value={luot.man.so} /> : null}
                  <Button
                    type="submit"
                    variant={
                      luot.man && (luot.tong_ket?.sao ?? 0) >= 1 && luot.man.so < luot.man.so_man
                        ? "secondary"
                        : "primary"
                    }
                    className="g-nut w-full"
                    disabled={busy}
                  >
                    {luot.man ? `Chơi lại màn ${luot.man.so}` : "Chơi lượt mới"}
                  </Button>
                </Form>
                <ButtonLink to="/tro-choi" variant="secondary" className="min-h-12 w-full text-base">
                  Về danh sách trò chơi
                </ButtonLink>
              </>
            }
          />
        ) : (
          // Đã trả lời hết bước nhưng chưa chốt kết quả (ví dụ tải lại trang đúng lúc đó).
          <Form method="post" replace>
            <input type="hidden" name="intent" value="ket-thuc" />
            <Button type="submit" className="min-h-12 w-full text-base" disabled={busy}>
              Xem kết quả
            </Button>
          </Form>
        )}
        {luot.da_choi.length ? (
          <section aria-labelledby="xem-lai" className="mt-8">
            <h2 id="xem-lai" className="font-sans text-lg font-semibold">
              Xem lại từng câu
            </h2>
            <div className="mt-3">
              <DanhSachBuoc
                luot={luot}
                chiTiet={(thuTu) => {
                  const b = luot.da_choi.find((x) => x.thu_tu === thuTu)!;
                  return (
                    <div className="space-y-3">
                      <gd.Buoc
                        de={b.de}
                        traLoi={b.tra_loi}
                        datTraLoi={() => {}}
                        chiTiet={b.ket_qua.chi_tiet}
                        daCham
                        idGoc={`xem-${thuTu}`}
                      />
                      <DongDiem kq={b.ket_qua} hoatAnh={false} />
                      <ChiTietKetQua ketQua={b.ket_qua} chiTietRieng={chiTietRieng(gd, b.de, b.ket_qua)} />
                    </div>
                  );
                }}
              />
            </div>
          </section>
        ) : null}
        {hienChucMung && chucMung ? (
          <LopChucMung
            lenCap={chucMung.lenCap}
            huyHieu={chucMung.huyHieu}
            dong={() => datHienChucMung(false)}
          />
        ) : null}
      </KhungGame>
    );
  }

  return <BuocDangChoi key={luot.buoc_hien_tai.thu_tu} luot={luot} />;
}

function BuocDangChoi({ luot }: { luot: LuotChoiWeb }) {
  const buoc = luot.buoc_hien_tai!;
  const gd = giaoDienCua(luot.ma)!;
  const fetcher = useFetcher<typeof action>();
  const busy = useNavigation().state !== "idle";
  const [traLoi, datTraLoi] = useState<unknown>(gd.traLoiRong);
  const traLoiRef = useRef(traLoi);
  traLoiRef.current = traLoi;

  const data = fetcher.data;
  const ketQua: KetQuaBuocWeb | null =
    data && "ketQua" in data && data.thuTu === buoc.thu_tu ? (data.ketQua as KetQuaBuocWeb) : null;
  const conBuoc = data && "conBuoc" in data ? data.conBuoc : true;
  const loi = data && "loi" in data ? data.loi : null;
  const dangGui = fetcher.state !== "idle";
  const [hetGio, datHetGio] = useState(false);
  const [hetCaLuot, datHetCaLuot] = useState(false);
  const moDau = buoc.thu_tu === 1 && luot.da_choi.length === 0;
  const huongDan = useHuongDan(luot.ma, Boolean(gd.huongDan) && moDau);
  const submit = useSubmit();
  // Hết giờ cả lượt: báo "Hết giờ" (hộp kết quả đóng), rồi chốt lượt sau khi qua dung sai của máy chủ.
  const hetCa = useCallback(() => {
    datHetGio(true);
    datHetCaLuot(true);
    setTimeout(() => submit({ intent: "ket-thuc" }, { method: "post", replace: true }), 2500);
  }, [submit]);

  // Hộp kết quả (GĐ17a): mở khi có kết quả; đóng bằng X/Esc thì đáy trang có "Xem lại kết quả" (H11).
  // Bước là một component riêng theo `key`, nên sang bước sau thì hộp đóng hẳn.
  const [daDongHop, datDaDongHop] = useState(false);
  const [lanMoHop, datLanMoHop] = useState(0);
  const [vuaDongHop, datVuaDongHop] = useState(false);
  const moHop = Boolean(ketQua) && !daDongHop && !hetCaLuot;
  const coDongHoCa =
    !(buoc.con_lai_ms !== null && buoc.thoi_gian_ms) &&
    luot.con_lai_luot_ms !== null &&
    Boolean(luot.ca_luot_ms);
  // Cùng mốc với đồng hồ cả lượt ở đầu trang (đề xuất Đ4).
  const [hetLuotLuc] = useState(() => (coDongHoCa ? Date.now() + luot.con_lai_luot_ms! : null));
  const dapAn =
    ketQua && luot.ma === "thu_nghiem" && (ketQua.chi_tiet as KetQuaCauHoi | null)?.dap_an
      ? dapAnNgan(buoc.de as DeCauHoi, ketQua.chi_tiet as KetQuaCauHoi)
      : null;
  const chuoi = chuoiDung([...luot.da_choi.map((b) => b.ket_qua.dung), ...(ketQua ? [ketQua.dung] : [])]);

  const gui = useCallback(
    (t: unknown) => {
      if (fetcher.state !== "idle") return;
      fetcher.submit(
        { intent: "tra-loi", thu_tu: String(buoc.thu_tu), tra_loi: JSON.stringify(t) },
        { method: "post" },
      );
    },
    [fetcher, buoc.thu_tu],
  );

  // Nút đi tiếp: trong hộp khi hộp mở, ở đáy trang khi hộp đã đóng.
  const nutDiTiep = conBuoc ? (
    // Đổi URL để loader lấy (và mở) bước sau đúng lúc người chơi sẵn sàng. `replace`: mỗi câu không
    // thêm một mục lịch sử, nên "Quay lại" sau lượt về thẳng trang trước khi chơi.
    <ButtonLink to={`/tro-choi/luot/${luot.id}?buoc=${buoc.thu_tu + 1}`} replace className="g-nut w-full">
      {gd.nutTiep ?? "Câu tiếp"}
    </ButtonLink>
  ) : (
    <Form method="post" replace>
      <input type="hidden" name="intent" value="ket-thuc" />
      <Button type="submit" className="g-nut w-full" disabled={busy}>
        Xem kết quả
      </Button>
    </Form>
  );

  return (
    <KhungGame
      tieuDe={luot.ten}
      benPhai={
        buoc.con_lai_ms !== null && buoc.thoi_gian_ms ? (
          <DongHoBuoc
            conLaiMs={buoc.con_lai_ms}
            tongMs={buoc.thoi_gian_ms}
            dung={Boolean(ketQua) || dangGui}
            onHet={() => {
              datHetGio(true);
              gui(traLoiRef.current);
            }}
          />
        ) : luot.con_lai_luot_ms !== null && luot.ca_luot_ms ? (
          <DongHoBuoc conLaiMs={luot.con_lai_luot_ms} tongMs={luot.ca_luot_ms} onHet={hetCa} phutGiay />
        ) : null
      }
    >
      {moDau ? <DauMan ten={luot.ten} moTa={moTaLuot(luot)} /> : null}
      <div className="flex min-h-8 items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          {gd.tenBuoc ?? "Câu"} {buoc.thu_tu}/{luot.so_buoc}
        </p>
        <span className="flex items-center gap-3">
          {gd.huongDan ? <NutCachChoi onClick={huongDan.moLai} /> : null}
          <NhanCombo n={chuoi} />
        </span>
      </div>
      <div className={cn("relative mt-4", moDau ? "g-a g-vao-len" : "g-a g-truot-vao")}>
        <div className={cn(ketQua && ketQua.dung !== true && !ketQua.het_gio && "g-t g-rung-ngang")}>
          <gd.Buoc
            de={buoc.de}
            traLoi={traLoi}
            datTraLoi={datTraLoi}
            chiTiet={ketQua?.chi_tiet}
            daCham={Boolean(ketQua)}
            idGoc={`buoc-${buoc.thu_tu}`}
            gui={gui}
          />
        </div>
        {hetGio ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
            <span
              className="g-t g-phu-do absolute inset-0 rounded-2xl"
              style={{ background: "var(--danger)", opacity: 0.12 }}
            />
            <span
              className="g-a g-bat g-tieu-de relative rounded-full px-4 py-2 text-lg font-bold"
              style={{ background: "var(--danger)", color: "var(--surface)" }}
            >
              Hết giờ
            </span>
          </div>
        ) : null}
      </div>

      {loi ? (
        <Notice tone="danger" className="mt-4">
          {loi}
        </Notice>
      ) : null}
      <div className="mt-6">
        {!ketQua ? (
          gd.anNutChot ? (
            dangGui ? (
              <p role="status" className="text-center text-sm text-ink-2">
                Đang chấm…
              </p>
            ) : null
          ) : (
            <Button
              className="g-nut w-full"
              disabled={dangGui || !gd.daChon(traLoi)}
              onClick={() => gui(traLoi)}
            >
              {dangGui ? "Đang chấm" : "Chốt đáp án"}
            </Button>
          )
        ) : moHop ? null : (
          <div className="grid gap-3">
            <NutXemLaiKetQua
              layTieuDiem={vuaDongHop}
              onClick={() => {
                datDaDongHop(false);
                datLanMoHop((n) => n + 1);
              }}
            />
            {nutDiTiep}
          </div>
        )}
      </div>
      {ketQua ? (
        <HopKetQuaCau
          mo={moHop}
          lanMo={lanMoHop}
          onDong={() => {
            datDaDongHop(true);
            datVuaDongHop(true);
          }}
          ketQua={ketQua}
          nutChinh={nutDiTiep}
          dapAn={dapAn}
          hetLuotLuc={hetLuotLuc}
          chiTietRieng={chiTietRieng(gd, buoc.de, ketQua)}
        />
      ) : null}

      <p className="mt-6 text-center text-sm">
        <Link to="/tro-choi" className="inline-flex min-h-11 items-center text-ink-2 underline">
          Về danh sách trò chơi (đồng hồ vẫn chạy)
        </Link>
      </p>
      {huongDan.mo && gd.huongDan ? (
        <HuongDan tieuDe={gd.huongDan.tieuDe} buoc={gd.huongDan.buoc} dong={huongDan.dong} />
      ) : null}
    </KhungGame>
  );
}

/** Dòng luật ngắn ở màn mở đầu: màn (trò có màn), hoặc số câu và thời gian mỗi câu. */
function moTaLuot(l: LuotChoiWeb): string {
  if (l.man) return `${l.man.ten}. ${l.man.mo_ta}`;
  const giay = l.buoc_hien_tai?.thoi_gian_ms ? Math.round(l.buoc_hien_tai.thoi_gian_ms / 1000) : null;
  return `${l.so_buoc} câu${giay ? ` · ${giay} giây mỗi câu` : ""}. Trả lời càng nhanh càng được thêm điểm.`;
}
