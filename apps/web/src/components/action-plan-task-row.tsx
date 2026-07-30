"use client";

import {
  ArrowBendDownRight,
  Bell,
  CalendarBlank,
  Envelope,
  Eye,
  Flag,
  NotePencil,
  Paperclip,
  Phone,
  UserCircle,
} from "@phosphor-icons/react";
import type { ActionPlanTaskRow } from "@/components/action-plan-task-grid";
import { dateRuleText } from "@/lib/task-template-labels";

/**
 * The read-only face of a task template entry: what it is, when it lands,
 * and which of its optional settings are switched on.
 *
 * The settings are shown as icons rather than columns because most entries
 * use almost none of them — a grid wide enough to hold every flag would be
 * mostly empty cells, and the two or three that matter on a given row would
 * be lost in them. An icon that isn't there means "off", which is both
 * quieter and faster to scan than fourteen unchecked boxes.
 */

const KIND_ICON = { TODO: NotePencil, EMAIL: Envelope, CALL: Phone } as const;
const KIND_LABEL = { TODO: "To-do", EMAIL: "Email", CALL: "Call" } as const;

const SIDE_LABEL: Record<string, string> = {
  BUY_SIDE: "Buy",
  SELL_SIDE: "Sell",
  DUAL: "Dual",
};

const ROLE_LABEL: Record<string, string> = { TC1: "TC 1", TC2: "TC 2", AGENT: "Agent" };

const chip =
  "rounded-full border border-stone-200 bg-stone-50 px-1.5 py-px text-[11px] font-medium text-stone-600";

function portalTooltip(agent: boolean, client: boolean): string {
  if (agent && client) return "Visible in the agent and client portals";
  return agent ? "Visible in the agent portal" : "Visible in the client portal";
}

export function ActionPlanTaskSummary({
  task,
  dependsOnTitle,
  emailTemplateName,
  attachedCount,
}: {
  task: ActionPlanTaskRow;
  dependsOnTitle: string | null;
  emailTemplateName: string | null;
  attachedCount: number;
}) {
  const KindIcon = KIND_ICON[task.kind as keyof typeof KIND_ICON] ?? NotePencil;
  const kindLabel = KIND_LABEL[task.kind as keyof typeof KIND_LABEL] ?? "To-do";

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
      <span title={kindLabel} className="shrink-0 text-stone-400">
        <KindIcon size={15} aria-label={kindLabel} />
      </span>
      <span className="truncate text-sm font-medium text-stone-800">{task.title}</span>

      <span className="text-xs text-stone-500">
        {dateRuleText(task.anchor, task.offsetDays, dependsOnTitle)}
      </span>

      {task.sides.map((s) => (
        <span key={s} className={chip}>
          {SIDE_LABEL[s] ?? s}
        </span>
      ))}
      {task.assigneeRole && (
        <span className={`${chip} inline-flex items-center gap-1`}>
          <UserCircle size={11} weight="bold" />
          {ROLE_LABEL[task.assigneeRole] ?? task.assigneeRole}
        </span>
      )}
      {emailTemplateName && (
        <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-1.5 py-px text-[11px] font-medium text-brand-800">
          <Envelope size={11} weight="bold" />
          {emailTemplateName}
        </span>
      )}
      {attachedCount > 0 && (
        <span className={`${chip} inline-flex items-center gap-1`} title="Templates attached">
          <Paperclip size={11} weight="bold" />
          {attachedCount}
        </span>
      )}

      <span className="ml-auto flex shrink-0 items-center gap-1.5 text-stone-400">
        {task.milestone && (
          <span title="Milestone — stands out on the calendar and timeline">
            <Flag size={13} weight="fill" className="text-amber-500" />
          </span>
        )}
        {task.onCalendar && (
          <span title="Shows on the calendar">
            <CalendarBlank size={13} />
          </span>
        )}
        {task.reminderDays != null && (
          <span
            title={`Reminder ${task.reminderDays} day${task.reminderDays === 1 ? "" : "s"} before it's due`}
          >
            <Bell size={13} />
          </span>
        )}
        {task.notes && (
          <span title={task.notes}>
            <NotePencil size={13} />
          </span>
        )}
        {(task.visibleToAgent || task.visibleToClient) && (
          <span title={portalTooltip(task.visibleToAgent, task.visibleToClient)}>
            <Eye size={13} />
          </span>
        )}
        {task.dependsOnId && (
          <span title={dependsOnTitle ? `Waits on “${dependsOnTitle}”` : "Waits on another task"}>
            <ArrowBendDownRight size={13} />
          </span>
        )}
      </span>
    </div>
  );
}
