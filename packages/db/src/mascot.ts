/**
 * Truy vấn CSDL cho bộ nhân vật đồng hành (ke-hoach/09-b).
 *
 * Nhân vật, trang phục, hành động và ảnh đều là dữ liệu, nên phần lớn tệp này là CRUD.
 * Phần đáng chú ý nằm ở cuối: thống kê hiệu quả và cơ chế tự vô hiệu hoá một hành động khi
 * người học bắt đầu tắt mascot vì nó.
 */

import { sql } from "./client.ts";

/* ------------------------------------------------------------------ */
/* Nhân vật                                                            */
/* ------------------------------------------------------------------ */

export interface PersonaRow {
  id: string;
  code: string;
  full_name: string;
  nick_name: string;
  role_line: string;
  bio: string | null;
  audiences: string[];
  topics: string[];
  voice: Record<string, unknown>;
  palette: Record<string, string>;
  body: string;
  head_gear: string | null;
  default_prop: string;
  allowed_costumes: string[];
  character_sheet: string;
  enabled: boolean;
  is_default: boolean;
  ordinal: number;
}

export async function danhSachNhanVat(chiBat = false) {
  return await sql<PersonaRow[]>`
    SELECT * FROM mascot_personas WHERE (NOT ${chiBat} OR enabled) ORDER BY ordinal, code`;
}

export async function nhanVatTheoCode(code: string): Promise<PersonaRow | undefined> {
  const [row] = await sql<PersonaRow[]>`SELECT * FROM mascot_personas WHERE code = ${code} LIMIT 1`;
  return row;
}

export async function nhanVatTheoId(id: string): Promise<PersonaRow | undefined> {
  const [row] = await sql<PersonaRow[]>`SELECT * FROM mascot_personas WHERE id = ${id}::uuid LIMIT 1`;
  return row;
}

export interface LuuNhanVatInput {
  code: string;
  fullName: string;
  nickName: string;
  roleLine: string;
  bio?: string | null;
  audiences?: string[];
  topics?: string[];
  voice?: Record<string, unknown>;
  palette?: Record<string, string>;
  body?: string;
  headGear?: string | null;
  defaultProp?: string;
  allowedCostumes?: string[];
  characterSheet?: string;
  enabled?: boolean;
  isDefault?: boolean;
  ordinal?: number;
}

export async function luuNhanVat(inp: LuuNhanVatInput): Promise<PersonaRow> {
  return await sql.begin(async (tx) => {
    // Chỉ một nhân vật được là mặc định: bỏ cờ của nhân vật cũ trước khi đặt cờ mới,
    // nếu không chỉ mục duy nhất sẽ chặn và người vận hành không hiểu vì sao lưu hỏng.
    if (inp.isDefault) {
      await tx`UPDATE mascot_personas SET is_default = false WHERE is_default AND code <> ${inp.code}`;
    }
    const [row] = await tx<PersonaRow[]>`
      INSERT INTO mascot_personas (code, full_name, nick_name, role_line, bio, audiences, topics, voice,
                                   palette, body, head_gear, default_prop, allowed_costumes,
                                   character_sheet, enabled, is_default, ordinal)
      VALUES (${inp.code}, ${inp.fullName}, ${inp.nickName}, ${inp.roleLine}, ${inp.bio ?? null},
              ${inp.audiences ?? []}, ${inp.topics ?? []}, ${sql.json((inp.voice ?? {}) as never)},
              ${sql.json((inp.palette ?? {}) as never)}, ${inp.body ?? "thuoc"}, ${inp.headGear ?? null},
              ${inp.defaultProp ?? "khong"}, ${inp.allowedCostumes ?? []}, ${inp.characterSheet ?? ""},
              ${inp.enabled ?? true}, ${inp.isDefault ?? false}, ${inp.ordinal ?? 0})
      ON CONFLICT (code) DO UPDATE SET
        full_name = EXCLUDED.full_name, nick_name = EXCLUDED.nick_name, role_line = EXCLUDED.role_line,
        bio = EXCLUDED.bio, audiences = EXCLUDED.audiences, topics = EXCLUDED.topics,
        voice = EXCLUDED.voice, palette = EXCLUDED.palette, body = EXCLUDED.body,
        head_gear = EXCLUDED.head_gear, default_prop = EXCLUDED.default_prop,
        allowed_costumes = EXCLUDED.allowed_costumes, character_sheet = EXCLUDED.character_sheet,
        enabled = EXCLUDED.enabled, is_default = EXCLUDED.is_default, ordinal = EXCLUDED.ordinal,
        updated_at = now()
      RETURNING *`;
    return row!;
  });
}

