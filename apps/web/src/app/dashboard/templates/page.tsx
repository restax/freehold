import { TemplateHubTabs, type TemplateTab } from "@/components/template-hub-tabs";
import { TemplatesTabAttachments } from "@/components/templates-tab-attachments";
import { TemplatesTabDates } from "@/components/templates-tab-dates";
import { TemplatesTabDocs } from "@/components/templates-tab-docs";
import { TemplatesTabEmails } from "@/components/templates-tab-emails";
import { TemplatesTabTasks } from "@/components/templates-tab-tasks";
import { requireAdminTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const VALID_TABS: TemplateTab[] = ["tasks", "emails", "attachments", "dates", "docs"];

/**
 * The Templates hub: task templates (checklists), email templates, document
 * checklists, key-date sets, and PDF/letter templates, in one place — five
 * tabs sharing one groups-and-counts navigation pattern. Replaces the three
 * previously separate pages (action plans, emails, doc templates); the old
 * action-plans list route redirects here.
 */
export default async function TemplatesHubPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    group?: string;
    restored?: string;
    restoredLibrary?: string;
  }>;
}) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const { tab: rawTab, group, restored, restoredLibrary } = await searchParams;
  const tab: TemplateTab = VALID_TABS.includes(rawTab as TemplateTab)
    ? (rawTab as TemplateTab)
    : "tasks";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Templates</h1>
        <p className="text-sm text-stone-500">
          Everything reusable in one place — the starter library for a new workspace, and everything
          you build on top of it.
        </p>
      </div>

      <TemplateHubTabs active={tab} />

      {tab === "tasks" && (
        <TemplatesTabTasks
          tenantId={tenantId}
          groupParam={group}
          restoredLibrary={restoredLibrary}
        />
      )}
      {tab === "emails" && (
        <TemplatesTabEmails
          tenantId={tenantId}
          groupParam={group}
          isAdmin={isAdmin}
          restored={restored}
        />
      )}
      {tab === "attachments" && <TemplatesTabAttachments tenantId={tenantId} groupParam={group} />}
      {tab === "dates" && <TemplatesTabDates tenantId={tenantId} groupParam={group} />}
      {tab === "docs" && <TemplatesTabDocs tenantId={tenantId} groupParam={group} />}
    </div>
  );
}
