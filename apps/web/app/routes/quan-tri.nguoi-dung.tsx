/**
 * Người dùng (docs/PLAN.md GĐ2). Cán bộ quản lý xem người trong cây đơn vị của mình; quản trị
 * viên tạo, sửa, khóa, đặt lại mật khẩu và nhập danh sách từ Excel.
 *
 * Xác minh cán bộ (migration 0064): người tự đăng ký chờ duyệt. Quản trị viên duyệt mọi tài khoản;
 * cán bộ quản lý duyệt người khai đơn vị trong cây đơn vị của mình. Duyệt thì gắn đơn vị (mặc định
 * là đơn vị đã khai) và thành cán bộ; từ chối thì ghi lý do để người đăng ký sửa và gửi lại.
 *
 * Mật khẩu tạm (tạo mới, đặt lại, nhập Excel) chỉ hiện MỘT lần ngay sau thao tác: hệ thống chỉ
 * lưu bản băm nên không xem lại được.
 *
 * Bấm một dòng mở hộp thông tin chi tiết; quản trị viên sửa, khóa, đặt lại mật khẩu ngay trong hộp đó.
 */
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Form, Link, useFetcher, useNavigation, useSearchParams } from "react-router";

import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, inputClass, Label, Notice } from "../components/ui/Field";
import { HopThoai, useHop, VungNutHop } from "../components/ui/HopThoai";
import { Icon } from "../components/ui/Icon";
import { formatDate } from "../lib/format";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { duVaiTro, yeuCauVaiTro } from "../lib/session.server";
import { pageMeta } from "../lib/site";

import type { Route } from "./+types/quan-tri.nguoi-dung";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Người dùng", { index: false });
}

interface NguoiDungHang {
  id: string;
  username: string | null;
  email: string | null;
  name: string | null;
  role: string;
  enabled: boolean;
  unit_id: string | null;
  unit_code: string | null;
  unit_name: string | null;
  rank_title: string | null;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  xac_minh: "cho_duyet" | "da_xac_minh" | "tu_choi";
  so_hieu: string | null;
  phone: string | null;
  don_vi_khai: string | null;
  don_vi_khai_name: string | null;
  xac_minh_ly_do: string | null;
}

interface DonVi {
  id: string;
  code: string;
  name: string;
  cap: number;
}

interface KetQuaNhap {
  chayThu: boolean;
  tongDong: number;
  taoMoi: Array<{
    dong: number;
    username: string;
    name: string;
    role: string;
    donVi: string;
    matKhauTam?: string;
  }>;
  loi: Array<{ dong: number; loi: string }>;
}

const TEN_VAI_TRO: Record<string, string> = {
  khach: "Khách",
  can_bo: "Cán bộ",
  tra_cuu: "Người tra cứu",
  quan_ly: "Cán bộ quản lý",
  bien_tap: "Biên tập viên",
  phap_che: "Pháp chế",
  quan_tri: "Quản trị viên",
};

const MOI_TRANG = 50;

export async function loader({ request }: Route.LoaderArgs) {
  const { token, nguoiDung } = await yeuCauVaiTro(request, "quan_ly");
  const p = new URL(request.url).searchParams;
  const qs = new URLSearchParams({ gioi_han: String(MOI_TRANG), trang: p.get("trang") ?? "1" });
  if (p.get("don_vi")) qs.set("don_vi", p.get("don_vi") as string);
  if (p.get("q")) qs.set("q", p.get("q") as string);
  if (p.get("xac_minh")) qs.set("xac_minh", p.get("xac_minh") as string);
  const [ds, dv] = await Promise.all([
    goiApiQuanTri<{ items: NguoiDungHang[]; total: number; trang: number; so_cho_xac_minh: number }>(
      token,
      `/v1/quan-tri/nguoi-dung?${qs}`,
    ),
    goiApiQuanTri<{ items: DonVi[] }>(token, "/v1/quan-tri/don-vi"),
  ]);
  return { ...ds, donVi: dv.items, laQuanTri: nguoiDung.la_quan_tri, toi: nguoiDung.ten_dang_nhap ?? null };
}

