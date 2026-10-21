/**
 * Ô chọn căn cứ của dữ liệu tra cứu. Người soạn tìm văn bản trong kho theo số ký hiệu hoặc tên,
 * rồi bấm chọn Điều, khoản, điểm trong mục lục; ô hiện viện dẫn đọc được ("khoản 2 Điều 6 Nghị định
 * số 168/2024/NĐ-CP") kèm liên kết mở đúng điều khoản (QUY-TAC-HANH-VAN.md §6). Giá trị gửi đi vẫn
 * là URN. Văn bản chưa có trong kho thì bấm "Nhập URN thủ công".
 *
 * Dữ liệu tìm và mục lục lấy từ resource route routes/quan-tri.can-cu.tsx.
 */
import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";

import { DUONG_CAN_CU, type NutCanCu, tenKhoanDiem, type VanBanTimThay } from "../../lib/can-cu";
import { dieuHrefFromUrn, nhanVienDan, nodeUrn, parseUrn } from "../../lib/citation";
import { cn } from "../../lib/cn";
import type { DuLieuCanCu } from "../../routes/quan-tri.can-cu";
import { NodeStatusBadge, StatusBadge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input, inputClass } from "../ui/Field";

export function OCanCu({
  id,
  name,
  macDinh = "",
  batBuoc = false,
  khiDoi,
}: {
  id: string;
  /** Tên trường của biểu mẫu; bỏ trống khi trang chứa tự gom giá trị qua `khiDoi`. */
  name?: string;
  macDinh?: string;
  batBuoc?: boolean;
  khiDoi?: (urn: string) => void;
}) {
  const [urn, datUrn] = useState(macDinh);
  // URN có sẵn mà không đọc được thì mở ô gõ tay để người soạn thấy và sửa.
  const [thuCong, datThuCong] = useState(() => !!macDinh.trim() && !parseUrn(macDinh));
  const [moMucLuc, datMoMucLuc] = useState(false);
  const sach = urn.trim();
  const p = parseUrn(sach);
  const dat = (u: string) => {
    datUrn(u);
    khiDoi?.(u);
  };

  const doiCach = (
    <button
      type="button"
      onClick={() => {
        if (thuCong && !p) dat("");
        datThuCong(!thuCong);
      }}
      className="mt-1 inline-flex min-h-11 items-center text-sm text-primary underline md:min-h-0"
    >
      {thuCong ? "Tìm văn bản trong kho" : "Nhập URN thủ công"}
    </button>
  );

  if (thuCong) {
    return (
      <>
        <input
          id={id}
          name={name}
          value={urn}
          onChange={(e) => dat(e.target.value)}
          required={batBuoc}
          pattern="\s*vn:\S+\s*"
          placeholder="vn:vbqppl:nd:168/2024/NĐ-CP#dieu-6.khoan-2.diem-a"
          aria-describedby={sach ? `${id}-doc` : undefined}
          className={cn(inputClass, "min-h-11 font-mono text-sm")}
        />
        {sach ? (
          p ? (
            <p id={`${id}-doc`} className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-ink-2">
              <span className="min-w-0 break-words">{nhanVienDan(sach)}</span>
              <MoDieuKhoan urn={sach} />
            </p>
          ) : (
            <p id={`${id}-doc`} className="mt-1 text-sm text-danger">
              Căn cứ phải là URN dạng vn:...
            </p>
          )
        ) : null}
        {doiCach}
      </>
    );
  }

  if (!p) {
    return (
      <>
        <input type="hidden" name={name} value="" />
        <TimVanBan
          id={id}
          batBuoc={batBuoc}
          chon={(v) => {
            dat(v.urn);
            datMoMucLuc(v.coNoiDung);
          }}
        />
        {doiCach}
      </>
    );
  }

  const vanBan = `vn:${p.scheme}:${p.docType}:${p.soKyHieu}`;
  return (
    <>
      <input type="hidden" id={id} name={name} value={sach} />
      <div className="rounded-lg border border-line bg-surface p-3">
        <p className="break-words text-[15px] font-semibold">{nhanVienDan(sach)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={moMucLuc}
            onClick={() => datMoMucLuc(!moMucLuc)}
          >
            {moMucLuc ? "Thu gọn mục lục" : "Chọn điều, khoản, điểm"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              dat("");
              datMoMucLuc(false);
            }}
          >
            Đổi văn bản
          </Button>
          <MoDieuKhoan urn={sach} />
        </div>
        {moMucLuc ? (
          <MucLuc vanBan={vanBan} path={p.path ?? ""} chon={(path) => dat(nodeUrn(vanBan, path))} />
        ) : null}
      </div>
      {doiCach}
    </>
  );
}

