import { PhoneInput } from "@/components/phone-input";
import {
  type FormCell,
  type FormField,
  type FormLayout,
  isField,
  MAX_CELLS_PER_ROW,
} from "@/lib/form-schema";

/**
 * Renders a designed form as plain HTML inputs — no JavaScript.
 *
 * These are filled in by strangers on their phones, often on bad
 * connections, so the public form is a server-rendered <form> that posts to
 * a server action. The designer is the only part of this feature that ships
 * a client bundle.
 *
 * Field names are namespaced `f_<key>`, and a "party" cell posts three
 * inputs (`f_<key>.name` / `.email` / `.phone`) that the submit action
 * reassembles — so one cell stays one answer.
 */

const inputCls =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-[15px] text-stone-900 shadow-xs transition-colors placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20";

function FieldLabel({ field }: { field: FormField }) {
  return (
    <span className="flex items-baseline gap-1 text-sm font-medium text-stone-800">
      {field.label}
      {field.required && (
        <span aria-hidden className="text-red-600">
          *
        </span>
      )}
      {field.required && <span className="sr-only">(required)</span>}
    </span>
  );
}

function FieldInput({ field, defaultValue }: { field: FormField; defaultValue?: unknown }) {
  const name = `f_${field.key}`;
  const common = {
    id: name,
    name,
    required: field.required,
    placeholder: field.placeholder,
    className: inputCls,
  };
  const asString = typeof defaultValue === "string" ? defaultValue : undefined;

  switch (field.type) {
    case "textarea":
      return <textarea {...common} rows={4} defaultValue={asString} />;
    case "select":
      return (
        <select {...common} defaultValue={asString ?? ""}>
          <option value="" disabled>
            Choose…
          </option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "checkbox":
      return (
        <input
          id={name}
          name={name}
          type="checkbox"
          required={field.required}
          defaultChecked={defaultValue === true}
          className="mt-1 h-4 w-4 accent-brand-600"
        />
      );
    case "file":
      return (
        <input
          id={name}
          name={name}
          type="file"
          required={field.required}
          className="w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
        />
      );
    case "party": {
      const p = (defaultValue ?? {}) as Record<string, string>;
      return (
        <span className="grid gap-2 sm:grid-cols-3">
          <input
            name={`${name}.name`}
            required={field.required}
            placeholder="Name"
            defaultValue={p.name}
            className={inputCls}
            aria-label={`${field.label} — name`}
          />
          <input
            name={`${name}.email`}
            type="email"
            placeholder="Email"
            defaultValue={p.email}
            className={inputCls}
            aria-label={`${field.label} — email`}
          />
          <PhoneInput
            name={`${name}.phone`}
            placeholder="Phone"
            defaultValue={p.phone}
            className={inputCls}
            aria-label={`${field.label} — phone`}
          />
        </span>
      );
    }
    default:
      if (field.type === "tel") {
        return <PhoneInput {...common} defaultValue={asString} />;
      }
      return (
        <input
          {...common}
          type={field.type === "email" ? "email" : field.type === "date" ? "date" : "text"}
          inputMode={field.type === "number" ? "numeric" : undefined}
          defaultValue={asString}
        />
      );
  }
}

function Cell({
  cell,
  values,
  errors,
}: {
  cell: FormCell;
  values: Record<string, unknown>;
  errors: Record<string, string>;
}) {
  if (!isField(cell)) {
    if (cell.type === "divider") return <hr className="my-1 border-stone-200" />;
    if (cell.type === "heading")
      return <h2 className="text-base font-semibold text-stone-900">{cell.text}</h2>;
    return <p className="text-sm leading-relaxed text-stone-600">{cell.text}</p>;
  }
  const error = errors[cell.key];
  const describedBy = [cell.help ? `f_${cell.key}_help` : null, error ? `f_${cell.key}_err` : null]
    .filter(Boolean)
    .join(" ");

  // A checkbox reads better with its label beside it than above it.
  if (cell.type === "checkbox") {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={`f_${cell.key}`} className="flex items-start gap-2">
          <FieldInput field={cell} defaultValue={values[cell.key]} />
          <FieldLabel field={cell} />
        </label>
        {cell.help && (
          <p id={`f_${cell.key}_help`} className="text-xs text-stone-500">
            {cell.help}
          </p>
        )}
        {error && (
          <p id={`f_${cell.key}_err`} className="text-xs font-medium text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`f_${cell.key}`} className="flex flex-col gap-1.5">
        <FieldLabel field={cell} />
        <span aria-describedby={describedBy || undefined}>
          <FieldInput field={cell} defaultValue={values[cell.key]} />
        </span>
      </label>
      {cell.help && (
        <p id={`f_${cell.key}_help`} className="text-xs text-stone-500">
          {cell.help}
        </p>
      )}
      {error && (
        <p id={`f_${cell.key}_err`} className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The body of a form. The caller supplies the <form> element, its action,
 * any hidden fields, and the submit button, so the same layout renders on
 * the public site, in a portal, and in a preview.
 */
export function FormBody({
  layout,
  values = {},
  errors = {},
}: {
  layout: FormLayout;
  values?: Record<string, unknown>;
  errors?: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {layout.rows.map((row) => (
        <div
          key={row.id}
          className={
            row.cells.length === MAX_CELLS_PER_ROW
              ? "grid gap-4 sm:grid-cols-2"
              : "grid gap-4 grid-cols-1"
          }
        >
          {row.cells.map((cell) => (
            <Cell key={cell.id} cell={cell} values={values} errors={errors} />
          ))}
        </div>
      ))}
    </div>
  );
}
