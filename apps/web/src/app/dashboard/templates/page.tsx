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
 * tabs sharing one folder-tree-plus-detail-pane pattern. Every tab keeps the
 * same shell (this header, the tabs, the tree) in place and only swaps the
 * detail pane when an item is selected — no tab ever navigates off this
 * page. Replaces the three previously separate pages (action plans, emails,
 * doc templates); the old action-plans list route redirects here.
 */
export default async function TemplatesHubPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    restored?: string;
    restoredLibrary?: string;
    folder?: string;
    templateId?: string;
    planId?: string;
    docId?: string;
    attachmentId?: string;
    dateId?: string;
  }>;
}) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const {
    tab: rawTab,
    restored,
    restoredLibrary,
    folder,
    templateId,
    planId,
    docId,
    attachmentId,
    dateId,
  } = await searchParams;
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
          isAdmin={isAdmin}
          restoredLibrary={restoredLibrary}
          planId={planId}
          folderParam={folder}
        />
      )}
      {tab === "emails" && (
        <TemplatesTabEmails
          tenantId={tenantId}
          isAdmin={isAdmin}
          restored={restored}
          templateId={templateId}
          folderParam={folder}
        />
      )}
      {tab === "attachments" && (
        <TemplatesTabAttachments
          tenantId={tenantId}
          isAdmin={isAdmin}
          attachmentId={attachmentId}
          folderParam={folder}
        />
      )}
      {tab === "dates" && (
        <TemplatesTabDates
          tenantId={tenantId}
          isAdmin={isAdmin}
          dateId={dateId}
          folderParam={folder}
        />
      )}
      {tab === "docs" && (
        <TemplatesTabDocs
          tenantId={tenantId}
          isAdmin={isAdmin}
          docId={docId}
          folderParam={folder}
        />
      )}
    </div>
  );
}
