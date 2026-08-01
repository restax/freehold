import { File, FileImage, FilePdf } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export interface DocTreeFile {
  id: string;
  filename: string;
  contentType: string;
}

export interface DocTreeFolder {
  transactionId: string;
  propertyAddress: string;
  files: DocTreeFile[];
}

function fileIcon(contentType: string) {
  if (contentType === "application/pdf") return FilePdf;
  if (contentType.startsWith("image/")) return FileImage;
  return File;
}

/**
 * The left pane of the document library: one folder per transaction, files
 * inside. Selection lives entirely in the `doc` query param — same
 * URL-driven pattern as TemplateTree — so picking a file is a normal link,
 * not client state, and the browser back button just works.
 */
export function DocumentTree({
  folders,
  selectedId,
  baseHref,
}: {
  folders: DocTreeFolder[];
  selectedId?: string;
  /** e.g. "/dashboard/documents?q=lease" — folder links append &doc=<id>. */
  baseHref: string;
}) {
  const joiner = baseHref.includes("?") ? "&" : "?";
  const hrefFor = (id: string) => `${baseHref}${joiner}doc=${id}`;

  // A handful of folders reads better fully open than as a wall of
  // collapsed one-liners the user has to click through to see anything.
  const expandAllByDefault = folders.length <= 6;

  return (
    <nav className="flex max-h-[75vh] w-64 shrink-0 flex-col gap-1 overflow-y-auto">
      {folders.map((folder) => {
        const isOpenByDefault = expandAllByDefault || folder.files.some((f) => f.id === selectedId);
        return (
          <details key={folder.transactionId} className="group" open={isOpenByDefault}>
            <summary className="flex cursor-pointer select-none items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-stone-400 hover:text-stone-600">
              <span className="inline-block transition-transform group-open:rotate-90">▸</span>
              <span className="truncate">{folder.propertyAddress.replace(" (Sample)", "")}</span>
              <span className="ml-auto font-normal normal-case text-stone-300">
                {folder.files.length}
              </span>
            </summary>
            <div className="ml-2.5 mt-0.5 flex flex-col gap-0.5 border-l border-stone-100 pl-2.5">
              {folder.files.map((f) => {
                const Icon = fileIcon(f.contentType);
                return (
                  <Link
                    key={f.id}
                    href={hrefFor(f.id)}
                    className={`flex items-center gap-1.5 truncate rounded-md px-2 py-1 text-sm transition-colors ${
                      f.id === selectedId
                        ? "bg-brand-50 font-medium text-brand-800"
                        : "text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <Icon size={14} className="shrink-0 text-stone-400" aria-hidden />
                    <span className="truncate">{f.filename}</span>
                  </Link>
                );
              })}
            </div>
          </details>
        );
      })}
    </nav>
  );
}