export async function batTatNhanVat(id: string, bat: boolean) {
  const [row] = await sql<PersonaRow[]>`
    UPDATE mascot_personas SET enabled = ${bat}, updated_at = now() WHERE id = ${id}::uuid RETURNING *`;
  return row;
}

/* ------------------------------------------------------------------ */
/* Bàn giao theo ngữ cảnh                                              */
/* ------------------------------------------------------------------ */

export interface HandoffRow {
  id: string;
  context: string;
  persona_id: string;
  note: string | null;
  enabled: boolean;
}

export async function danhSachBanGiao() {
  return await sql<HandoffRow[]>`SELECT * FROM mascot_handoffs ORDER BY context`;
}

export async function banGiaoDangBat(): Promise<Map<string, string>> {
  const rows = await sql<HandoffRow[]>`SELECT * FROM mascot_handoffs WHERE enabled`;
  return new Map(rows.map((r) => [r.context, r.persona_id]));
}

export async function luuBanGiao(context: string, personaId: string, note?: string | null, enabled = true) {
  const [row] = await sql<HandoffRow[]>`
    INSERT INTO mascot_handoffs (context, persona_id, note, enabled)
    VALUES (${context}, ${personaId}::uuid, ${note ?? null}, ${enabled})
    ON CONFLICT (context) DO UPDATE SET persona_id = EXCLUDED.persona_id, note = EXCLUDED.note,
                                        enabled = EXCLUDED.enabled
    RETURNING *`;
  return row!;
}

/* ------------------------------------------------------------------ */
/* Hành động                                                           */
/* ------------------------------------------------------------------ */

export interface ActionRow {
  id: string;
  code: string;
  persona_id: string | null;
  trigger: string;
  conditions: unknown[];
  priority: number;
  cooldown_seconds: number;
  max_per_session: number;
  max_per_day: number;
  anchor: string;
  state: string;
  pose: string;
  costume: string | null;
  prop: string | null;
  effect: string;
  speech: unknown[];
  cta: Record<string, unknown> | null;
  audiences: string[];
  course_ids: string[];
  enabled: boolean;
  auto_disabled_at: Date | null;
  auto_disabled_reason: string | null;
}

export async function danhSachHanhDong(o: { trigger?: string; chiBat?: boolean } = {}) {
  return await sql<ActionRow[]>`
    SELECT * FROM mascot_actions
    WHERE (${o.trigger ?? null}::text IS NULL OR trigger = ${o.trigger ?? null}::text)
      AND (NOT ${o.chiBat ?? false} OR enabled)
    ORDER BY trigger, priority DESC, code`;
}

export async function hanhDongTheoCode(code: string): Promise<ActionRow | undefined> {
  const [row] = await sql<ActionRow[]>`SELECT * FROM mascot_actions WHERE code = ${code} LIMIT 1`;
  return row;
}

export interface LuuHanhDongInput {
  code: string;
  personaId?: string | null;
  trigger: string;
  conditions?: unknown[];
  priority?: number;
  cooldownSeconds?: number;
  maxPerSession?: number;
  maxPerDay?: number;
  anchor?: string;
  state?: string;
  pose?: string;
  costume?: string | null;
  prop?: string | null;
  effect?: string;
  speech?: unknown[];
  cta?: unknown;
  audiences?: string[];
  courseIds?: string[];
  enabled?: boolean;
}

