/**
 * Bước `soan_tu_dong` của worker soạn bài (ke-hoach/09-c §4): soạn cả chuyên đề từ văn bản.
 *
 * Luồng: nạp nguyên văn các điều khoản có hiệu lực tại ngày áp dụng → mô hình lập dàn ý → hậu
 * kiểm dàn ý (căn cứ phải nằm trong văn bản đã chọn) → tạo bài nháp trong chuyên đề, mỗi bài một
 * chủ đề câu hỏi → giao cho mỗi bài ba việc con:
 *  - `soan_bai`: khối nội dung (cũng là slide), tự nhận vào bản nháp khi xong;
 *  - `sinh_bai_tap`: một bài tự luận có rubric, tự nhận vào bản nháp khi xong (bỏ khi tắt `tu_luan`);
 *  - `sinh_cau_hoi_ngan_hang`: câu trắc nghiệm vào ngân hàng chung, trạng thái chờ duyệt.
 *
 * Không có gì tới người học ở bước này: bài nằm ở bản nháp tới khi duyệt xuất bản, câu hỏi
 * nằm ở chờ duyệt tới khi được duyệt.
 *
 * Tệp này không phụ thuộc BullMQ, để test API gọi thẳng được.
 */

import { docDanYAi, hauKiemDanYAi, LOAI_CAU_HOI, type LoaiCauHoi, slugTuTieuDe } from "@qdpl/dao-tao";
import {
  type AuthoringJobRow,
  BUOC_SINH_CAU_HOI,
  baiHocCuaChuyenDe,
  batDauViecSoanBai,
  chuyenDeTheoId,
  damBaoChuDeCuaBai,
  dieuKhoanNguCanh,
  ketThucViecSoanBai,
  luuBaiHoc,
  sql,
  taoViecSoanBai,
} from "@qdpl/db";
import { complete, loadPrompt, render, safeJson } from "@qdpl/llm";
import { dungNguCanh } from "./sinh-cau-hoi.ts";

export const PROMPT_DAN_Y = "dao-tao/dan-y-tu-van-ban";

/** Đầu vào lưu ở `authoring_jobs.input`, do API `POST /v1/quan-tri/dao-tao/soan-tu-dong` ghi. */
export interface DauVaoSoanTuDong {
  urns: string[];
  so_bai: number;
  /** Số câu trắc nghiệm sinh vào ngân hàng cho mỗi bài; 0 là không sinh. */
  so_cau_hoi: number;
  /** Có soạn một bài tự luận cho mỗi bài hay không; vắng là có. */
  tu_luan: boolean;
  loai_cau_hoi: LoaiCauHoi[];
  as_of: string;
  vi_du: string;
}