function MoDieuKhoan({ urn }: { urn: string }) {
  return (
    <Link
      to={dieuHrefFromUrn(urn)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center text-sm text-primary underline md:min-h-0"
    >
      Mở điều khoản
    </Link>
  );
}

function TimVanBan({
  id,
  batBuoc,
  chon,
}: {
  id: string;
  batBuoc: boolean;
  chon: (v: VanBanTimThay) => void;
}) {
  const tim = useFetcher<DuLieuCanCu>();
  const { load } = tim;
  const [q, datQ] = useState("");
  const tu = q.trim();

  useEffect(() => {
    if (tu.length < 2) return;
    const t = setTimeout(() => load(`${DUONG_CAN_CU}?${new URLSearchParams({ q: tu })}`), 300);
    return () => clearTimeout(t);
  }, [tu, load]);

  const hien = tu.length >= 2 ? tim.data : undefined;
  const ketQua = hien && "items" in hien ? hien.items : [];

  return (
    <div>
      <Input
        id={id}
        type="search"
        autoComplete="off"
        value={q}
        onChange={(e) => datQ(e.target.value)}
        // Ô này chỉ hiện khi chưa chọn căn cứ: căn cứ bắt buộc thì chặn gửi biểu mẫu tại đây.
        ref={(o) => o?.setCustomValidity(batBuoc ? "Tìm rồi chọn một văn bản trong danh sách kết quả." : "")}
        onKeyDown={(e) => {
          // Enter trong ô tìm không được gửi cả biểu mẫu: chọn kết quả đầu tiên.
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (ketQua[0]) chon(ketQua[0]);
        }}
        placeholder="Tìm văn bản: số ký hiệu hoặc tên, ví dụ 168/2024"
        className="min-h-11"
      />
      <div aria-live="polite">
        {hien && "loi" in hien ? <p className="mt-2 text-sm text-danger">{hien.loi}</p> : null}
        {hien && "items" in hien && !ketQua.length && tim.state === "idle" ? (
          <p className="mt-2 text-sm text-ink-2">
            Không có văn bản nào khớp "{tu}" trong kho.{" "}
            <Link
              to="/quan-tri/van-ban/moi"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline"
            >
              Thêm văn bản vào kho
            </Link>{" "}
            hoặc nhập URN thủ công ở dưới.
          </p>
        ) : null}
      </div>
      {ketQua.length ? (
        <ul className="mt-2 grid gap-1 rounded-lg border border-line bg-surface p-1">
          {ketQua.map((v) => (
            <li key={v.urn}>
              <button
                type="button"
                onClick={() => chon(v)}
                className="flex min-h-11 w-full items-start gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{v.soKyHieu}</span> {v.title}
                  {!v.coNoiDung ? (
                    <span className="block text-ink-3">Chưa có nội dung số hóa: chỉ dẫn được cả văn bản</span>
                  ) : null}
                </span>
                <StatusBadge status={v.status} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Mục lục bấm chọn: điều đang chọn mở các khoản, khoản đang chọn mở các điểm. */
function MucLuc({
  vanBan,
  path,
  chon,
}: {
  vanBan: string;
  /** Path đang chọn, ví dụ "dieu-6.khoan-2"; rỗng là cả văn bản. */
  path: string;
  chon: (path: string) => void;
}) {
  const tai = useFetcher<DuLieuCanCu>();
  const { load, data } = tai;
  useEffect(() => {
    load(`${DUONG_CAN_CU}?${new URLSearchParams({ urn: vanBan })}`);
  }, [vanBan, load]);

  if (data && "loi" in data) {
    return <p className="mt-3 text-sm text-danger">Không tải được mục lục: {data.loi}</p>;
  }
  const dieu = data && "dieu" in data && data.urn === vanBan ? data.dieu : null;
  if (!dieu) return <p className="mt-3 text-sm text-ink-2">Đang tải mục lục…</p>;
  if (!dieu.length) {
    return (
      <p className="mt-3 text-sm text-ink-2">
        Văn bản chưa có nội dung số hóa nên chỉ dẫn được cả văn bản. Cần dẫn tới điều khoản thì nhập URN thủ
        công.
      </p>
    );
  }

  const trong = (nut: string) => path === nut || path.startsWith(`${nut}.`);
  return (
    <ul className="mt-3 max-h-[28rem] overflow-y-auto rounded-lg border border-line">
      <li>
        <Dong dangChon={!path} bam={() => chon("")}>
          <span className="font-semibold">Cả văn bản</span>
        </Dong>
      </li>
      {dieu.map((d, i) => (
        <li key={d.path}>
          {d.nhom && d.nhom !== dieu[i - 1]?.nhom ? (
            <p className="sticky top-0 z-10 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-2">
              {d.nhom}
            </p>
          ) : null}
          <Dong dangChon={path === d.path} bam={() => chon(d.path)}>
            <span className="font-semibold">{d.label}</span>
            {d.heading ? `. ${d.heading}` : ""} <NodeStatusBadge status={d.status} />
            {d.khoan.length && !trong(d.path) ? (
              <span className="text-ink-3"> ({d.khoan.length} khoản)</span>
            ) : null}
          </Dong>
          {trong(d.path) && d.khoan.length ? (
            <ul className="pl-4">
              {d.khoan.map((k) => (
                <li key={k.path}>
                  <DongKhoanDiem loai="Khoản" n={k} dangChon={path === k.path} chon={chon}>
                    {k.diem.length && !trong(k.path) ? (
                      <span className="text-ink-3"> ({k.diem.length} điểm)</span>
                    ) : null}
                  </DongKhoanDiem>
                  {trong(k.path) && k.diem.length ? (
                    <ul className="pl-4">
                      {k.diem.map((m) => (
                        <li key={m.path}>
                          <DongKhoanDiem loai="Điểm" n={m} dangChon={path === m.path} chon={chon} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function DongKhoanDiem({
  loai,
  n,
  dangChon,
  chon,
  children,
}: {
  loai: "Khoản" | "Điểm";
  n: NutCanCu;
  dangChon: boolean;
  chon: (path: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <Dong dangChon={dangChon} bam={() => chon(n.path)}>
      <span className="font-medium">{tenKhoanDiem(loai, n.label)}</span>{" "}
      <span className="text-ink-2">{n.tom}</span> <NodeStatusBadge status={n.status} />
      {children}
    </Dong>
  );
}

function Dong({
  dangChon,
  bam,
  children,
}: {
  dangChon: boolean;
  bam: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={dangChon}
      onClick={bam}
      className={cn(
        "block min-h-11 w-full border-l-2 border-transparent px-3 py-2 text-left text-sm hover:bg-surface-2",
        dangChon && "border-primary bg-primary-soft",
      )}
    >
      {children}
    </button>
  );
}
