import { z } from "zod";
export const ngayTraCuuSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return Number(s.slice(0, 4)) > 0 && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Ngày không tồn tại trên lịch");