export async function luuHanhDong(inp: LuuHanhDongInput): Promise<ActionRow> {
  const [row] = await sql<ActionRow[]>`
    INSERT INTO mascot_actions (code, persona_id, trigger, conditions, priority, cooldown_seconds,
                                max_per_session, max_per_day, anchor, state, pose, costume, prop, effect,
                                speech, cta, audiences, course_ids, enabled)
    VALUES (${inp.code}, ${inp.personaId ?? null}::uuid, ${inp.trigger},
            ${sql.json((inp.conditions ?? []) as never)}, ${inp.priority ?? 50},
            ${inp.cooldownSeconds ?? 180}, ${inp.maxPerSession ?? 3}, ${inp.maxPerDay ?? 10},
            ${inp.anchor ?? "goc_phai_duoi"}, ${inp.state ?? "binh_thuong"}, ${inp.pose ?? "dung"},
            ${inp.costume ?? null}, ${inp.prop ?? null}, ${inp.effect ?? "khong"},
            ${sql.json((inp.speech ?? []) as never)}, ${sql.json((inp.cta ?? {}) as never)},
            ${inp.audiences ?? []}, ${(inp.courseIds ?? []) as string[]}::uuid[], ${inp.enabled ?? true})
    ON CONFLICT (code) DO UPDATE SET
      persona_id = EXCLUDED.persona_id, trigger = EXCLUDED.trigger, conditions = EXCLUDED.conditions,
      priority = EXCLUDED.priority, cooldown_seconds = EXCLUDED.cooldown_seconds,
      max_per_session = EXCLUDED.max_per_session, max_per_day = EXCLUDED.max_per_day,
      anchor = EXCLUDED.anchor, state = EXCLUDED.state, pose = EXCLUDED.pose,
      costume = EXCLUDED.costume, prop = EXCLUDED.prop, effect = EXCLUDED.effect,
      speech = EXCLUDED.speech, cta = EXCLUDED.cta, audiences = EXCLUDED.audiences,
      course_ids = EXCLUDED.course_ids, enabled = EXCLUDED.enabled, updated_at = now()
    RETURNING *`;
  return row!;
}

export async function batTatHanhDong(id: string, bat: boolean, lyDo?: string | null) {
  const [row] = await sql<ActionRow[]>`
    UPDATE mascot_actions SET enabled = ${bat},
      auto_disabled_at = ${bat ? null : sql`now()`},
      auto_disabled_reason = ${bat ? null : (lyDo ?? null)},
      updated_at = now()
    WHERE id = ${id}::uuid RETURNING *`;
  return row;
}

export async function xoaHanhDong(id: string) {
  await sql`DELETE FROM mascot_actions WHERE id = ${id}::uuid`;
}

/* ------------------------------------------------------------------ */
/* Ảnh nhân vật                                                        */
/* ------------------------------------------------------------------ */

export interface AssetRow {
  id: string;
  persona_id: string;
  kind: string;
  state: string;
  costume: string;
  pose: string;
  prop: string;
  effect: string;
  uri: string;
  format: string;
  width: number | null;
  height: number | null;
  status: string;
  model: string | null;
  seed: string | null;
  prompt: string | null;
  spec: Record<string, unknown>;
  cost_usd: string;
  job_id: string | null;
  created_by: string | null;
  approved_by: string | null;
  reject_reason: string | null;
  created_at: Date;
}

export async function danhSachAnh(
  o: { personaId?: string; kind?: string; status?: string; limit?: number } = {},
) {
  return await sql<AssetRow[]>`
    SELECT * FROM mascot_assets
    WHERE (${o.personaId ?? null}::uuid IS NULL OR persona_id = ${o.personaId ?? null}::uuid)
      AND (${o.kind ?? null}::text IS NULL OR kind = ${o.kind ?? null}::text)
      AND (${o.status ?? null}::text IS NULL OR status = ${o.status ?? null}::text)
    ORDER BY created_at DESC LIMIT ${o.limit ?? 200}`;
}