type KetQuaThaoTac =
  | { loi: string }
  | { ok: string; matKhau?: { username: string; matKhau: string } }
  | { nhap: KetQuaNhap };

export async function action({ request }: Route.ActionArgs): Promise<KetQuaThaoTac> {
  const { token, nguoiDung } = await yeuCauVaiTro(request, "quan_ly");
  const f = await request.formData();
  const chuoi = (k: string) => String(f.get(k) ?? "").trim();
  const intent = chuoi("intent");
  try {
    // Duyệt và từ chối xác minh: cán bộ quản lý trở lên (API kiểm phạm vi đơn vị).
    if (intent === "duyet" || intent === "tu-choi") {
      await goiApiQuanTri(token, `/v1/quan-tri/nguoi-dung/${chuoi("id")}/xac-minh`, {
        method: "POST",
        body:
          intent === "duyet"
            ? { duyet: true, unitId: chuoi("unitId") || undefined }
            : { duyet: false, ly_do: chuoi("ly_do") },
      });
      return {
        ok:
          intent === "duyet"
            ? `Đã xác minh ${chuoi("ten")}. Tài khoản đã thành cán bộ của đơn vị đã chọn.`
            : `Đã từ chối xác minh ${chuoi("ten")}. Người đăng ký thấy lý do và có thể gửi lại.`,
      };
    }
    // Các thao tác còn lại chỉ quản trị viên.
    if (!duVaiTro(nguoiDung, "quan_tri")) return { loi: "Chỉ quản trị viên làm được thao tác này." };
    if (intent === "nhap") {
      const tep = f.get("tep");
      if (!(tep instanceof File) || tep.size === 0) return { loi: "Chọn tệp Excel (.xlsx) theo mẫu." };
      const gui = new FormData();
      gui.set("tep", tep);
      if (f.get("chay_thu") === "on") gui.set("chay_thu", "1");
      return { nhap: await goiApiQuanTri<KetQuaNhap>(token, "/v1/quan-tri/nguoi-dung/nhap", { form: gui }) };
    }
    if (intent === "tao") {
      const kq = await goiApiQuanTri<{ item: NguoiDungHang; mat_khau_tam: string }>(
        token,
        "/v1/quan-tri/nguoi-dung",
        {
          body: {
            username: chuoi("username"),
            name: chuoi("name"),
            role: chuoi("role") || "can_bo",
            unitId: chuoi("unitId") || null,
            rankTitle: chuoi("rankTitle") || null,
            email: chuoi("email") || null,
          },
        },
      );
      return {
        ok: `Đã tạo tài khoản ${kq.item.username}.`,
        matKhau: { username: kq.item.username ?? "", matKhau: kq.mat_khau_tam },
      };
    }
    const id = chuoi("id");
    if (intent === "dat-lai") {
      const kq = await goiApiQuanTri<{ mat_khau_tam: string }>(
        token,
        `/v1/quan-tri/nguoi-dung/${id}/dat-lai-mat-khau`,
        {
          method: "POST",
        },
      );
      return {
        ok: `Đã đặt lại mật khẩu cho ${chuoi("ten")}. Mọi phiên đăng nhập cũ của tài khoản đã bị thu hồi.`,
        matKhau: { username: chuoi("ten"), matKhau: kq.mat_khau_tam },
      };
    }
    if (intent === "khoa" || intent === "mo") {
      await goiApiQuanTri(token, `/v1/quan-tri/nguoi-dung/${id}`, {
        method: "PATCH",
        body: { enabled: intent === "mo" },
      });
      return {
        ok:
          intent === "khoa" ? `Đã khóa tài khoản ${chuoi("ten")}.` : `Đã mở khóa tài khoản ${chuoi("ten")}.`,
      };
    }
    if (intent === "sua") {
      await goiApiQuanTri(token, `/v1/quan-tri/nguoi-dung/${id}`, {
        method: "PATCH",
        body: {
          name: chuoi("name") || undefined,
          role: chuoi("role"),
          unitId: chuoi("unitId") || null,
          rankTitle: chuoi("rankTitle") || null,
        },
      });
      return { ok: `Đã lưu tài khoản ${chuoi("ten")}.` };
    }
    return { loi: "Thao tác không hợp lệ." };
  } catch (e) {
    if (e instanceof LoiApi) return { loi: e.message };
    throw e;
  }
}

