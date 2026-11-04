import type { ReactNode } from "react";

import { cn } from "../../lib/cn";
import {
  DOC_STATUS_LABEL,
  DOC_STATUS_TONE,
  NODE_STATUS_LABEL,
  NODE_STATUS_TONE,
  type Tone,
} from "../../lib/format";
import type { DocStatus, NodeStatus } from "../../lib/types";

const TONE: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  muted: "bg-muted-soft text-muted",
};

export function Badge({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 break-words rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONE[tone],
      )}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

/** Trạng thái hiệu lực của văn bản. */
export function StatusBadge({ status }: { status: DocStatus }) {
  return <Badge tone={DOC_STATUS_TONE[status]}>{DOC_STATUS_LABEL[status]}</Badge>;
}

/** Trạng thái của một điều/khoản/điểm; nút đang áp dụng bình thường thì không hiện gì. */
export function NodeStatusBadge({ status }: { status: NodeStatus }) {
  if (status === "active") return null;
  return <Badge tone={NODE_STATUS_TONE[status]}>{NODE_STATUS_LABEL[status]}</Badge>;
}