export async function themAnh(p: {
  personaId: string;
  kind: string;
  state?: string;
  costume?: string;
  pose?: string;
  prop?: string;
  effect?: string;
  uri: string;
  format?: string;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  model?: string | null;
  seed?: string | null;
  promptVersion?: string | null;
  prompt?: string | null;
  spec?: unknown;
  costUsd?: number;
  jobId?: string | null;
  createdBy?: string | null;
  status?: string;
}): Promise<AssetRow> {
  const [row] = await sql<AssetRow[]>`
    INSERT INTO mascot_assets (persona_id, kind, state, costume, pose, prop, effect, uri, format,
                               width, height, bytes, model, seed, prompt_version, prompt, spec,
                               cost_usd, job_id, created_by, status)
    VALUES (${p.personaId}::uuid, ${p.kind}, ${p.state ?? "binh_thuong"}, ${p.costume ?? "thuong_ngay"},
            ${p.pose ?? "dung"}, ${p.prop ?? "khong"}, ${p.effect ?? "khong"}, ${p.uri},
            ${p.format ?? "png"}, ${p.width ?? null}, ${p.height ?? null}, ${p.bytes ?? null},
            ${p.model ?? null}, ${p.seed ?? null}, ${p.promptVersion ?? null}, ${p.prompt ?? null},
            ${sql.json((p.spec ?? {}) as never)}, ${p.costUsd ?? 0}, ${p.jobId ?? null}::uuid,
            ${p.createdBy ?? null}, ${p.status ?? "cho_duyet"})
    RETURNING *`;
  return row!;
}

/**
 * Đổi tình trạng duyệt của một ảnh.
 * Đặt làm ảnh chính thì ảnh chính cũ của CÙNG tổ hợp tự lùi về `duyet` — chỉ mục duy nhất
 * trong CSDL sẽ từ chối hai ảnh chính, nên phải hạ ảnh cũ trong cùng một giao dịch.
 */
export async function datTinhTrangAnh(id: string, status: string, boi: string, lyDo?: string | null) {
  return await sql.begin(async (tx) => {
    if (status === "dung_chinh") {
      const [a] = await tx<AssetRow[]>`SELECT * FROM mascot_assets WHERE id = ${id}::uuid`;
      if (!a) return undefined;
      await tx`
        UPDATE mascot_assets SET status = 'duyet'
        WHERE status = 'dung_chinh' AND id <> ${id}::uuid
          AND persona_id = ${a.persona_id}::uuid AND kind = ${a.kind}
          AND state = ${a.state} AND costume = ${a.costume}`;
    }
    const [row] = await tx<AssetRow[]>`
      UPDATE mascot_assets SET status = ${status},
        approved_by = ${status === "tu_choi" ? null : boi},
        approved_at = ${status === "tu_choi" ? null : sql`now()`},
        reject_reason = ${lyDo ?? null}
      WHERE id = ${id}::uuid RETURNING *`;
    return row;
  });
}

export async function xoaAnh(id: string) {
  await sql`DELETE FROM mascot_assets WHERE id = ${id}::uuid`;
}

/* ------------------------------------------------------------------ */
/* Lô sinh ảnh                                                         */
/* ------------------------------------------------------------------ */

export interface RenderJobRow {
  id: string;
  persona_id: string;
  spec: Record<string, unknown>;
  total: number;
  done: number;
  failed: number;
  state: string;
  model: string | null;
  cost_usd: string;
  budget_usd: string | null;
  error: string | null;
  requested_by: string | null;
  created_at: Date;
}

export async function taoLoSinhAnh(p: {
  personaId: string;
  spec: unknown;
  total: number;
  model?: string | null;
  budgetUsd?: number | null;
  requestedBy?: string | null;
}): Promise<RenderJobRow> {
  const [row] = await sql<RenderJobRow[]>`
    INSERT INTO mascot_render_jobs (persona_id, spec, total, model, budget_usd, requested_by)
    VALUES (${p.personaId}::uuid, ${sql.json((p.spec ?? {}) as never)}, ${p.total},
            ${p.model ?? null}, ${p.budgetUsd ?? null}, ${p.requestedBy ?? null})
    RETURNING *`;
  return row!;
}

