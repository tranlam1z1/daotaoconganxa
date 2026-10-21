/**
 * Giai đoạn SINH ẢNH MASCOT — nở một lô tổ hợp thành từng ảnh (ke-hoach/09-b §6).
 *
 * Việc giữ nhân vật không biến dạng qua nhiều lần sinh làm bằng ba thứ, và cả ba đều nằm ở
 * đây: phiếu nhân vật chép nguyên văn vào đầu prompt, bản dựng SVG của đúng tổ hợp làm ảnh
 * tham chiếu, và seed ghi lại để tái tạo.
 *
 * Ảnh sinh ra vào trạng thái `cho_duyet`, KHÔNG phải `duyet`. Không có đường nào từ mô hình
 * thẳng ra trang người học.
 */
import { capNhatLoSinhAnh, loSinhAnhTheoId, nhanVatTheoId, type PersonaRow, themAnh } from "@qdpl/db";
import { complete, loadPrompt, render } from "@qdpl/llm";
import {
  chonTrangPhuc,
  NHAN_TRANG_THAI,
  type NhanVat,
  type TrangPhuc,
  type TrangThai,
  veMascot,
} from "@qdpl/mascot";
import { QUEUES } from "@qdpl/queue";
import { putText } from "@qdpl/storage";
import { defineStage } from "../stage.ts";

function toNhanVat(r: PersonaRow): NhanVat {
  return {
    id: r.id,
    code: r.code,
    fullName: r.full_name,
    nickName: r.nick_name,
    roleLine: r.role_line,
    bio: r.bio ?? undefined,
    audiences: r.audiences,
    topics: r.topics,
    voice: r.voice as unknown as NhanVat["voice"],
    palette: r.palette as unknown as NhanVat["palette"],
    body: r.body as NhanVat["body"],
    headGear: r.head_gear,
    defaultProp: r.default_prop as NhanVat["defaultProp"],
    allowedCostumes: r.allowed_costumes as TrangPhuc[],
    characterSheet: r.character_sheet,
    enabled: r.enabled,
    isDefault: r.is_default,
    ordinal: r.ordinal,
  };
}

export interface ToHop {
  state: TrangThai;
  costume: TrangPhuc;
  pose: string;
  prop: string;
  effect: string;
}

/** Nở một `spec` thành danh sách tổ hợp cần sinh. */
export function noToHop(spec: Record<string, unknown>): ToHop[] {
  const states = (spec.states as TrangThai[] | undefined) ?? ["binh_thuong"];
  const costumes = (spec.costumes as TrangPhuc[] | undefined) ?? ["thuong_ngay"];
  const poses = (spec.poses as string[] | undefined) ?? ["dung"];
  const props = (spec.props as string[] | undefined) ?? [];
  const effects = (spec.effects as string[] | undefined) ?? ["khong"];
  const ra: ToHop[] = [];
  for (const state of states) {
    for (const costume of costumes) {
      for (const pose of poses) {
        ra.push({
          state,
          costume,
          pose,
          prop: props[0] ?? "khong",
          effect: effects[0] ?? "khong",
        });
      }
    }
  }
  return ra;
}

const KICH_THUOC: Record<string, string> = {
  avatar: "256×256",
  chan_dung: "512×512",
  toan_than: "768×1024",
  sticker: "512×512 nền trong suốt",
  bang_bieu_cam: "1536×1152",
  anh_bia: "1600×900",
  khung_hoat_hoa: "512×512 mỗi khung",
  anh_in: "2480×3508 ở 300 DPI",
};

