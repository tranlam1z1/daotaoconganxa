/**
 * Hỏi nhanh bằng giọng nói (docs/PLAN.md GĐ14, PRD #15). Máy đọc câu hỏi, người chơi bấm micro
 * và nói đáp án ("đáp án B", "đúng", hoặc đọc nội dung phương án). Không nghe rõ thì yêu cầu nói
 * lại, không đoán. Chạm vào đáp án vẫn được, để chơi ở nơi không tiện nói.
 *
 * Phiên luyện tập `game:hoi_nhanh_giong_noi`: kết thúc thì ghi kỷ lục và cộng XP một lần. Không tính
 * giờ.
 *
 * Trong lúc chơi KHÔNG báo đúng/sai: nói (hoặc chạm) đáp án thì đáp án được chọn, lưu tạm lên máy chủ
 * và tự sang câu sau (câu sau tự đọc khi hiện ra). Có "Câu trước"/"Câu sau" để quay lại sửa. Nộp bài
 * thì máy chủ mới chấm; xem lại đúng/sai từng câu ở trang kết quả của phiên.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Form, Link, useFetcher, useNavigation } from "react-router";

import { HienThiCauHoi } from "../components/cau-hoi/HienThiCauHoi";
import { ThanhGiongNoiCauHoi } from "../components/giong-noi/ThanhGiongNoiCauHoi";
import { chuanBiDocThanhTieng, loiDocCauHoi } from "../components/giong-noi/useDocThanhTieng";
import { coNhanDangGiong } from "../components/giong-noi/useNhanDangGiong";
import { coTraLoi, useLuuTam } from "../components/luyen-tap/useLuuTam";
import { HopXacNhanNop } from "../components/thi/HopXacNhanNop";
import { KhungGame } from "../components/tro-choi/KhungGame";
import { Button, ButtonLink } from "../components/ui/Button";
import { Notice } from "../components/ui/Field";
import { cn } from "../lib/cn";
import { ketThuc, layPhien } from "../lib/luyen-tap.server";
import type { DeCauHoi, TraLoiCauHoi } from "../lib/ngan-hang";
import { LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import { batDauHoiNhanh, kyLucHoiNhanh } from "../lib/tro-choi.server";
import type { Route } from "./+types/tro-choi.hoi-nhanh-giong-noi";

const TIEU_DE = "Hỏi nhanh bằng giọng nói";

export function meta(_: Route.MetaArgs) {
  return pageMeta(TIEU_DE, { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  return { kyLuc: await kyLucHoiNhanh(token) };
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  const f = await request.formData();
  const intent = String(f.get("intent") ?? "");
  const id = String(f.get("id") ?? "");
  try {
    if (intent === "bat-dau") {
      const bd = await batDauHoiNhanh(token);
      const phien = await layPhien(token, bd.id);
      return { batDau: { id: bd.id, cau: phien.cau.map((c) => ({ stt: c.stt, de: c.de })) } };
    }
    if (intent === "ket-thuc") {
      const kq = await ketThuc(token, id);
      return { ketThuc: kq.tro_choi?.ma === "hoi_nhanh_giong_noi" ? kq.tro_choi : null };
    }
    return { loi: "Thao tác không hợp lệ." };
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
}

type BatDau = { id: string; cau: Array<{ stt: number; de: DeCauHoi }> };

export default function HoiNhanhGiongNoi({ loaderData, actionData }: Route.ComponentProps) {
  const { kyLuc } = loaderData;
  const dangBatDau = useNavigation().state !== "idle";
  const batDau = actionData && "batDau" in actionData ? (actionData.batDau as BatDau) : null;
  const [coMicro, setCoMicro] = useState(true);
  useEffect(() => setCoMicro(coNhanDangGiong()), []);

  if (!batDau) {
    return (
      <KhungGame tieuDe={TIEU_DE}>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Máy đọc từng câu hỏi. Bấm nút micro rồi nói đáp án, ví dụ "đáp án B", "đúng", "sai", hoặc đọc nội
          dung phương án. Mỗi lượt 10 câu, không tính giờ.
        </p>
        {!coMicro ? (
          <Notice className="mt-4">
            Trình duyệt này chưa hỗ trợ nhận dạng giọng nói. Bạn vẫn chơi được bằng cách chạm vào đáp án. Để
            nói đáp án, hãy mở trang bằng Chrome hoặc Safari.
          </Notice>
        ) : null}
        <div className="mt-6 rounded-xl border border-line bg-surface p-5 text-center">
          <p className="text-sm text-ink-2">Kỷ lục của bạn</p>
          <p className="mt-1 text-4xl font-semibold">{kyLuc.ky_luc ?? "–"}</p>
          <p className="mt-1 text-sm text-ink-2">{kyLuc.so_van} lượt đã chơi</p>
        </div>
        {actionData && "loi" in actionData ? (
          <Notice tone="danger" className="mt-4">
            {actionData.loi}
          </Notice>
        ) : null}
        <Form method="post" className="mt-6">
          <input type="hidden" name="intent" value="bat-dau" />
          <Button type="submit" className="min-h-12 w-full text-base" disabled={dangBatDau}>
            Bắt đầu
          </Button>
        </Form>
      </KhungGame>
    );
  }
  // key theo id phiên: "Chơi lại" dựng lượt mới từ đầu.
  return <LuotChoi key={batDau.id} batDau={batDau} />;
}

/** Chọn xong một đáp án thì chờ chừng này rồi tự sang câu sau, để kịp thấy đáp án vừa chọn. */
const CHO_SANG_CAU_MS = 700;