export async function loSinhAnhTheoId(id: string): Promise<RenderJobRow | undefined> {
  const [row] = await sql<RenderJobRow[]>`SELECT * FROM mascot_render_jobs WHERE id = ${id}::uuid LIMIT 1`;
  return row;
}

export async function danhSachLoSinhAnh(limit = 30) {
  return await sql<RenderJobRow[]>`
    SELECT * FROM mascot_render_jobs ORDER BY created_at DESC LIMIT ${limit}`;
}

export async function capNhatLoSinhAnh(
  id: string,
  p: { state?: string; done?: number; failed?: number; costUsd?: number; error?: string | null },
) {
  const [row] = await sql<RenderJobRow[]>`
    UPDATE mascot_render_jobs SET
      state = COALESCE(${p.state ?? null}, state),
      done = COALESCE(${p.done ?? null}::int, done),
      failed = COALESCE(${p.failed ?? null}::int, failed),
      cost_usd = COALESCE(${p.costUsd ?? null}, cost_usd),
      error = ${p.error ?? null},
      started_at = CASE WHEN ${p.state ?? ""} = 'dang_chay' THEN COALESCE(started_at, now()) ELSE started_at END,
      finished_at = CASE WHEN ${p.state ?? ""} IN ('xong', 'loi', 'huy') THEN now() ELSE finished_at END
    WHERE id = ${id}::uuid RETURNING *`;
  return row;
}

/* ------------------------------------------------------------------ */
/* Sự kiện và hiệu quả                                                 */
/* ------------------------------------------------------------------ */

export async function ghiSuKienMascot(p: {
  enrollmentId?: string | null;
  actionId?: string | null;
  personaId?: string | null;
  trigger: string;
  lessonId?: string | null;
  outcome?: string;
}) {
  await sql`
    INSERT INTO mascot_events (enrollment_id, action_id, persona_id, trigger, lesson_id, outcome)
    VALUES (${p.enrollmentId ?? null}::uuid, ${p.actionId ?? null}::uuid, ${p.personaId ?? null}::uuid,
            ${p.trigger}, ${p.lessonId ?? null}::uuid, ${p.outcome ?? "hien"})`;
}

export interface SoLieuHanhDongRow {
  action_id: string;
  code: string;
  trigger: string;
  hien: number;
  bam_cta: number;
  dong: number;
  tat_mascot: number;
}

export async function soLieuHanhDong() {
  return await sql<SoLieuHanhDongRow[]>`
    SELECT a.id AS action_id, a.code, a.trigger,
           count(*) FILTER (WHERE e.outcome = 'hien')::int        AS hien,
           count(*) FILTER (WHERE e.outcome = 'bam_cta')::int     AS bam_cta,
           count(*) FILTER (WHERE e.outcome = 'dong')::int        AS dong,
           count(*) FILTER (WHERE e.outcome = 'tat_mascot')::int  AS tat_mascot
    FROM mascot_actions a LEFT JOIN mascot_events e ON e.action_id = a.id
    GROUP BY a.id, a.code, a.trigger
    ORDER BY hien DESC`;
}

/**
 * So sánh nhóm bật mascot với nhóm tắt mascot (09-b §9).
 * Đây là chỉ số quyết định: nếu nhóm bật không hoàn thành bài tốt hơn thì mascot đang vô
 * ích hoặc gây hại, và tài liệu yêu cầu nói thẳng điều đó trên màn hình quản trị.
 */
