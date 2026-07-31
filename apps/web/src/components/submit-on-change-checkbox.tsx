"use client";

/**
 * A checkbox that saves the moment it changes, for one-switch settings where
 * a separate Save button is more ceremony than the decision deserves.
 *
 * Must be rendered inside the <form> whose action it should submit. It exists
 * as a client component because a raw onChange handler can't be attached to
 * an element rendered by a server component.
 */
export function SubmitOnChangeCheckbox({
  id,
  name,
  defaultChecked,
  className = "accent-brand-600",
}: {
  /** Pair with the label's htmlFor — a server-rendered label can't see
   *  through this component boundary to find the input by nesting. */
  id: string;
  name: string;
  defaultChecked: boolean;
  className?: string;
}) {
  return (
    <input
      id={id}
      type="checkbox"
      name={name}
      defaultChecked={defaultChecked}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className={className}
    />
  );
}
