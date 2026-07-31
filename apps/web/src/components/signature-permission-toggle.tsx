"use client";

/** Submits on change — same one-click pattern as every other admin switch. */
export function SignaturePermissionToggle({
  action,
  defaultChecked,
}: {
  action: (formData: FormData) => Promise<void>;
  defaultChecked: boolean;
}) {
  return (
    <form action={action}>
      <label className="flex items-center gap-1.5 text-xs text-stone-500">
        <input
          type="checkbox"
          name="membersCanEdit"
          defaultChecked={defaultChecked}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="accent-brand-600"
        />
        Members can edit these
      </label>
    </form>
  );
}
