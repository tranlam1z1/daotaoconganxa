/**
 * Ghép lỗi với mức phạt (docs/PLAN.md GĐ10). Nội dung là dữ liệu mức phạt ĐÃ DUYỆT của phần tra
 * cứu nhanh; chơi bằng chạm (chạm hành vi rồi chạm mức phạt). Nộp một lần, máy chủ chấm.
 *
 * Kết quả (GĐ17b, H5, Đ11): một hộp "Đúng" / "Đúng một phần" / "Chưa đúng" với dòng "Đúng x/y cặp";
 * mức phạt đúng và căn cứ từng cặp thu gọn sau "Xem chi tiết", căn cứ mở rộng tại chỗ (H8). Bảng ghép
 * vẫn tô màu từng cặp; đóng hộp thì đáy trang có "Xem lại kết quả".
 */
import { useState } from "react";
import { Form, useNavigation } from "react-router";

import { BangGhepCap } from "../components/tro-choi/BangGhepCap";
import { CanCuMoRong } from "../components/tro-choi/chung/ChiTietKetQua";
import { HopKetQuaCau, NutXemLaiKetQua } from "../components/tro-choi/chung/HopKetQuaCau";
import { KhungGame } from "../components/tro-choi/KhungGame";
import { Button, ButtonLink } from "../components/ui/Button";
import { Notice } from "../components/ui/Field";
import { cn } from "../lib/cn";
import { LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import { batDauGhepCap, type DeGhepCap, type KetQuaGhepCap, nopGhepCap } from "../lib/tro-choi.server";
import type { Route } from "./+types/tro-choi.ghep-cap";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Ghép lỗi với mức phạt", { index: false });
}

const XE = [
  { value: "", label: "Mọi loại xe" },
  { value: "mo_to", label: "Xe mô tô, xe gắn máy" },
  { value: "o_to", label: "Ô tô" },
] as const;

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  const f = await request.formData();
  try {
    if (f.get("intent") === "nop") {
      const id = String(f.get("id") ?? "");
      const cap = JSON.parse(String(f.get("cap") ?? "{}")) as Record<string, string>;
      const de = JSON.parse(String(f.get("de") ?? "{}")) as DeGhepCap;
      return { van: { id, de, cap, ketQua: await nopGhepCap(token, id, cap) } };
    }
    const xe = String(f.get("xe") ?? "");
    const bd = await batDauGhepCap(token, xe === "o_to" || xe === "mo_to" ? xe : undefined);
    return {
      van: { id: bd.id, de: bd.de, cap: {} as Record<string, string>, ketQua: null as KetQuaGhepCap | null },
    };
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  await yeuCauDangNhap(request);
  return null;
}

