/**
 * Bước `sinh_cau_hoi_ngan_hang` của worker soạn bài (docs/PLAN.md GĐ8): AI sinh câu hỏi vào
 * ngân hàng.
 *
 * Luồng: nạp nguyên văn điều khoản tại ngày soạn và đề bài các câu đã có trên các điều khoản đó
 * (để mô hình không hỏi lại) → gọi mô hình → hậu kiểm tất định (hợp lệ theo loại, căn cứ còn hiệu
 * lực, so trùng) → ghi câu qua hậu kiểm vào ngân hàng ở `cho_duyet`, `source = ai`. Câu bị loại
 * chỉ nằm trong `authoring_jobs.output` kèm lý do, để quản trị viên nội dung xem vì sao.
 *
 * Tệp này không phụ thuộc BullMQ, để test API gọi thẳng được (apps/api/src/sinh-cau-hoi.test.ts).
 */

import {
  docCauHoiAi,
  hauKiemCauHoiAi,
  LOAI_CAU_HOI,
  type LoaiCauHoi,
  type MucDoCauHoi,
  TEN_LOAI_CAU_HOI,
  TEN_MUC_DO,
} from "@qdpl/dao-tao";
import {
  type AuthoringJobRow,
  batDauViecSoanBai,
  cauHoiGanGiong,
  type DieuKhoanNguCanh,
  deBaiDaCoTheoCanCu,
  dieuKhoanNguCanh,
  ketThucViecSoanBai,
  soCauHoiCuaViec,
  sql,
  taoCauHoiAi,
  tinhTrangCanCu,
} from "@qdpl/db";
import { complete, loadPrompt, render, safeJson } from "@qdpl/llm";

export const PROMPT_SINH_CAU_HOI = "dao-tao/sinh-cau-hoi-ngan-hang";

/** Đầu vào lưu ở `authoring_jobs.input`, do API `POST /v1/quan-tri/ngan-hang/sinh-ai` ghi. */
export interface DauVaoSinhCauHoi {
  urns: string[];
  topic_id: string;
  topic_name: string;
  /** null là trộn các mức độ. */
  muc_do: MucDoCauHoi | null;
  loai: LoaiCauHoi[];
  so_cau: number;
  as_of: string;
  /**
   * Loại hẳn câu gần giống câu đã có, thay vì nhận kèm đánh dấu. Chỉ lối "Sinh bằng AI" của ngân
   * hàng bật: đề thi và bài học cần đủ số câu nên vẫn nhận câu trùng cho người duyệt quyết định.
   */
  loai_trung: boolean;
}

/** Ngữ cảnh đưa cho mô hình: mỗi điều khoản mở bằng `### <urn>` để mô hình trích đúng URN. */
export function dungNguCanh(ds: DieuKhoanNguCanh[]): string {
  return ds
    .map(
      (d) =>
        `### ${d.urn}\n${d.label}${d.heading ? ` — ${d.heading}` : ""}${d.short_title ? ` ${d.short_title}` : ""}\n${d.text}`,
    )
    .join("\n\n");
}

/**
 * So trùng rồi ghi phải nối đuôi nhau: các lượt sinh chạy cùng lúc trên cùng điều khoản (như các
 * lượt của một đề) thì lượt sau phải thấy câu lượt trước vừa ghi.
 * shortcut: chỉ nối đuôi trong một tiến trình, chạy nhiều tiến trình worker thì đổi sang pg_advisory_lock.
 */
let hangSoTrung: Promise<unknown> = Promise.resolve();
function noiDuoi<T>(lam: () => Promise<T>): Promise<T> {
  const kq = hangSoTrung.then(lam);
  hangSoTrung = kq.catch(() => {});
  return kq;
}

/** Mục CÂU ĐÃ CÓ của prompt: mỗi đề bài một dòng, cắt ngắn để danh sách dài không lấn ngữ cảnh. */
export function dungCauDaCo(deBai: string[]): string {
  if (!deBai.length) return "(chưa có câu nào)";
  return deBai
    .map((s) => s.replace(/\s+/g, " ").trim())
    .map((s) => `- ${s.length > 200 ? `${s.slice(0, 200)}…` : s}`)
    .join("\n");
}