export function docDauVaoSoanTuDong(input: unknown): DauVaoSoanTuDong {
  const o = (input ?? {}) as Record<string, unknown>;
  const urns = Array.isArray(o.urns) ? o.urns.map(String) : [];
  if (!urns.length) throw new Error("Việc soạn tự động chưa có văn bản hay điều khoản nào");
  const loai = (Array.isArray(o.loai_cau_hoi) ? o.loai_cau_hoi : []).filter((l): l is LoaiCauHoi =>
    LOAI_CAU_HOI.includes(l as LoaiCauHoi),
  );
  return {
    urns,
    so_bai: Math.min(20, Math.max(1, Number(o.so_bai ?? 6))),
    so_cau_hoi: Math.min(20, Math.max(0, Number(o.so_cau_hoi ?? 6))),
    tu_luan: o.tu_luan !== false,
    loai_cau_hoi: loai.length ? loai : ["mot_dap_an", "dung_sai"],
    as_of: String(o.as_of ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
    vi_du: String(o.vi_du ?? ""),
  };
}

export interface KetQuaSoanTuDong {
  so_bai: number;
  so_viec_con: number;
  chi_phi_usd: number;
  /** Id các việc con, để worker (hoặc test) chạy tiếp. */
  viec_con: string[];
}

/**
 * Chạy việc cha: lập dàn ý, tạo bài nháp và việc con. Không đẩy việc con vào hàng đợi; người gọi
 * (worker) đẩy, để tệp này không cần Redis.
 */
export async function chaySoanTuDong(
  viec: AuthoringJobRow,
  tienDo: (phanTram: number, ghiChu?: string) => Promise<void> = async () => {},
): Promise<KetQuaSoanTuDong> {
  // Chạy lại sau khi đã giao việc con (ví dụ lỗi đúng lúc kết thúc) thì không tạo bài lần nữa.
  const daGiao = await sql<Array<{ id: string }>>`
    SELECT id FROM authoring_jobs WHERE parent_id = ${viec.id}::uuid ORDER BY created_at`;
  if (daGiao.length) {
    await sql`UPDATE authoring_jobs SET state = 'xong', finished_at = COALESCE(finished_at, now())
              WHERE id = ${viec.id}::uuid`;
    return { so_bai: 0, so_viec_con: daGiao.length, chi_phi_usd: 0, viec_con: daGiao.map((v) => v.id) };
  }

  await batDauViecSoanBai(viec.id);
  try {
    const v = docDauVaoSoanTuDong(viec.input);
    const course = viec.course_id ? await chuyenDeTheoId(viec.course_id) : undefined;
    if (!course) throw new Error("Việc soạn tự động chưa gắn chuyên đề");

    // Điều khoản bị bãi bỏ hay ngưng hiệu lực không đưa cho mô hình: không dạy cái không còn áp dụng.
    const tatCa = await dieuKhoanNguCanh(v.urns, v.as_of);
    const dieuKhoan = tatCa.filter((d) => d.node_status !== "repealed" && d.node_status !== "suspended");
    if (!dieuKhoan.length) throw new Error(`Không có điều khoản nào có hiệu lực tại ${v.as_of}`);
    const urnNguCanh = dieuKhoan.map((d) => d.urn);
    await tienDo(15, `${dieuKhoan.length} điều khoản vào ngữ cảnh`);

    const prompt = loadPrompt(PROMPT_DAN_Y);
    const res = await complete({
      tier: "bulk",
      promptName: PROMPT_DAN_Y,
      promptVersion: prompt.version,
      cacheableSystem: prompt.system,
      user: render(prompt.user, {
        chuyen_de: course.title,
        doi_tuong: course.audience.join(", ") || "cán bộ áp dụng quy định",
        so_bai: v.so_bai,
        as_of: v.as_of,
        ngu_canh: dungNguCanh(dieuKhoan),
      }),
      maxTokens: Math.min(8_000, 600 + v.so_bai * 400),
      batch: viec.batch,
    });
    await tienDo(50, "đã có dàn ý");

    const doc = docDanYAi(res.json ?? safeJson(res.text));
    const hk = hauKiemDanYAi(doc.bai, { urnNguCanh, soBaiToiDa: v.so_bai });
    if (!hk.bai.length) throw new Error("Dàn ý của mô hình không có bài nào dùng được");

    /* ---- Tạo bài nháp: slug không trùng bài đã có, thứ tự nối sau bài cuối ---- */
    const baiCu = await baiHocCuaChuyenDe(course.id);
    const slugDaCo = new Set(baiCu.map((b) => b.slug));
    let thuTu = baiCu.reduce((m, b) => Math.max(m, b.ordinal), 0);
    const nguoiTao = viec.requested_by ?? "ai";
    const baiMoi: Array<{ lessonId: string; slug: string; title: string; canCu: string[] }> = [];
    const viecCon: string[] = [];

    for (const b of hk.bai) {
      thuTu += 1;
      const goc = slugTuTieuDe(b.tieuDe, 50) || "bai";
      const slug = slugDaCo.has(goc) ? `${goc}-${thuTu}` : goc;
      slugDaCo.add(slug);
      const bai = await luuBaiHoc({
        courseId: course.id,
        slug,
        ordinal: thuTu,
        title: b.tieuDe,
        summary: b.tomTat,
        asOf: v.as_of,
        source: "ai",
        updatedBy: nguoiTao,
      });
      const chuDe = await damBaoChuDeCuaBai(bai.id);
      baiMoi.push({ lessonId: bai.id, slug, title: b.tieuDe, canCu: b.canCu });

      const chung = {
        courseId: course.id,
        lessonId: bai.id,
        batch: viec.batch,
        requestedBy: viec.requested_by,
        parentId: viec.id,
      };
      viecCon.push(
        (
          await taoViecSoanBai({
            ...chung,
            step: "soan_bai",
            input: { urns: b.canCu, ...(v.vi_du ? { vi_du: v.vi_du } : {}) },
            autoApply: true,
          })
        ).id,
      );
      if (v.tu_luan) {
        viecCon.push(
          (
            await taoViecSoanBai({
              ...chung,
              step: "sinh_bai_tap",
              input: { urns: b.canCu, dang_bai: "viet_co_can_cu", so_cau: 1 },
              autoApply: true,
            })
          ).id,
        );
      }
      if (v.so_cau_hoi > 0 && chuDe) {
        viecCon.push(
          (
            await taoViecSoanBai({
              ...chung,
              step: BUOC_SINH_CAU_HOI,
              input: {
                urns: b.canCu,
                topic_id: chuDe.id,
                topic_code: chuDe.code,
                topic_name: chuDe.name,
                muc_do: null,
                loai: v.loai_cau_hoi,
                so_cau: v.so_cau_hoi,
                as_of: v.as_of,
              },
            })
          ).id,
        );
      }
    }
    await tienDo(90, `${baiMoi.length} bài, ${viecCon.length} việc con`);

    await ketThucViecSoanBai(viec.id, {
      output: {
        asOf: v.as_of,
        urnNguCanh,
        boQua: tatCa.filter((d) => !urnNguCanh.includes(d.urn)).map((d) => ({ urn: d.urn, label: d.label })),
        bai: baiMoi,
        biLoai: hk.biLoai,
        chuaDung: hk.chuaDung,
        loiDoc: doc.loi,
      },
      model: res.model,
      promptVersion: prompt.version,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
      costUsd: res.costUsd,
    });
    return {
      so_bai: baiMoi.length,
      so_viec_con: viecCon.length,
      chi_phi_usd: res.costUsd,
      viec_con: viecCon,
    };
  } catch (e) {
    await ketThucViecSoanBai(viec.id, { error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