export default function GhepCap({ actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  const van = actionData && "van" in actionData ? actionData.van : null;

  if (!van) {
    return (
      <KhungGame tieuDe="Ghép lỗi với mức phạt">
        <p className="text-[15px] leading-relaxed text-ink-2">
          Ghép 5 hành vi vi phạm với đúng mức tiền phạt. Mức phạt lấy theo quy định đang áp dụng hôm nay.
        </p>
        {actionData && "loi" in actionData ? (
          <Notice tone="danger" className="mt-4">
            {actionData.loi}
          </Notice>
        ) : null}
        <Form method="post" className="mt-6 grid gap-3">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-2">Loại xe</legend>
            <div className="grid gap-2">
              {XE.map((x, i) => (
                <label
                  key={x.value}
                  className="flex min-h-11 items-center gap-3 rounded-lg border border-line bg-surface px-3"
                >
                  <input type="radio" name="xe" value={x.value} defaultChecked={i === 0} className="size-5" />
                  {x.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" className="min-h-12 w-full text-base" disabled={busy}>
            Bắt đầu
          </Button>
        </Form>
      </KhungGame>
    );
  }
  return <VanGhepCap key={van.id} van={van} busy={busy} />;
}

function VanGhepCap({
  van,
  busy,
}: {
  van: { id: string; de: DeGhepCap; cap: Record<string, string>; ketQua: KetQuaGhepCap | null };
  busy: boolean;
}) {
  const [cap, datCap] = useState<Record<string, string>>(van.cap);
  const kq = van.ketQua;
  const du = Object.keys(cap).length === van.de.trai.length;
  const dungSai = kq ? Object.fromEntries(kq.chi_tiet.map((c) => [c.id, c.dung])) : undefined;
  const chiTiet = new Map(kq?.chi_tiet.map((c) => [c.id, c]) ?? []);
  const [daDongHop, datDaDongHop] = useState(false);
  const [lanMoHop, datLanMoHop] = useState(0);
  const [vuaDongHop, datVuaDongHop] = useState(false);
  const moHop = Boolean(kq) && !daDongHop;

  const nutVanMoi = (
    <Form method="post">
      <Button type="submit" className="min-h-12 w-full text-base" disabled={busy}>
        Chơi ván mới
      </Button>
    </Form>
  );
  // Mức phạt đúng và căn cứ từng cặp: phần chi tiết riêng của hộp.
  const mucPhatDung = kq ? (
    <section aria-labelledby="dap-an">
      <h3 id="dap-an" className="font-sans text-base font-semibold">
        Mức phạt đúng
      </h3>
      <ul className="mt-2 grid gap-2">
        {van.de.trai.map((t) => {
          const c = chiTiet.get(t.id);
          return (
            <li key={t.id} className="rounded-lg border border-line bg-surface p-3">
              <p className="text-base">{t.text}</p>
              <p className={cn("mt-1 font-semibold", c?.dung ? "text-ok" : "text-danger")}>
                {c?.muc_phat_dung}
                <span className="font-normal text-ink-2">
                  {" "}
                  · {c?.dung ? "bạn ghép đúng" : "bạn ghép chưa đúng"}
                </span>
              </p>
              {c?.citation_urn ? (
                <div className="mt-2">
                  <CanCuMoRong urn={c.citation_urn} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  ) : null;

  return (
    <KhungGame
      tieuDe="Ghép lỗi với mức phạt"
      benPhai={
        <span className="text-sm font-semibold">
          {kq ? `Đúng ${kq.dung}/${kq.tong}` : `Đã ghép ${Object.keys(cap).length}/${van.de.trai.length}`}
        </span>
      }
    >
      <BangGhepCap de={van.de} cap={cap} onChange={datCap} khoa={Boolean(kq)} dungSai={dungSai} />

      {kq ? (
        <div className="mt-6 grid gap-3">
          {moHop ? null : (
            <>
              <NutXemLaiKetQua
                layTieuDiem={vuaDongHop}
                onClick={() => {
                  datDaDongHop(false);
                  datLanMoHop((n) => n + 1);
                }}
              />
              {nutVanMoi}
            </>
          )}
          <ButtonLink to="/tro-choi" variant="secondary" className="min-h-12 w-full text-base">
            Trò chơi khác
          </ButtonLink>
          <HopKetQuaCau
            mo={moHop}
            lanMo={lanMoHop}
            onDong={() => {
              datDaDongHop(true);
              datVuaDongHop(true);
            }}
            ketQua={{ dung: null, diem: kq.dung, diem_toi_da: kq.tong, giai_thich: null, can_cu: [] }}
            dongDiem={
              <>
                Đúng{" "}
                <span className="font-semibold text-ink">
                  {kq.dung}/{kq.tong}
                </span>{" "}
                cặp{kq.xp ? <span className="text-primary"> · +{kq.xp} XP</span> : null}
              </>
            }
            nutChinh={nutVanMoi}
            chiTietRieng={mucPhatDung}
          />
        </div>
      ) : (
        <Form method="post" className="mt-6">
          <input type="hidden" name="intent" value="nop" />
          <input type="hidden" name="id" value={van.id} />
          <input type="hidden" name="cap" value={JSON.stringify(cap)} />
          <input type="hidden" name="de" value={JSON.stringify(van.de)} />
          <Button type="submit" className="min-h-12 w-full text-base" disabled={busy || !du}>
            {du ? "Nộp" : "Ghép đủ các cặp để nộp"}
          </Button>
        </Form>
      )}
    </KhungGame>
  );
}
