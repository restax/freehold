"use client";

/**
 * A one-click file picker for a row that is waiting on a document.
 *
 * A bare `<input type="file">` per row renders as a wide "Choose File / no file
 * chosen" control plus a submit button — eight of those down a checklist is
 * most of the width of the tab spent on furniture. This is the same thing as a
 * single button: picking a file submits the form immediately, because on a row
 * that wants exactly one document there is nothing to confirm afterwards.
 */
export function UploadOnChange({
  label = "Upload",
  accept = "application/pdf,.pdf",
  ariaLabel,
}: {
  label?: string;
  accept?: string;
  ariaLabel?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 transition-colors hover:border-brand-300 hover:text-brand-700 focus-within:ring-2 focus-within:ring-brand-500">
      {label}
      <input
        name="file"
        type="file"
        accept={accept}
        required
        aria-label={ariaLabel ?? label}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="sr-only"
      />
    </label>
  );
}
