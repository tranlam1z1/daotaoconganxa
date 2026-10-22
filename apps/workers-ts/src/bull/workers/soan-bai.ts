/**
 * Giai đoạn SOẠN BÀI — dựng bản đầu của bài học và bài tập bằng mô hình (ke-hoach/09-a §5).
 *
 * Worker này KHÔNG xuất bản gì. Nó ghi kết quả vào `authoring_jobs.output` để quản trị viên nội dung
 * xem, sửa và nhận từng khối ở màn hình `/quan-tri/soan-bai-ai`. Không có đường nào từ mô
 * hình thẳng ra trang người học.
 *
 * Bước `kiem_can_cu` KHÔNG gọi mô hình: nó đối chiếu URN với CSDL. Việc kiểm tra một viện dẫn
 * còn hiệu lực hay không là việc tra cứu, không phải việc phán đoán.
 */

import {
  chuTrongKhoi,
  docBaiTapAi,
  docKhoiAi,
  hauKiemBaiTapAi,
  hauKiemKhoiAi,
  type KhoiAi,
  type KhoiNoiDung,
  kiemTraBaiHoc,
  kiemTraRubric,
} from "@qdpl/dao-tao";
import {
  BUOC_SINH_CAU_HOI,
  BUOC_SOAN_TU_DONG,
  baiHocTheoId,
  batDauViecSoanBai,
  chuyenDeTheoId,
  danhSachMaLoi,
  dieuKhoanNguCanh,
  hoatDongCuaBai,
  ketThucViecSoanBai,
  khoiCuaBai,
  kyNangCuaChuyenDe,
  nhanKetQuaSoanBai,
  sql,
  tinhTrangCanCu,
  vieCSoanBaiTheoId,
} from "@qdpl/db";
import { complete, loadPrompt, render, safeJson } from "@qdpl/llm";
import { add, QUEUES } from "@qdpl/queue";
import { defineStage } from "../stage.ts";
import { chaySinhCauHoi, dungNguCanh } from "./sinh-cau-hoi.ts";
import { chaySoanTuDong } from "./soan-tu-dong.ts";

/** Tên prompt tương ứng với từng bước; bước nào không có ở đây thì không gọi mô hình. */
const PROMPT_CUA_BUOC: Record<string, string> = {
  dan_y: "dao-tao/dan-y-chuyen-de",
  soan_bai: "dao-tao/soan-bai-hoc",
  sinh_bai_tap: "dao-tao/sinh-bai-tap",
  sinh_rubric: "dao-tao/sinh-bai-tap",
  soat_loi: "dao-tao/soat-bai",
};

/** Bước có kết quả được hậu kiểm và nhận được vào bản nháp của bài. */
const BUOC_SOAN_KHOI = "soan_bai";
const BUOC_SINH_BAI_TAP = ["sinh_bai_tap", "sinh_rubric"];

/** Dạng bài mặc định: trắc nghiệm đi vào ngân hàng câu hỏi chung, bài trong bài học là tự luận. */
const DANG_BAI_MAC_DINH = "viet_co_can_cu";

/**
 * Ngày dạng YYYY-MM-DD. Cột `date` của Postgres về tới đây là `Date`, nên không được `String()`
 * rồi cắt chuỗi: kết quả sẽ là "Thu Sep 24", không phải ngày.
 */
