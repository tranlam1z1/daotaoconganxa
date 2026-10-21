/**
 * Trình phát sách nói của một bài giảng (docs/PLAN.md GĐ14).
 *
 * Mỗi khối bài là một tệp MP3 do worker dựng sẵn; trình phát nối các tệp thành một dải thời gian
 * liền để tua trên cả bài. Tốc độ 1×, 1,25×, 1,5× nhớ trên máy. Vị trí nghe (khối và giây) lưu
 * lên máy chủ khi tạm dừng, khi đổi đoạn, mỗi 10 giây lúc đang nghe và khi rời trang, để mở lại
 * nghe tiếp đúng chỗ, kể cả trên thiết bị khác.
 *
 * Tệp tải về thành blob rồi mới phát: Safari trên iOS chỉ tua được tệp phát từ máy chủ có hỗ trợ
 * đọc theo khoảng byte, blob thì tua được ở mọi trình duyệt.
 *
 * Bài chưa có bản đọc (worker chưa chạy, máy chủ chưa cấu hình Vbee) thì không hiện gì.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../../lib/cn";
import { Icon } from "../ui/Icon";

const TOC_DO = [1, 1.25, 1.5] as const;
type TocDo = (typeof TOC_DO)[number];
const KHOA_TOC_DO = "qdpl-toc-do-sach-noi";
const CHU_KY_LUU_MS = 10_000;

interface KhoiAmThanh {
  block_id: string;
  giay: number;
}

function dinhDangGiay(s: number): string {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function docTocDo(): TocDo {
  try {
    const v = Number(window.localStorage.getItem(KHOA_TOC_DO));
    return (TOC_DO as readonly number[]).includes(v) ? (v as TocDo) : 1;
  } catch {
    return 1;
  }
}

export function TrinhPhatSachNoi({ baiId, khoiHien }: { baiId: string; khoiHien: string[] }) {
  const [ds, setDs] = useState<KhoiAmThanh[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [giayTrongKhoi, setGiayTrongKhoi] = useState(0);
  const [dangPhat, setDangPhat] = useState(false);
  const [dangTai, setDangTai] = useState(false);
  const [tocDo, setTocDo] = useState<TocDo>(1);
  const [ngheTiep, setNgheTiep] = useState<{ idx: number; giay: number } | null>(null);
  const [loi, setLoi] = useState<string | null>(null);

  const audio = useRef<HTMLAudioElement | null>(null);
  const blob = useRef(new Map<string, string>());
  const lanLuu = useRef(0);
  const trangThai = useRef({ idx: 0, ds: [] as KhoiAmThanh[] });
  trangThai.current = { idx, ds: ds ?? [] };

  const khoaHien = khoiHien.join(",");
  // Tải danh sách bản đọc, chỉ giữ khối đang hiện theo chế độ học của người đọc.
  // biome-ignore lint/correctness/useExhaustiveDependencies: khoaHien là dạng chuỗi của khoiHien
  useEffect(() => {
    let conGan = true;
    setTocDo(docTocDo());
    fetch(`/api/giong-doc/sach-noi/${baiId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { khoi: KhoiAmThanh[]; vi_tri: { block_id: string | null; giay: number } | null } | null) => {
        if (!conGan || !d) return;
        const hien = new Set(khoiHien);
        const loc = d.khoi.filter((k) => hien.has(k.block_id));
        setDs(loc);
        const i = d.vi_tri?.block_id ? loc.findIndex((k) => k.block_id === d.vi_tri!.block_id) : -1;
        if (i >= 0 && (i > 0 || d.vi_tri!.giay > 1)) {
          setIdx(i);
          setGiayTrongKhoi(d.vi_tri!.giay);
          setNgheTiep({ idx: i, giay: d.vi_tri!.giay });
        }
      })
      .catch(() => {});
    return () => {
      conGan = false;
    };
  }, [baiId, khoaHien]);

  const luuViTri = useCallback(
    (blockId: string | null, giay: number) => {
      lanLuu.current = Date.now();
      fetch(`/api/giong-doc/sach-noi/${baiId}/vi-tri`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ block_id: blockId, giay: Math.round(giay * 10) / 10 }),
        // Vẫn gửi được khi người dùng đang rời trang.
        keepalive: true,
      }).catch(() => {});
    },
    [baiId],
  );

  const taiKhoi = useCallback(
    async (blockId: string): Promise<string | null> => {
      const co = blob.current.get(blockId);
      if (co) return co;
      const res = await fetch(`/api/giong-doc/sach-noi/${baiId}/${blockId}`);
      if (!res.ok) return null;
      const url = URL.createObjectURL(await res.blob());
      blob.current.set(blockId, url);
      return url;
    },
    [baiId],
  );

  /** Phát khối `i` từ giây `tu`. */
  const phat = useCallback(
    async (i: number, tu: number) => {
      const danhSach = trangThai.current.ds;
      const k = danhSach[i];
      if (!k) return;
      const a = audio.current ?? new Audio();
      audio.current = a;
      setLoi(null);
      setNgheTiep(null);
      setIdx(i);
      setGiayTrongKhoi(tu);
      setDangTai(true);
      // Mốc lưu định kỳ tính từ lúc bắt đầu phát, không lưu ngay ở giây đầu.
      lanLuu.current = Date.now();
      try {
        const url = await taiKhoi(k.block_id);
        if (!url) {
          setLoi("Chưa tải được đoạn này. Hãy thử lại sau.");
          return;
        }
        if (a.src !== url) a.src = url;
        a.currentTime = tu;
        a.playbackRate = docTocDo();
        await a.play();
        // Tải trước đoạn kế tiếp để nối liền.
        const sau = danhSach[i + 1];
        if (sau) void taiKhoi(sau.block_id).catch(() => {});
      } catch {
        setLoi("Trình duyệt chưa phát được. Hãy bấm Nghe lần nữa.");
      } finally {
        setDangTai(false);
      }
    },
    [taiKhoi],
  );

  // Gắn sự kiện của thẻ âm thanh một lần.
  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    audio.current = a;
    const khiChay = () => {
      setGiayTrongKhoi(a.currentTime);
      if (!a.paused && Date.now() - lanLuu.current > CHU_KY_LUU_MS) {
        const k = trangThai.current.ds[trangThai.current.idx];
        if (k) luuViTri(k.block_id, a.currentTime);
      }
    };
    const khiPhat = () => setDangPhat(true);
    const khiDung = () => {
      setDangPhat(false);
      const k = trangThai.current.ds[trangThai.current.idx];
      if (k && !a.ended) luuViTri(k.block_id, a.currentTime);
    };
    const khiHet = () => {
      const { idx: i, ds: danhSach } = trangThai.current;
      if (i + 1 < danhSach.length) {
        void phat(i + 1, 0);
      } else {
        setDangPhat(false);
        setIdx(0);
        setGiayTrongKhoi(0);
        // Nghe hết bài: lần sau bắt đầu lại từ đầu.
        luuViTri(null, 0);
      }
    };
    a.addEventListener("timeupdate", khiChay);
    a.addEventListener("play", khiPhat);
    a.addEventListener("pause", khiDung);
    a.addEventListener("ended", khiHet);
    const boBlob = blob.current;
    return () => {
      a.removeEventListener("timeupdate", khiChay);
      a.removeEventListener("play", khiPhat);
      a.removeEventListener("pause", khiDung);
      a.removeEventListener("ended", khiHet);
      if (!a.paused) {
        const k = trangThai.current.ds[trangThai.current.idx];
        if (k) luuViTri(k.block_id, a.currentTime);
      }
      a.pause();
      for (const url of boBlob.values()) URL.revokeObjectURL(url);
      boBlob.clear();
    };
  }, [phat, luuViTri]);

  const moc = useMemo(() => {
    const m: number[] = [];
    let tong = 0;
    for (const k of ds ?? []) {
      m.push(tong);
      tong += k.giay;
    }
    return { batDau: m, tong };
  }, [ds]);

  if (!ds || ds.length === 0) return null;

  const hienTai = (moc.batDau[idx] ?? 0) + giayTrongKhoi;

  const tua = (giay: number) => {
    let i = moc.batDau.findIndex((b, j) => giay >= b && giay < b + (ds[j]?.giay ?? 0));
    if (i < 0) i = ds.length - 1;
    const trong = Math.max(0, giay - (moc.batDau[i] ?? 0));
    const a = audio.current;
    if (i === idx && a && a.src) {
      a.currentTime = trong;
      setGiayTrongKhoi(trong);
    } else if (dangPhat) {
      void phat(i, trong);
    } else {
      setIdx(i);
      setGiayTrongKhoi(trong);
      setNgheTiep(null);
      if (a) a.removeAttribute("src");
    }
  };

  const batTat = () => {
    const a = audio.current;
    if (dangPhat && a) {
      a.pause();
      return;
    }
    if (a?.src && a.currentTime > 0 && !a.ended) {
      a.playbackRate = tocDo;
      void a.play().catch(() => setLoi("Trình duyệt chưa phát được. Hãy bấm Nghe lần nữa."));
      return;
    }
    void phat(idx, giayTrongKhoi);
  };

  const doiTocDo = (t: TocDo) => {
    setTocDo(t);
    if (audio.current) audio.current.playbackRate = t;
    try {
      window.localStorage.setItem(KHOA_TOC_DO, String(t));
    } catch {
      // Không lưu được thì chỉ áp dụng cho lần nghe này.
    }
  };

  const nut =
    "grid size-11 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface dong-bam disabled:opacity-40";

  return (
    <section
      aria-labelledby="sach-noi"
      className="rounded-xl border border-line bg-surface p-3"
      data-sach-noi=""
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="sach-noi" className="font-sans text-base font-semibold">
          Sách nói
        </h2>
        <p className="text-sm tabular-nums text-ink-2">
          Đoạn {idx + 1}/{ds.length} · {dinhDangGiay(hienTai)} / {dinhDangGiay(moc.tong)}
        </p>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(1, Math.round(moc.tong))}
        step={1}
        value={Math.round(hienTai)}
        onChange={(e) => tua(Number(e.target.value))}
        aria-label="Tua sách nói"
        aria-valuetext={`${dinhDangGiay(hienTai)} trên ${dinhDangGiay(moc.tong)}`}
        className="mt-2 h-11 w-full accent-[var(--color-primary)]"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={nut}
            aria-label="Đoạn trước"
            disabled={idx === 0 && giayTrongKhoi < 2}
            onClick={() => tua(giayTrongKhoi > 2 ? (moc.batDau[idx] ?? 0) : (moc.batDau[idx - 1] ?? 0))}
          >
            <Icon name="doan-truoc" />
          </button>
          <button
            type="button"
            onClick={batTat}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-on-primary"
          >
            <Icon name={dangPhat ? "pause" : "play"} kieu="net" />
            {dangTai ? "Đang tải" : dangPhat ? "Tạm dừng" : ngheTiep ? "Nghe tiếp" : "Nghe"}
          </button>
          <button
            type="button"
            className={nut}
            aria-label="Đoạn sau"
            disabled={idx >= ds.length - 1}
            onClick={() => tua(moc.batDau[idx + 1] ?? 0)}
          >
            <Icon name="doan-sau" />
          </button>
        </div>

        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">Tốc độ đọc</legend>
          {TOC_DO.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tocDo === t}
              onClick={() => doiTocDo(t)}
              className={cn(
                "lun min-h-11 min-w-11 rounded-lg px-2 text-sm font-semibold tabular-nums",
                tocDo === t ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-surface-2",
              )}
            >
              {String(t).replace(".", ",")}×
            </button>
          ))}
        </fieldset>
      </div>

      <p aria-live="polite" className="min-h-5 text-sm">
        {loi ? (
          <span className="text-danger">{loi}</span>
        ) : ngheTiep ? (
          <span className="text-ink-2">
            Lần trước bạn nghe tới đoạn {ngheTiep.idx + 1}, phút {dinhDangGiay(ngheTiep.giay)}.
          </span>
        ) : null}
      </p>
    </section>
  );
}