export async function hieuQuaMascot(courseId?: string) {
  const rows = await sql<
    Array<{ nhom: string; so_nguoi: number; ty_le_xong: string; diem_tb: string | null }>
  >`
    WITH e AS (
      SELECT en.id, CASE WHEN en.mascot_level = 'tat' THEN 'tat' ELSE 'bat' END AS nhom, en.course_id
      FROM enrollments en
      WHERE (${courseId ?? null}::uuid IS NULL OR en.course_id = ${courseId ?? null}::uuid)
    ),
    tong AS (SELECT course_id, count(*)::int AS n FROM lessons WHERE status = 'xuat_ban' GROUP BY 1),
    xong AS (
      SELECT p.enrollment_id, count(*) FILTER (WHERE p.state = 'xong')::int AS n
      FROM lesson_progress p GROUP BY 1
    )
    SELECT e.nhom,
           count(*)::int AS so_nguoi,
           COALESCE(avg(CASE WHEN t.n > 0 THEN LEAST(1.0, COALESCE(x.n, 0)::numeric / t.n) ELSE 0 END), 0)::text AS ty_le_xong,
           (SELECT avg(a.score / NULLIF(a.max_score, 0))::text FROM attempts a WHERE a.enrollment_id IN (SELECT id FROM e e2 WHERE e2.nhom = e.nhom)) AS diem_tb
    FROM e
    LEFT JOIN xong x ON x.enrollment_id = e.id
    LEFT JOIN tong t ON t.course_id = e.course_id
    GROUP BY e.nhom`;
  const lay = (n: string) => rows.find((r) => r.nhom === n);
  const bat = lay("bat");
  const tat = lay("tat");
  const tyLeBat = Number(bat?.ty_le_xong ?? 0);
  const tyLeTat = Number(tat?.ty_le_xong ?? 0);
  return {
    bat: { soNguoi: bat?.so_nguoi ?? 0, tyLeXong: tyLeBat, diemTb: Number(bat?.diem_tb ?? 0) },
    tat: { soNguoi: tat?.so_nguoi ?? 0, tyLeXong: tyLeTat, diemTb: Number(tat?.diem_tb ?? 0) },
    chenhLech: Number((tyLeBat - tyLeTat).toFixed(3)),
    // Chỉ kết luận khi cả hai nhóm đủ người; dưới ngưỡng này mọi chênh lệch là nhiễu.
    duDuLieu: (bat?.so_nguoi ?? 0) >= 20 && (tat?.so_nguoi ?? 0) >= 20,
  };
}

/* ------------------------------------------------------------------ */
/* Cài đặt toàn cục                                                    */
/* ------------------------------------------------------------------ */

export interface MascotSettingsRow {
  enabled: boolean;
  default_level: string;
  max_per_session: number;
  min_gap_seconds: number;
  motion: boolean;
  sound: boolean;
}

export async function caiDatMascot(): Promise<MascotSettingsRow> {
  const [row] = await sql<MascotSettingsRow[]>`SELECT * FROM mascot_settings WHERE id = 1`;
  return (
    row ?? {
      enabled: true,
      default_level: "day_du",
      max_per_session: 8,
      min_gap_seconds: 180,
      motion: true,
      sound: false,
    }
  );
}

export async function luuCaiDatMascot(
  p: Partial<MascotSettingsRow> & { updatedBy?: string | null },
): Promise<MascotSettingsRow> {
  const [row] = await sql<MascotSettingsRow[]>`
    INSERT INTO mascot_settings (id, enabled, default_level, max_per_session, min_gap_seconds, motion, sound, updated_by)
    VALUES (1, ${p.enabled ?? true}, ${p.default_level ?? "day_du"}, ${p.max_per_session ?? 8},
            ${p.min_gap_seconds ?? 180}, ${p.motion ?? true}, ${p.sound ?? false}, ${p.updatedBy ?? null})
    ON CONFLICT (id) DO UPDATE SET
      enabled = EXCLUDED.enabled, default_level = EXCLUDED.default_level,
      max_per_session = EXCLUDED.max_per_session, min_gap_seconds = EXCLUDED.min_gap_seconds,
      motion = EXCLUDED.motion, sound = EXCLUDED.sound, updated_by = EXCLUDED.updated_by,
      updated_at = now()
    RETURNING *`;
  return row!;
}