export const mascotAnhStage = defineStage(QUEUES.mascotAnh, async (job, ctx) => {
  const lo = await loSinhAnhTheoId(job.data.jobId);
  if (!lo) throw new Error(`Không có lô sinh ảnh ${job.data.jobId}`);
  if (lo.state === "huy") return { skipped: true, reason: "lô đã huỷ", next: 0 };

  const row = await nhanVatTheoId(lo.persona_id);
  if (!row) throw new Error(`Không có nhân vật ${lo.persona_id}`);
  const nv = toNhanVat(row);

  const spec = lo.spec as Record<string, unknown>;
  const kind = String(spec.kind ?? "sticker");
  const soMoiToHop = Number(spec.soAnhMoiToHop ?? 1);
  const toHop = noToHop(spec);
  const prompt = loadPrompt("mascot/anh-nhan-vat");

  await capNhatLoSinhAnh(lo.id, { state: "dang_chay" });

  let xong = 0;
  let hong = 0;
  let chiPhi = 0;
  const tong = toHop.length * soMoiToHop;

  for (const th of toHop) {
    // Ghép sai bị chặn: nhân vật chỉ mặc trang phục trong danh sách cho phép.
    const costume = chonTrangPhuc(nv, th.costume);

    for (let i = 0; i < soMoiToHop; i++) {
      const seed = String(spec.seed ?? `${nv.code}-${th.state}-${costume}-${i}`);
      try {
        // Bản dựng SVG của ĐÚNG tổ hợp này: vừa là ảnh tham chiếu bố cục, vừa là bản dự
        // phòng dùng được ngay nếu ảnh AI chưa duyệt.
        const svg = veMascot({
          persona: nv,
          state: th.state,
          costume,
          pose: th.pose as never,
          prop: (th.prop || nv.defaultProp) as never,
          effect: th.effect as never,
          tinh: true,
        });
        const uriThamChieu = `assets/mascot/${nv.code}/tham-chieu/${th.state}-${costume}-${i}.svg`;
        await putText(uriThamChieu, svg);

        const res = await complete({
          tier: "light",
          promptName: "mascot/anh-nhan-vat",
          promptVersion: prompt.version,
          // Phiếu nhân vật là phần bất biến của mọi prompt -> đưa vào phần được cache.
          cacheableSystem: `${prompt.system}\n\nPHIẾU NHÂN VẬT:\n${nv.characterSheet}`,
          user: render(prompt.user, {
            phieu_nhan_vat: nv.characterSheet,
            bang_mau: JSON.stringify(nv.palette),
            loai: kind,
            kich_thuoc: KICH_THUOC[kind] ?? "512×512",
            trang_thai: th.state,
            mo_ta_trang_thai: NHAN_TRANG_THAI[th.state] ?? th.state,
            trang_phuc: costume,
            tu_the: th.pose,
            dao_cu: th.prop || nv.defaultProp,
            hieu_ung: th.effect,
          }),
          maxTokens: 1500,
        });
        chiPhi += res.costUsd;

        const chuoiPrompt =
          typeof (res.json as { prompt?: string } | undefined)?.prompt === "string"
            ? (res.json as { prompt: string }).prompt
            : res.text;

        await themAnh({
          personaId: nv.id,
          kind,
          state: th.state,
          costume,
          pose: th.pose,
          prop: th.prop || nv.defaultProp,
          effect: th.effect,
          // Cho tới khi có nhà cung cấp sinh ảnh, ảnh của lô là bản dựng SVG tham chiếu kèm
          // prompt đã dựng sẵn — người vận hành đưa prompt sang công cụ sinh ảnh và tải kết
          // quả lên. Không giả vờ đã có ảnh mà thực ra chưa có.
          uri: uriThamChieu,
          format: "svg",
          model: res.model,
          seed,
          promptVersion: prompt.version,
          prompt: chuoiPrompt,
          spec: { ...th, costume, kind },
          costUsd: res.costUsd,
          jobId: lo.id,
          createdBy: lo.requested_by,
          status: "cho_duyet",
        });
        xong++;
      } catch (e) {
        hong++;
        ctx.log.warn("Sinh ảnh hỏng một tổ hợp", {
          nhanVat: nv.code,
          trangThai: th.state,
          loi: e instanceof Error ? e.message : String(e),
        });
      }

      await capNhatLoSinhAnh(lo.id, { done: xong, failed: hong, costUsd: chiPhi });
      await ctx.progress(Math.round(((xong + hong) / Math.max(1, tong)) * 100), `${xong}/${tong}`);

      // Vượt trần chi phí thì dừng lô, không âm thầm tiêu tiếp.
      if (lo.budget_usd && chiPhi > Number(lo.budget_usd)) {
        await capNhatLoSinhAnh(lo.id, {
          state: "loi",
          error: `Vượt trần chi phí ${lo.budget_usd} USD sau ${xong} ảnh`,
        });
        return {
          skipped: true,
          reason: "vượt trần chi phí",
          next: 0,
          detail: { xong, hong, chiPhiUsd: chiPhi },
        };
      }
    }
  }

  await capNhatLoSinhAnh(lo.id, {
    state: hong && !xong ? "loi" : "xong",
    done: xong,
    failed: hong,
    costUsd: chiPhi,
  });
  ctx.log.info("Xong lô sinh ảnh mascot", { loId: lo.id, nhanVat: nv.code, xong, hong, chiPhiUsd: chiPhi });

  return { next: 0, detail: { xong, hong, chiPhiUsd: chiPhi, nhanVat: nv.code } };
});