function ngayCua(v: unknown): string | undefined {
  if (!v) return undefined;
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

/** Thông điệp đưa cho mô hình khi không có nút nào: mô hình phải trả "chưa đủ căn cứ". */
function nguCanhRong(soUrn: number): string {
  return soUrn
    ? "(không tìm thấy nút nào trong kho tại thời điểm này)"
    : "(chưa có nút văn bản nào được cung cấp)";
}

/** Khối AI dạng `KhoiNoiDung` để chạy `kiemTraBaiHoc` (nhịp bài, thẻ căn cứ) trước khi nhận. */
function khoiDeKiem(ds: KhoiAi[]): KhoiNoiDung[] {
  return ds.map((k, i) => ({
    id: `ai-${i + 1}`,
    lessonId: "",
    ordinal: i + 1,
    kind: k.kind as KhoiNoiDung["kind"],
    data: k.data,
    citations: k.citations,
    citationHealth: "ok",
    source: "ai",
    status: "nhap",
    modes: [],
  }));
}

/** Kiểm căn cứ: URN nào không tồn tại, đã hết hiệu lực, hoặc chưa có hiệu lực tại `asOf`. */
export async function kiemCanCu(urns: string[], asOf: string) {
  const duyNhat = [...new Set(urns)];
  if (!duyNhat.length) return { tong: 0, ok: [], khongTonTai: [], khongHieuLuc: [] };
  const rows = await sql<Array<{ urn: string; hieu_luc: boolean }>>`
    SELECT n.urn,
           bool_or(v.valid_from <= ${asOf}::date AND (v.valid_to IS NULL OR v.valid_to >= ${asOf}::date)) AS hieu_luc
    FROM nodes n JOIN document_versions v ON v.id = n.version_id
    WHERE n.urn = ANY(${duyNhat}::text[])
    GROUP BY n.urn`;
  const thay = new Map(rows.map((r) => [r.urn, r.hieu_luc]));
  return {
    tong: duyNhat.length,
    ok: duyNhat.filter((u) => thay.get(u) === true),
    khongTonTai: duyNhat.filter((u) => !thay.has(u)),
    khongHieuLuc: duyNhat.filter((u) => thay.get(u) === false),
  };
}

export const soanBaiStage = defineStage(QUEUES.soanBai, async (job, ctx) => {
  const viec = await vieCSoanBaiTheoId(job.data.jobId);
  if (!viec) throw new Error(`Không có việc soạn bài ${job.data.jobId}`);
  if (viec.state === "xong") {
    return { skipped: true, reason: "việc đã xong", next: 0 };
  }

  /* ---- Sinh câu hỏi vào ngân hàng (GĐ8): tự ghi trạng thái việc, tự hậu kiểm ---- */
  if (viec.step === BUOC_SINH_CAU_HOI) {
    const kq = await chaySinhCauHoi(viec, ctx.progress);
    ctx.log.info("Đã sinh câu hỏi vào ngân hàng", { viecId: viec.id, ...kq });
    await ctx.progress(100, `${kq.so_nhan} câu chờ duyệt, ${kq.so_loai} câu bị loại`);
    return { next: 0, detail: { buoc: viec.step, ...kq } };
  }

  /* ---- Soạn cả chuyên đề từ văn bản: lập dàn ý, tạo bài nháp, giao việc con ---- */
  if (viec.step === BUOC_SOAN_TU_DONG) {
    const kq = await chaySoanTuDong(viec, ctx.progress);
    let daDay = 0;
    for (const jobId of kq.viec_con) {
      await add(QUEUES.soanBai, { jobId }, { key: jobId });
      daDay += 1;
    }
    ctx.log.info("Đã lập dàn ý và giao việc con", { viecId: viec.id, ...kq, daDay });
    await ctx.progress(100, `${kq.so_bai} bài, ${kq.so_viec_con} việc con`);
    return { next: daDay, detail: { buoc: viec.step, soBai: kq.so_bai, soViecCon: kq.so_viec_con } };
  }

  await batDauViecSoanBai(viec.id);
  await ctx.progress(10, `bước ${viec.step}`);

  const course = viec.course_id ? await chuyenDeTheoId(viec.course_id) : undefined;
  const bai = viec.lesson_id ? await baiHocTheoId(viec.lesson_id) : undefined;
  const asOf = ngayCua(bai?.as_of) ?? ngayCua(course?.as_of) ?? new Date().toISOString().slice(0, 10);
  const input = viec.input as Record<string, unknown>;

  try {
    /* ---- Bước không gọi mô hình: kiểm căn cứ ---- */
    if (viec.step === "kiem_can_cu") {
      if (!bai) throw new Error("Bước kiểm căn cứ cần một bài học cụ thể");
      const [khoiRows, hoatDong] = await Promise.all([khoiCuaBai(bai.id), hoatDongCuaBai(bai.id)]);
      const urns = [...khoiRows.flatMap((k) => k.citations), ...hoatDong.flatMap((a) => a.citations)];
      const bao = await kiemCanCu(urns, asOf);

      const khoi: KhoiNoiDung[] = khoiRows.map((k) => ({
        id: k.id,
        lessonId: k.lesson_id,
        ordinal: k.ordinal,
        kind: k.kind as KhoiNoiDung["kind"],
        data: k.data,
        citations: k.citations,
        citationHealth: k.citation_health as KhoiNoiDung["citationHealth"],
        source: k.source as KhoiNoiDung["source"],
        status: k.status as KhoiNoiDung["status"],
        modes: k.modes as KhoiNoiDung["modes"],
        note: k.note,
      }));
      const nhip = kiemTraBaiHoc(khoi);
      const loiRubric = hoatDong
        .filter((a) => a.mode === "ai" || a.mode === "nguoi")
        .flatMap((a) => kiemTraRubric(a.rubric).map((l) => `${a.title ?? a.kind}: ${l}`));

      // Bài đang xuất bản mà căn cứ hỏng thì đánh dấu ngay, không chờ ai để ý.
      const hong = bao.khongTonTai.length + bao.khongHieuLuc.length;
      await sql`
        UPDATE lessons SET citation_health = ${hong ? "broken" : "ok"}, updated_at = now()
        WHERE id = ${bai.id}::uuid`;
      if (hong && bai.status === "xuat_ban") {
        await sql`UPDATE lessons SET status = 'can_cap_nhat' WHERE id = ${bai.id}::uuid`;
      }

      const output = { canCu: bao, nhip: nhip.loi, rubric: loiRubric, asOf };
      await ketThucViecSoanBai(viec.id, { output });
      await ctx.progress(100, `${bao.ok.length}/${bao.tong} căn cứ hợp lệ`);
      return {
        ...(course?.id ? { documentId: course.id } : {}),
        next: 0,
        detail: { canCuHong: hong, nhip: nhip.loi.length },
      };
    }

    /* ---- Các bước gọi mô hình ---- */
    const tenPrompt = PROMPT_CUA_BUOC[viec.step];
    if (!tenPrompt) throw new Error(`Bước "${viec.step}" chưa có prompt`);
    const prompt = loadPrompt(tenPrompt);

    const laSinhBaiTap = BUOC_SINH_BAI_TAP.includes(viec.step);
    // Sinh bài tập cho một bài đã có nội dung: không nêu URN thì dùng các điều khoản bài đó viện dẫn.
    const khoiBai = bai && laSinhBaiTap ? await khoiCuaBai(bai.id) : [];
    const urnYeuCau =
      Array.isArray(input.urns) && input.urns.length
        ? (input.urns as unknown[]).map(String)
        : [...new Set(khoiBai.flatMap((k) => k.citations))];
    const dieuKhoan = urnYeuCau.length ? await dieuKhoanNguCanh(urnYeuCau, asOf) : [];
    const urnNguCanh = dieuKhoan.map((d) => d.urn);
    const nguCanh = dieuKhoan.length ? dungNguCanh(dieuKhoan) : nguCanhRong(urnYeuCau.length);
    await ctx.progress(35, `${urnNguCanh.length} nút vào ngữ cảnh`);

    const noiDungBai =
      String(input.noi_dung ?? "") || khoiBai.map((k) => `[${k.kind}] ${chuTrongKhoi(k)}`).join("\n");
    const maLoi = laSinhBaiTap ? await danhSachMaLoi() : [];
    const dangBai = Array.isArray(input.dang_bai)
      ? input.dang_bai.map(String).join(", ")
      : String(input.dang_bai ?? DANG_BAI_MAC_DINH);

    const kyNang = course ? await kyNangCuaChuyenDe(course.id) : [];
    const bien: Record<string, string | number> = {
      chuyen_de: course?.title ?? "",
      tieu_de: bai?.title ?? String(input.tieu_de ?? ""),
      doi_tuong: (course?.audience ?? []).join(", "),
      ky_nang: (bai?.skills ?? []).join(", ") || kyNang.map((k) => k.code).join(", "),
      as_of: asOf,
      vi_du: String(input.vi_du ?? ""),
      chu_de: String(input.chu_de ?? course?.title ?? ""),
      ket_qua: String(input.ket_qua ?? ""),
      so_bai: Number(input.so_bai ?? 12),
      so_cau: Number(input.so_cau ?? 4),
      muc: Number(input.muc ?? 1),
      ban_do_phap_ly: JSON.stringify(course?.legal_map ?? {}),
      ma_loi: String(input.ma_loi ?? "") || maLoi.map((m) => `${m.code} — ${m.name}`).join("\n"),
      noi_dung: noiDungBai,
      dang_bai: dangBai,
      ngu_canh: nguCanh,
    };

    const res = await complete({
      // Soạn bài là việc dài, nhiều ràng buộc — dùng tầng `bulk` và chạy chế độ batch.
      tier: "bulk",
      promptName: tenPrompt,
      promptVersion: prompt.version,
      cacheableSystem: prompt.system,
      user: render(prompt.user, bien),
      maxTokens: 12_000,
      batch: viec.batch,
    });
    await ctx.progress(85, "mô hình đã trả kết quả");

    const json = res.json ?? safeJson(res.text) ?? null;
    const output: Record<string, unknown> = {
      json,
      text: json ? undefined : res.text,
      asOf,
      urnNguCanh,
    };

    /* ---- Hậu kiểm tất định: phần qua hậu kiểm là phần quản trị viên nội dung nhận được vào bài ---- */
    if (viec.step === BUOC_SOAN_KHOI) {
      const doc = docKhoiAi(json);
      const hk = hauKiemKhoiAi(doc.khoi, {
        urnNguCanh,
        canCu: await tinhTrangCanCu(
          doc.khoi.flatMap((k) => k.citations),
          asOf,
        ),
        nguyenVan: new Map(dieuKhoan.map((d) => [d.urn, d.text])),
      });
      const nhip = kiemTraBaiHoc(khoiDeKiem(hk.khoi));
      Object.assign(output, {
        khoi: hk.khoi,
        biLoai: hk.biLoai,
        loiDoc: doc.loi,
        nhip: nhip.loi,
        phut: nhip.phut,
      });
    } else if (laSinhBaiTap) {
      const doc = docBaiTapAi(json);
      const hk = hauKiemBaiTapAi(doc.baiTap, {
        urnNguCanh,
        canCu: await tinhTrangCanCu(
          doc.baiTap.flatMap((b) => b.citations),
          asOf,
        ),
        maLoi: new Set(maLoi.map((m) => m.code)),
      });
      Object.assign(output, { baiTap: hk.baiTap, biLoai: hk.biLoai, loiDoc: doc.loi });
    }
    await ketThucViecSoanBai(viec.id, {
      output,
      model: res.model,
      promptVersion: prompt.version,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
      costUsd: res.costUsd,
    });

    ctx.log.info("Đã soạn xong bản đầu", {
      viecId: viec.id,
      buoc: viec.step,
      model: res.model,
      chiPhiUsd: res.costUsd,
    });

    // Việc con của một lần soạn tự động: nhận luôn vào BẢN NHÁP (không phải xuất bản). Nhận
    // không được (bài đã chuyển sang chờ duyệt, kết quả rỗng...) thì việc vẫn xong, biên tập
    // viên thấy nút nhận tay ở màn hình quản trị; lỗi lúc nhận không làm hỏng kết quả đã có.
    if (viec.auto_apply && (viec.step === BUOC_SOAN_KHOI || laSinhBaiTap)) {
      try {
        const nhan = await nhanKetQuaSoanBai(viec.id, viec.requested_by ?? "ai", "noi");
        if (!nhan.ok)
          ctx.log.warn("Không tự nhận được vào bản nháp", { viecId: viec.id, lyDo: nhan.thongDiep });
      } catch (e) {
        ctx.log.warn("Lỗi khi tự nhận vào bản nháp", { viecId: viec.id, loi: String(e) });
      }
    }
    await ctx.progress(100, "xong");

    return {
      ...(course?.id ? { documentId: course.id } : {}),
      // Không đẩy job kế tiếp: bước sau do quản trị viên nội dung (hoặc việc cha soạn tự động) quyết định.
      next: 0,
      detail: { buoc: viec.step, model: res.model, chiPhiUsd: res.costUsd },
    };
  } catch (e) {
    const loi = e instanceof Error ? e.message : String(e);
    await ketThucViecSoanBai(viec.id, { error: loi });
    // Ném lại để BullMQ thử lại có lùi thời gian; trạng thái `loi` đã ghi sổ cho màn hình quản trị.
    throw e;
  }
});