/** Biến của prompt. `cauDaCo` là đề bài các câu đã có trên cùng điều khoản. */
export function bienPromptSinhCauHoi(
  v: DauVaoSinhCauHoi,
  nguCanh: string,
  cauDaCo: string[],
): Record<string, string | number> {
  return {
    cau_da_co: dungCauDaCo(cauDaCo),
    chu_de: v.topic_name,
    so_cau: v.so_cau,
    muc_do: v.muc_do
      ? `${v.muc_do} (${TEN_MUC_DO[v.muc_do]})`
      : "trộn, khoảng 4 phần de, 4 phần trung_binh, 2 phần kho",
    loai: v.loai.map((l) => `${l} (${TEN_LOAI_CAU_HOI[l]})`).join(", "),
    as_of: v.as_of,
    ngu_canh: nguCanh,
  };
}

export function docDauVao(input: unknown): DauVaoSinhCauHoi {
  const o = (input ?? {}) as Record<string, unknown>;
  const loai = (Array.isArray(o.loai) ? o.loai : []).filter((l): l is LoaiCauHoi =>
    LOAI_CAU_HOI.includes(l as LoaiCauHoi),
  );
  const urns = Array.isArray(o.urns) ? o.urns.map(String) : [];
  if (!urns.length) throw new Error("Việc sinh câu hỏi chưa có điều khoản nào");
  if (typeof o.topic_id !== "string") throw new Error("Việc sinh câu hỏi chưa có chủ đề");
  return {
    urns,
    topic_id: o.topic_id,
    topic_name: String(o.topic_name ?? ""),
    muc_do: ["de", "trung_binh", "kho"].includes(String(o.muc_do)) ? (o.muc_do as MucDoCauHoi) : null,
    loai: loai.length ? loai : ["mot_dap_an", "dung_sai"],
    so_cau: Math.min(20, Math.max(1, Number(o.so_cau ?? 5))),
    as_of: String(o.as_of ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
    loai_trung: o.loai_trung === true,
  };
}

export interface KetQuaSinhCauHoi {
  so_mo_hinh_tra: number;
  so_nhan: number;
  so_loai: number;
  /** Số câu được nhận kèm đánh dấu gần giống câu đã có (việc không loại câu trùng). */
  so_danh_dau_trung: number;
  /** Số câu bị loại vì gần giống câu đã có hoặc câu khác trong cùng lượt (việc loại câu trùng). */
  so_loai_trung: number;
  chi_phi_usd: number;
}

/**
 * Chạy trọn một việc sinh câu hỏi và ghi kết quả vào `authoring_jobs`. Ném lỗi khi không chạy
 * được (sau khi đã ghi trạng thái `loi`), để BullMQ thử lại.
 */
export async function chaySinhCauHoi(
  viec: AuthoringJobRow,
  tienDo: (phanTram: number, ghiChu?: string) => Promise<void> = async () => {},
): Promise<KetQuaSinhCauHoi> {
  // Chạy lại sau khi đã ghi câu (ví dụ lỗi đúng lúc kết thúc) thì không sinh thêm lần nữa.
  const daGhi = await soCauHoiCuaViec(viec.id);
  if (daGhi > 0) {
    await sql`UPDATE authoring_jobs SET state = 'xong', finished_at = COALESCE(finished_at, now())
              WHERE id = ${viec.id}::uuid`;
    return {
      so_mo_hinh_tra: daGhi,
      so_nhan: daGhi,
      so_loai: 0,
      so_danh_dau_trung: 0,
      so_loai_trung: 0,
      chi_phi_usd: 0,
    };
  }

  await batDauViecSoanBai(viec.id);
  try {
    const v = docDauVao(viec.input);
    const dieuKhoan = await dieuKhoanNguCanh(v.urns, v.as_of);
    if (!dieuKhoan.length) throw new Error(`Không có điều khoản nào có hiệu lực tại ${v.as_of}`);
    const urnNguCanh = dieuKhoan.map((d) => d.urn);
    await tienDo(20, `${dieuKhoan.length} điều khoản vào ngữ cảnh`);

    const prompt = loadPrompt(PROMPT_SINH_CAU_HOI);
    const res = await complete({
      tier: "bulk",
      promptName: PROMPT_SINH_CAU_HOI,
      promptVersion: prompt.version,
      cacheableSystem: prompt.system,
      user: render(
        prompt.user,
        bienPromptSinhCauHoi(v, dungNguCanh(dieuKhoan), await deBaiDaCoTheoCanCu(urnNguCanh)),
      ),
      maxTokens: Math.min(16_000, 1_500 + v.so_cau * 700),
      batch: viec.batch,
    });
    await tienDo(70, "mô hình đã trả kết quả");

    /* ---- Hậu kiểm tất định ---- */
    const { cau, loi: loiDoc } = docCauHoiAi(res.json ?? safeJson(res.text));
    const canCu = await tinhTrangCanCu(
      cau.flatMap((c) => c.citations),
      v.as_of,
    );
    const { kq, rows } = await noiDuoi(async () => {
      const cauDaCo = new Map<string, { id: string; code: string; stem: string }>();
      for (const c of cau) {
        if (c.stem) for (const r of await cauHoiGanGiong(c.stem)) cauDaCo.set(r.id, r);
      }
      const kq = hauKiemCauHoiAi(cau, {
        loaiDuocPhep: v.loai,
        urnNguCanh,
        canCu,
        cauDaCo: [...cauDaCo.values()],
        loaiCauTrung: v.loai_trung,
      });

      // Chỉ số `trungTrongLo` trỏ vào `kq`; đổi sang chỉ số trong danh sách câu được ghi.
      const viTriGhi = new Map<number, number>();
      const ghi = kq.flatMap((k, i) => {
        if (!k.nhan) return [];
        viTriGhi.set(i, viTriGhi.size);
        return [
          {
            topicId: v.topic_id,
            level: k.cau.level,
            kind: k.cau.kind,
            stem: k.cau.stem,
            options: k.cau.options,
            answer: k.cau.answer,
            explanation: k.cau.explanation,
            citations: k.cau.citations,
            rubric: k.cau.rubric ?? {},
            status: "cho_duyet" as const,
            authoringJobId: viec.id,
            duplicateOf: k.trungVoi?.id ?? null,
            ...(k.trungTrongLo !== undefined ? { trungTrongLo: viTriGhi.get(k.trungTrongLo)! } : {}),
          },
        ];
      });
      return { kq, rows: ghi.length ? await taoCauHoiAi(ghi, viec.requested_by ?? "ai") : [] };
    });
    await tienDo(95, `${rows.length} câu vào hàng chờ duyệt`);

    const biLoai = kq
      .filter((k) => !k.nhan)
      .map((k) => ({ stem: k.cau.stem, kind: k.cau.kind, ly_do: k.lyDo }));
    const soTrung = rows.filter((r) => r.duplicate_of).length;
    // Câu bị loại chỉ mang dấu trùng khi việc chạy ở chế độ loại câu trùng.
    const soLoaiTrung = kq.filter((k) => !k.nhan && (k.trungVoi || k.trungTrongLo !== undefined)).length;
    const output = {
      as_of: v.as_of,
      urn_ngu_canh: urnNguCanh,
      so_yeu_cau: v.so_cau,
      so_mo_hinh_tra: cau.length,
      so_nhan: rows.length,
      so_loai: biLoai.length,
      so_danh_dau_trung: soTrung,
      so_loai_trung: soLoaiTrung,
      cau_hoi: rows.map((r) => ({ id: r.id, code: r.code, duplicate_of: r.duplicate_of })),
      bi_loai: biLoai,
      loi_doc: loiDoc,
      // Mô hình trả chữ không đọc được thành JSON: giữ lại một đoạn để người vận hành xem.
      ...(cau.length === 0 ? { text: res.text.slice(0, 2000) } : {}),
    };
    await ketThucViecSoanBai(viec.id, {
      output,
      model: res.model,
      promptVersion: prompt.version,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
      costUsd: res.costUsd,
    });
    return {
      so_mo_hinh_tra: cau.length,
      so_nhan: rows.length,
      so_loai: biLoai.length,
      so_danh_dau_trung: soTrung,
      so_loai_trung: soLoaiTrung,
      chi_phi_usd: res.costUsd,
    };
  } catch (e) {
    await ketThucViecSoanBai(viec.id, { error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