function ChonDonVi({
  id,
  donVi,
  macDinh,
  tatCa,
}: {
  id: string;
  donVi: DonVi[];
  macDinh?: string | null;
  tatCa?: string;
}) {
  const capGoc = Math.min(...donVi.map((d) => d.cap), 1);
  return (
    <select id={id} name={tatCa ? "don_vi" : "unitId"} defaultValue={macDinh ?? ""} className={inputClass}>
      <option value="">{tatCa ?? "Chưa gắn đơn vị"}</option>
      {donVi.map((d) => (
        <option key={d.id} value={d.id}>
          {"· ".repeat(d.cap - capGoc)}
          {d.name}
        </option>
      ))}
    </select>
  );
}

function ChonVaiTro({ id, macDinh }: { id: string; macDinh?: string }) {
  return (
    <select id={id} name="role" defaultValue={macDinh ?? "can_bo"} className={inputClass}>
      {Object.entries(TEN_VAI_TRO).map(([ma, ten]) => (
        <option key={ma} value={ma}>
          {ten}
        </option>
      ))}
    </select>
  );
}

/**
 * Thông tin người đăng ký đã khai và hai nút Duyệt, Từ chối. Đơn vị gắn khi duyệt mặc định là đơn vị
 * đã khai; danh sách chỉ gồm đơn vị trong phạm vi của người duyệt.
 */
function XetXacMinh({
  u,
  ten,
  donVi,
  busy,
}: {
  u: NguoiDungHang;
  ten: string;
  donVi: DonVi[];
  busy: boolean;
}) {
  return (
    <div className="mt-2 rounded-lg border border-line bg-surface-2 p-3">
      <dl className="grid gap-x-4 gap-y-1 text-sm [overflow-wrap:anywhere] sm:grid-cols-[9rem_1fr]">
        <dt className="text-ink-3">Số hiệu CAND</dt>
        <dd className="font-mono font-medium">{u.so_hieu ?? "Chưa khai"}</dd>
        <dt className="text-ink-3">Đơn vị đã khai</dt>
        <dd className="font-medium">{u.don_vi_khai_name ?? "Chưa khai"}</dd>
        {u.rank_title ? (
          <>
            <dt className="text-ink-3">Cấp bậc, chức vụ</dt>
            <dd>{u.rank_title}</dd>
          </>
        ) : null}
        {u.phone ? (
          <>
            <dt className="text-ink-3">Số điện thoại</dt>
            <dd>
              <a href={`tel:${u.phone}`} className="underline">
                {u.phone}
              </a>
            </dd>
          </>
        ) : null}
        <dt className="text-ink-3">Ngày đăng ký</dt>
        <dd>{formatDate(u.created_at)}</dd>
        {u.xac_minh === "tu_choi" && u.xac_minh_ly_do ? (
          <>
            <dt className="text-ink-3">Lý do đã từ chối</dt>
            <dd className="text-danger">{u.xac_minh_ly_do}</dd>
          </>
        ) : null}
      </dl>
      <p className="mt-2 text-xs text-ink-3">
        Đối chiếu họ tên, số hiệu và đơn vị với danh sách cán bộ của đơn vị (hoặc gọi điện xác nhận) trước khi
        duyệt.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Form method="post" className="flex flex-col gap-2">
          <input type="hidden" name="intent" value="duyet" />
          <input type="hidden" name="id" value={u.id} />
          <input type="hidden" name="ten" value={ten} />
          <Label htmlFor={`duyet-dv-${u.id}`}>Gắn vào đơn vị</Label>
          <ChonDonVi id={`duyet-dv-${u.id}`} donVi={donVi} macDinh={u.don_vi_khai} />
          <Button type="submit" disabled={busy}>
            Duyệt, xác minh là cán bộ
          </Button>
        </Form>
        <Form method="post" className="flex flex-col gap-2">
          <input type="hidden" name="intent" value="tu-choi" />
          <input type="hidden" name="id" value={u.id} />
          <input type="hidden" name="ten" value={ten} />
          <Label htmlFor={`ly-do-${u.id}`}>Lý do từ chối</Label>
          <Input
            id={`ly-do-${u.id}`}
            name="ly_do"
            required
            maxLength={500}
            placeholder="Ví dụ: số hiệu không khớp danh sách đơn vị"
          />
          <Button type="submit" variant="secondary" disabled={busy}>
            Từ chối
          </Button>
        </Form>
      </div>
    </div>
  );
}