function LuotChoi({ batDau }: { batDau: BatDau }) {
  const fKetThuc = useFetcher<typeof action>();
  const dangNop = fKetThuc.state !== "idle";
  const tong = batDau.cau.length;
  const [viTri, datViTri] = useState(0);
  const [traLoi, datTraLoi] = useState<Record<number, TraLoiCauHoi>>({});
  const [xong, datXong] = useState(false);
  const [moXacNhan, datMoXacNhan] = useState(false);
  const [chuaLuuHet, datChuaLuuHet] = useState(false);
  const henSangCau = useRef<number | null>(null);
  const cau = batDau.cau[viTri];
  const luuTam = useLuuTam(batDau.id, cau?.stt ?? 0);
  const daLam = useMemo(
    () =>
      new Set(
        Object.entries(traLoi)
          .filter(([, t]) => coTraLoi(t))
          .map(([k]) => Number(k)),
      ),
    [traLoi],
  );

  // Máy chủ đọc trước hai câu kế tiếp để khi chuyển câu là có tiếng ngay.
  useEffect(() => {
    chuanBiDocThanhTieng(batDau.cau.slice(viTri + 1, viTri + 3).map((c) => loiDocCauHoi(c.de)));
  }, [batDau, viTri]);

  // Rời lượt (chơi lại, sang trang khác) thì bỏ lần tự sang câu đang hẹn.
  useEffect(
    () => () => {
      if (henSangCau.current) window.clearTimeout(henSangCau.current);
    },
    [],
  );

  const denCau = (i: number) => {
    if (henSangCau.current) window.clearTimeout(henSangCau.current);
    henSangCau.current = null;
    void luuTam.guiHet();
    datViTri(i);
  };

  /** Chọn đáp án (nói hoặc chạm): lưu tạm, rồi tự sang câu sau nếu chưa phải câu cuối. */
  const chonDapAn = (id: string) => {
    if (!cau || dangNop) return;
    const t: TraLoiCauHoi = { chon: [id] };
    datTraLoi((cu) => ({ ...cu, [cau.stt]: t }));
    luuTam.doi(cau.stt, t);
    if (henSangCau.current) window.clearTimeout(henSangCau.current);
    henSangCau.current =
      viTri + 1 < tong ? window.setTimeout(() => denCau(viTri + 1), CHO_SANG_CAU_MS) : null;
  };

  const nop = async () => {
    if (!(await luuTam.guiHet())) {
      datChuaLuuHet(true);
      datMoXacNhan(false);
      return;
    }
    datChuaLuuHet(false);
    datMoXacNhan(false);
    datXong(true);
    fKetThuc.submit({ intent: "ket-thuc", id: batDau.id }, { method: "post" });
  };

  const kq = fKetThuc.data && "ketThuc" in fKetThuc.data ? fKetThuc.data.ketThuc : null;
  const loiNop = fKetThuc.data && "loi" in fKetThuc.data ? fKetThuc.data.loi : null;

  if (xong || !cau) {
    return (
      <KhungGame tieuDe={TIEU_DE}>
        <div className="rounded-xl border border-line bg-surface p-6 text-center" role="status">
          {loiNop ? (
            <Notice tone="danger">{loiNop}</Notice>
          ) : !kq ? (
            <p className="text-ink-2">Đang tính điểm.</p>
          ) : (
            <>
              <p className="text-sm text-ink-2">Số câu đúng</p>
              <p className="mt-1 text-5xl font-semibold">
                {kq.diem}/{kq.tong}
              </p>
              <p className={cn("mt-2 text-lg", kq.pha_ky_luc ? "font-semibold text-ok" : "text-ink-2")}>
                {kq.pha_ky_luc ? "Kỷ lục mới." : `Kỷ lục: ${kq.ky_luc}`}
              </p>
              {kq.xp > 0 ? <p className="mt-1 text-sm text-primary">+{kq.xp} XP</p> : null}
              <p className="mt-3">
                <Link
                  to={`/luyen-tap/${batDau.id}/ket-qua`}
                  className="inline-flex min-h-11 items-center font-medium text-primary underline"
                >
                  Xem lại từng câu
                </Link>
              </p>
            </>
          )}
        </div>
        <div className="mt-6 grid gap-3">
          <Form method="post">
            <input type="hidden" name="intent" value="bat-dau" />
            <Button type="submit" className="min-h-12 w-full text-base">
              Chơi lại
            </Button>
          </Form>
          <ButtonLink to="/tro-choi" variant="secondary" className="min-h-12 w-full text-base">
            Trò chơi khác
          </ButtonLink>
        </div>
      </KhungGame>
    );
  }

  const laCauCuoi = viTri + 1 >= tong;
  return (
    <KhungGame
      tieuDe={TIEU_DE}
      benPhai={
        <span className="text-sm font-semibold" aria-live="polite">
          Câu {viTri + 1}/{tong} · Đã làm {daLam.size}
        </span>
      }
    >
      <HienThiCauHoi
        key={cau.stt}
        de={cau.de}
        traLoi={traLoi[cau.stt] ?? {}}
        idGoc={`hoi-nhanh-${cau.stt}`}
        onChange={(t) => t.chon?.[0] && chonDapAn(t.chon[0])}
      />

      <div className="mt-4">
        <ThanhGiongNoiCauHoi key={cau.stt} de={cau.de} onChon={chonDapAn} tuDoc />
      </div>

      <div className="mt-2 min-h-6 text-center" aria-live="assertive">
        {luuTam.loi ? <Notice tone="danger">{luuTam.loi}</Notice> : null}
        {luuTam.trangThai === "loi" ? (
          <p className="text-sm font-semibold text-danger">Chưa lưu được câu trả lời, kiểm tra mạng.</p>
        ) : null}
        {chuaLuuHet ? (
          <Notice tone="danger">
            Chưa lưu được hết câu trả lời nên chưa nộp. Kiểm tra kết nối mạng rồi bấm "Nộp bài" lại.
          </Notice>
        ) : null}
      </div>

      <nav aria-label="Chuyển câu" className="mt-4 grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          className="g-nut min-h-12 text-base"
          disabled={viTri <= 0}
          onClick={() => denCau(viTri - 1)}
        >
          Câu trước
        </Button>
        {laCauCuoi ? (
          <Button className="g-nut min-h-12 text-base" onClick={() => datMoXacNhan(true)} disabled={dangNop}>
            Nộp bài
          </Button>
        ) : (
          <Button className="g-nut min-h-12 text-base" onClick={() => denCau(viTri + 1)}>
            Câu sau
          </Button>
        )}
      </nav>
      {!laCauCuoi ? (
        <Button
          variant="secondary"
          className="mt-3 min-h-12 w-full text-base"
          onClick={() => datMoXacNhan(true)}
          disabled={dangNop}
        >
          Nộp bài
        </Button>
      ) : null}

      <HopXacNhanNop
        mo={moXacNhan}
        soChuaLam={tong - daLam.size}
        dangNop={dangNop}
        onDong={() => datMoXacNhan(false)}
        onNop={() => void nop()}
      />
    </KhungGame>
  );
}