function KetQuaNhapExcel({ kq }: { kq: KetQuaNhap }) {
  return (
    <div className="mt-4 rounded-xl border border-line bg-surface p-4">
      <h3 className="font-sans text-base font-semibold">
        {kq.chayThu ? "Kết quả chạy thử (chưa ghi gì)" : "Kết quả nhập"}: {kq.taoMoi.length}/{kq.tongDong}{" "}
        dòng hợp lệ, {kq.loi.length} dòng lỗi
      </h3>
      {kq.loi.length ? (
        <ul className="mt-3 space-y-1 text-sm text-danger">
          {kq.loi.map((l) => (
            <li key={l.dong}>
              Dòng {l.dong}: {l.loi}
            </li>
          ))}
        </ul>
      ) : null}
      {kq.taoMoi.length ? (
        <>
          {!kq.chayThu ? (
            <Notice className="mt-3">
              Mật khẩu tạm chỉ hiện một lần. In hoặc chép danh sách này để giao cho từng người trước khi rời
              trang.
            </Notice>
          ) : null}
          <div className="bang-cuon mt-3">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-ink-3">
                <tr>
                  <th className="py-2 pr-3 font-medium">Dòng</th>
                  <th className="py-2 pr-3 font-medium">Họ và tên</th>
                  <th className="py-2 pr-3 font-medium">Tên đăng nhập</th>
                  <th className="py-2 pr-3 font-medium">Đơn vị</th>
                  {!kq.chayThu ? <th className="py-2 font-medium">Mật khẩu tạm</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {kq.taoMoi.map((t) => (
                  <tr key={t.username}>
                    <td className="py-2 pr-3">{t.dong}</td>
                    <td className="py-2 pr-3">{t.name}</td>
                    <td className="py-2 pr-3 font-mono">{t.username}</td>
                    <td className="py-2 pr-3">{t.donVi}</td>
                    {!kq.chayThu ? <td className="py-2 font-mono">{t.matKhauTam}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!kq.chayThu ? (
            <Button variant="secondary" className="no-print mt-3" onClick={() => window.print()}>
              In danh sách
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const XAC_MINH: Record<NguoiDungHang["xac_minh"], { nhan: string; tone: "ok" | "warn" | "danger" }> = {
  da_xac_minh: { nhan: "Đã xác minh", tone: "ok" },
  cho_duyet: { nhan: "Chờ xác minh", tone: "warn" },
  tu_choi: { nhan: "Đã từ chối xác minh", tone: "danger" },
};

/** Fetcher gửi thao tác từ trong hộp: xong thì báo kết quả cho trang, lỗi thì hiện ngay trong hộp. */
function useThaoTacHop(onXong: (kq: KetQuaThaoTac) => void) {
  const f = useFetcher<typeof action>();
  useEffect(() => {
    if (f.state === "idle" && f.data && "ok" in f.data) onXong(f.data);
  }, [f.state, f.data, onXong]);
  return { f, dangGui: f.state !== "idle", loi: f.data && "loi" in f.data ? f.data.loi : null };
}

/** Các trường của biểu mẫu thêm (không có `u`) và sửa; tên đăng nhập, email chỉ nhập khi thêm. */
function TruongNguoiDung({ u, donVi }: { u?: NguoiDungHang; donVi: DonVi[] }) {
  const id = u?.id ?? "moi";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor={`ten-${id}`}>Họ và tên</Label>
        <Input id={`ten-${id}`} name="name" required={!u} defaultValue={u?.name ?? ""} />
      </div>
      {u ? null : (
        <div>
          <Label htmlFor="moi-tdn">Tên đăng nhập</Label>
          <Input id="moi-tdn" name="username" required autoCapitalize="none" spellCheck={false} />
        </div>
      )}
      <div>
        <Label htmlFor={`dv-${id}`}>Đơn vị</Label>
        <ChonDonVi id={`dv-${id}`} donVi={donVi} macDinh={u?.unit_id} />
      </div>
      <div>
        <Label htmlFor={`vt-${id}`}>Vai trò</Label>
        <ChonVaiTro id={`vt-${id}`} macDinh={u?.role} />
      </div>
      <div>
        <Label htmlFor={`cb-${id}`}>Cấp bậc, chức vụ</Label>
        <Input id={`cb-${id}`} name="rankTitle" defaultValue={u?.rank_title ?? ""} />
      </div>
      {u ? null : (
        <div>
          <Label htmlFor="moi-email">Email (không bắt buộc)</Label>
          <Input id="moi-email" name="email" type="email" />
        </div>
      )}
    </div>
  );
}

function BieuMauThem({ donVi, onXong }: { donVi: DonVi[]; onXong: (kq: KetQuaThaoTac) => void }) {
  const { f, dangGui, loi } = useThaoTacHop(onXong);
  return (
    <f.Form method="post">
      <input type="hidden" name="intent" value="tao" />
      <TruongNguoiDung donVi={donVi} />
      <p className="mt-3 text-sm text-ink-3">Hệ thống cấp mật khẩu tạm, hiện một lần ngay sau khi tạo.</p>
      {loi ? (
        <Notice tone="danger" className="mt-3">
          {loi}
        </Notice>
      ) : null}
      <VungNutHop className="mt-4">
        <Button type="submit" disabled={dangGui}>
          {dangGui ? "Đang tạo" : "Tạo tài khoản"}
        </Button>
      </VungNutHop>
    </f.Form>
  );
}

function Dong({ nhan, children }: { nhan: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-3">{nhan}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

/**
 * Nội dung hộp chi tiết một tài khoản. `duocSua` (quản trị viên, không phải chính mình) thì có nút
 * sửa, đặt lại mật khẩu, khóa hoặc mở khóa.
 */
function ChiTietNguoiDung({
  u,
  donVi,
  duocSua,
  onXong,
}: {
  u: NguoiDungHang;
  donVi: DonVi[];
  duocSua: boolean;
  onXong: (kq: KetQuaThaoTac) => void;
}) {
  const { f, dangGui, loi } = useThaoTacHop(onXong);
  const [sua, datSua] = useState(false);
  const ten = u.username ?? u.email ?? "";
  const gui = (intent: string) => f.submit({ intent, id: u.id, ten }, { method: "post" });
  const baoLoi = loi ? (
    <Notice tone="danger" className="mt-3">
      {loi}
    </Notice>
  ) : null;

  if (sua) {
    return (
      <f.Form method="post">
        <input type="hidden" name="intent" value="sua" />
        <input type="hidden" name="id" value={u.id} />
        <input type="hidden" name="ten" value={ten} />
        <TruongNguoiDung u={u} donVi={donVi} />
        {baoLoi}
        <VungNutHop className="mt-4">
          <Button variant="secondary" onClick={() => datSua(false)} disabled={dangGui}>
            Hủy
          </Button>
          <Button type="submit" disabled={dangGui}>
            {dangGui ? "Đang lưu" : "Lưu thay đổi"}
          </Button>
        </VungNutHop>
      </f.Form>
    );
  }

  return (
    <>
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[9rem_1fr]">
        <Dong nhan="Tên đăng nhập">
          <span className="font-mono font-medium">{u.username ?? "Không có"}</span>
        </Dong>
        {u.email ? <Dong nhan="Email">{u.email}</Dong> : null}
        <Dong nhan="Vai trò">{TEN_VAI_TRO[u.role] ?? u.role}</Dong>
        <Dong nhan="Đơn vị">
          {u.unit_name ? `${u.unit_name}${u.unit_code ? ` (${u.unit_code})` : ""}` : "Chưa gắn đơn vị"}
        </Dong>
        {u.rank_title ? <Dong nhan="Cấp bậc, chức vụ">{u.rank_title}</Dong> : null}
        {u.so_hieu ? (
          <Dong nhan="Số hiệu CAND">
            <span className="font-mono">{u.so_hieu}</span>
          </Dong>
        ) : null}
        {u.phone ? (
          <Dong nhan="Số điện thoại">
            <a href={`tel:${u.phone}`} className="underline">
              {u.phone}
            </a>
          </Dong>
        ) : null}
        <Dong nhan="Trạng thái">
          <Badge tone={u.enabled ? "ok" : "danger"}>{u.enabled ? "Đang hoạt động" : "Đã khóa"}</Badge>
        </Dong>
        <Dong nhan="Xác minh">
          <Badge tone={XAC_MINH[u.xac_minh].tone}>{XAC_MINH[u.xac_minh].nhan}</Badge>
          {u.xac_minh === "tu_choi" && u.xac_minh_ly_do ? (
            <span className="mt-1 block text-danger">{u.xac_minh_ly_do}</span>
          ) : null}
        </Dong>
        {u.must_change_password ? <Dong nhan="Mật khẩu">Chưa đổi mật khẩu tạm</Dong> : null}
        <Dong nhan="Đăng nhập gần nhất">
          {u.last_login_at ? formatDate(u.last_login_at) : "Chưa đăng nhập"}
        </Dong>
        <Dong nhan="Ngày tạo">{formatDate(u.created_at)}</Dong>
      </dl>
      {baoLoi}
      {duocSua ? (
        <VungNutHop className="mt-4 sm:flex-wrap">
          <Button variant="ghost" onClick={() => gui(u.enabled ? "khoa" : "mo")} disabled={dangGui}>
            {u.enabled ? "Khóa tài khoản" : "Mở khóa tài khoản"}
          </Button>
          {u.username ? (
            <Button variant="ghost" onClick={() => gui("dat-lai")} disabled={dangGui}>
              Đặt lại mật khẩu
            </Button>
          ) : null}
          <Button onClick={() => datSua(true)} disabled={dangGui}>
            Sửa thông tin
          </Button>
        </VungNutHop>
      ) : null}
    </>
  );
}

export default function QuanTriNguoiDung({ loaderData, actionData }: Route.ComponentProps) {
  const { items, total, trang, donVi, laQuanTri, toi, so_cho_xac_minh: soChoXacMinh } = loaderData;
  const [params] = useSearchParams();
  const busy = useNavigation().state !== "idle";
  const hop = useHop<"them" | "chiTiet", string>();
  // Kết quả thao tác gửi từ trong hộp (fetcher không đổi actionData). Điều hướng mới thì bỏ để
  // actionData của biểu mẫu trên trang hiện ra.
  const [ketQuaHop, datKetQuaHop] = useState<KetQuaThaoTac | null>(null);
  useEffect(() => {
    if (busy) datKetQuaHop(null);
  }, [busy]);
  const ketQua = ketQuaHop ?? actionData;
  const dangXem = hop.la("chiTiet") ? items.find((u) => u.id === hop.duLieu) : undefined;
  const xong = (kq: KetQuaThaoTac) => {
    datKetQuaHop(kq);
    hop.dong();
  };
  // Thông báo kèm mật khẩu tạm hiện ngay dưới dòng của tài khoản đó; tài khoản không nằm trong trang
  // danh sách đang xem thì hiện ở đầu trang.
  const tenCoMatKhau = ketQua && "ok" in ketQua ? ketQua.matKhau?.username : undefined;
  const baoTaiDong = Boolean(tenCoMatKhau) && items.some((u) => u.username === tenCoMatKhau);
  const thongBaoOk =
    ketQua && "ok" in ketQua ? (
      <Notice>
        {ketQua.ok}
        {ketQua.matKhau ? (
          <span className="mt-2 block">
            Mật khẩu tạm của <strong>{ketQua.matKhau.username}</strong>:{" "}
            <span className="font-mono text-base font-semibold">{ketQua.matKhau.matKhau}</span>. Mật khẩu chỉ
            hiện một lần; người dùng phải đổi ở lần đăng nhập đầu.
          </span>
        ) : null}
      </Notice>
    ) : null;
  // Mật khẩu tạm chỉ hiện một lần nên phải cuộn tới chỗ thông báo, danh sách có thể đang cuộn xa.
  const refBaoTaiDong = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ketQuaHop) return;
    if (refBaoTaiDong.current) refBaoTaiDong.current.scrollIntoView({ block: "nearest" });
    else window.scrollTo({ top: 0 });
  }, [ketQuaHop]);

  const trangHref = (so: number) => {
    const next = new URLSearchParams(params);
    next.set("trang", String(so));
    return `/quan-tri/nguoi-dung?${next}`;
  };

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">Người dùng</h2>
          <p className="mt-1 text-sm text-ink-2">
            {laQuanTri
              ? "Toàn bộ tài khoản của hệ thống. Bấm một dòng để xem chi tiết hoặc sửa."
              : "Tài khoản thuộc đơn vị của bạn và các đơn vị cấp dưới. Bấm một dòng để xem chi tiết."}
          </p>
        </div>
        {laQuanTri ? (
          <Button icon="plus" onClick={() => hop.mo("them")}>
            Thêm người dùng
          </Button>
        ) : null}
      </div>

      {soChoXacMinh > 0 && params.get("xac_minh") !== "cho_duyet" ? (
        <Notice className="mt-4">
          Có <strong>{soChoXacMinh.toLocaleString("vi-VN")}</strong> tài khoản tự đăng ký đang chờ xác minh
          cán bộ.{" "}
          <Link to="/quan-tri/nguoi-dung?xac_minh=cho_duyet" className="font-semibold underline">
            Xem và duyệt
          </Link>
        </Notice>
      ) : null}

      {ketQua && "loi" in ketQua ? (
        <Notice tone="danger" className="mt-4">
          {ketQua.loi}
        </Notice>
      ) : null}
      {thongBaoOk && !baoTaiDong ? <div className="mt-4">{thongBaoOk}</div> : null}

      {laQuanTri ? (
        <div className="mt-4">
          <details
            className="rounded-xl border border-line bg-surface px-4"
            open={Boolean(actionData && "nhap" in actionData)}
          >
            <summary className="flex min-h-11 cursor-pointer items-center font-medium text-primary">
              Nhập danh sách từ Excel
            </summary>
            <div className="pb-4">
              <p className="text-sm text-ink-2">
                Mỗi người một dòng: họ và tên, tên đăng nhập, mã đơn vị, vai trò (Cán bộ hoặc Cán bộ quản lý).
                Hệ thống cấp mật khẩu tạm cho từng người.
              </p>
              <ButtonLink to="/quan-tri/nguoi-dung/mau" reloadDocument variant="ghost" className="mt-2 px-0">
                Tải tệp mẫu (Excel)
              </ButtonLink>
              <Form method="post" encType="multipart/form-data" className="mt-2">
                <input type="hidden" name="intent" value="nhap" />
                <Label htmlFor="tep-nhap">Tệp danh sách (.xlsx)</Label>
                <input
                  id="tep-nhap"
                  name="tep"
                  type="file"
                  required
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3"
                />
                <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" name="chay_thu" defaultChecked />
                  Chạy thử: chỉ kiểm tra, chưa tạo tài khoản
                </label>
                <Button type="submit" className="mt-2 w-full md:w-auto" disabled={busy}>
                  Kiểm tra và nhập
                </Button>
              </Form>
              {actionData && "nhap" in actionData ? <KetQuaNhapExcel kq={actionData.nhap} /> : null}
            </div>
          </details>
        </div>
      ) : null}

      <Form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Label htmlFor="loc-dv">Đơn vị</Label>
          <ChonDonVi
            id="loc-dv"
            donVi={donVi}
            macDinh={params.get("don_vi")}
            tatCa="Tất cả đơn vị được xem"
          />
        </div>
        <div className="min-w-48 flex-1">
          <Label htmlFor="loc-q">Tên hoặc tên đăng nhập</Label>
          <Input id="loc-q" name="q" type="search" defaultValue={params.get("q") ?? ""} />
        </div>
        <div className="min-w-48 flex-1">
          <Label htmlFor="loc-xm">Xác minh</Label>
          <select
            id="loc-xm"
            name="xac_minh"
            defaultValue={params.get("xac_minh") ?? ""}
            className={inputClass}
          >
            <option value="">Mọi tài khoản</option>
            <option value="cho_duyet">Chờ xác minh</option>
            <option value="tu_choi">Đã từ chối</option>
            <option value="chua_xac_minh">Chưa được xác minh (cả hai)</option>
          </select>
        </div>
        <Button type="submit" variant="secondary">
          Lọc danh sách
        </Button>
      </Form>

      <p className="mt-4 text-sm text-ink-3">{total.toLocaleString("vi-VN")} người</p>
      {items.length === 0 ? (
        <div className="mt-2">
          <EmptyState icon="user" title="Không có người dùng nào khớp bộ lọc" />
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {items.map((u) => {
            const ten = u.username ?? u.email ?? "";
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => hop.mo("chiTiet", u.id)}
                  className="lun flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold text-ink">{u.name ?? ten}</span>
                      <span className="min-w-0 break-all font-mono text-sm text-ink">{ten}</span>
                      <Badge tone={u.role === "quan_ly" || u.role === "quan_tri" ? "info" : "muted"}>
                        {TEN_VAI_TRO[u.role] ?? u.role}
                      </Badge>
                      {!u.enabled ? <Badge tone="danger">Đã khóa</Badge> : null}
                      {u.must_change_password ? <Badge tone="warn">Chưa đổi mật khẩu tạm</Badge> : null}
                      {u.xac_minh !== "da_xac_minh" ? (
                        <Badge tone={XAC_MINH[u.xac_minh].tone}>{XAC_MINH[u.xac_minh].nhan}</Badge>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-sm text-ink-2">
                      {u.unit_name ?? "Chưa gắn đơn vị"}
                      {u.rank_title ? ` · ${u.rank_title}` : ""}
                    </span>
                  </span>
                  <Icon name="chevronRight" className="size-4 shrink-0 text-ink-3" />
                </button>
                {baoTaiDong && u.username === tenCoMatKhau ? (
                  <div ref={refBaoTaiDong} className="scroll-my-24 px-4 pb-3">
                    {thongBaoOk}
                  </div>
                ) : null}
                {u.xac_minh !== "da_xac_minh" && u.enabled ? (
                  <div className="px-4 pb-3">
                    <XetXacMinh u={u} ten={ten} donVi={donVi} busy={busy} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {total > MOI_TRANG ? (
        <nav aria-label="Trang danh sách" className="mt-4 flex justify-between gap-3">
          {trang > 1 ? (
            <Link to={trangHref(trang - 1)} className="flex min-h-11 items-center text-sm underline">
              Trang trước
            </Link>
          ) : (
            <span />
          )}
          {trang * MOI_TRANG < total ? (
            <Link to={trangHref(trang + 1)} className="flex min-h-11 items-center text-sm underline">
              Trang sau
            </Link>
          ) : null}
        </nav>
      ) : null}

      {laQuanTri ? (
        <HopThoai mo={hop.la("them")} onDong={hop.dong} tieuDe="Thêm người dùng">
          <BieuMauThem key={hop.lan} donVi={donVi} onXong={xong} />
        </HopThoai>
      ) : null}
      <HopThoai
        mo={dangXem !== undefined}
        onDong={hop.dong}
        tieuDe={dangXem ? (dangXem.name ?? dangXem.username ?? dangXem.email ?? "") : ""}
      >
        {dangXem ? (
          <ChiTietNguoiDung
            key={hop.lan}
            u={dangXem}
            donVi={donVi}
            duocSua={laQuanTri && !(toi && dangXem.username === toi)}
            onXong={xong}
          />
        ) : null}
      </HopThoai>
    </section>
  );
}
