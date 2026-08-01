import type { Contact } from "@freehold/db";
import {
  AddressBook,
  Envelope,
  Link as LinkIcon,
  Phone,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { MultiSelect } from "@/components/multi-select";
import { PhoneInput } from "@/components/phone-input";
import {
  type Address,
  GRADE_CADENCE,
  GRADES,
  type PersonFields,
  SUGGESTED_CATEGORIES,
} from "@/lib/crm";
import { btn, input, label } from "@/lib/ui";

/**
 * The dual-person contact form, shared by create and edit.
 *
 * Laid out the way a coordinator reads a contact: who they are and how to
 * reach them first, then where post goes, then the details that only matter
 * occasionally. Zero-JS — every group is a plain fieldset in one server-action
 * form, so it works before hydration and without a client bundle.
 *
 * The second person is the point of the record. Half a TC's contacts come with
 * an assistant or a spouse who has to be on every email, and giving them their
 * own contact would mean two records that drift apart. One record, two people,
 * both searchable, both mailed.
 */

const fieldCls = `${input} w-full`;

/** Section shell: a bold caption above a bordered panel, per the design. */
function Panel({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-900">
        {icon}
        {title}
      </p>
      <div className="rounded-lg border border-stone-200/80 bg-white p-4">{children}</div>
    </section>
  );
}

/** A labelled input that keeps its label above the box, as in the design. */
function Field({
  label: labelText,
  name,
  defaultValue,
  placeholder,
  type,
  maxLength,
  className = "",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  className?: string;
}) {
  return (
    <label className={`${label} ${className}`}>
      {labelText}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={maxLength}
        className={fieldCls}
      />
    </label>
  );
}

/**
 * One person's name, contact points, and job. Used twice — the contact and
 * whoever travels with them.
 */
function PersonBlock({
  prefix,
  values,
  extraEmails,
}: {
  prefix: "p" | "s";
  values: PersonFields | null;
  /** Only the primary person carries the overflow email slots. */
  extraEmails?: string[];
}) {
  const f = (k: keyof PersonFields) => values?.[k] ?? "";
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field
          label="Title"
          name={`${prefix}Title`}
          defaultValue={f("title")}
          placeholder="Mr / Ms"
        />
        <Field label="First" name={`${prefix}First`} defaultValue={f("first")} />
        <Field label="Middle" name={`${prefix}Middle`} defaultValue={f("middle")} />
        <Field label="Last" name={`${prefix}Last`} defaultValue={f("last")} />
        <Field label="Job title" name={`${prefix}JobTitle`} defaultValue={f("jobTitle")} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className={label}>
          <span className="flex items-center gap-1.5">
            <Phone size={13} className="text-stone-400" aria-hidden />
            Cell
          </span>
          <PhoneInput name={`${prefix}Cell`} defaultValue={f("cell")} className={fieldCls} />
        </label>
        <label className={label}>
          <span className="flex items-center gap-1.5">
            <Phone size={13} className="text-stone-400" aria-hidden />
            Work phone
          </span>
          <PhoneInput
            name={`${prefix}WorkPhone`}
            defaultValue={f("workPhone")}
            className={fieldCls}
          />
        </label>
        <label className={label}>
          <span className="flex items-center gap-1.5">
            <Envelope size={13} className="text-stone-400" aria-hidden />
            Email
          </span>
          <input
            name={`${prefix}Email`}
            type="email"
            defaultValue={f("email")}
            className={fieldCls}
          />
        </label>
      </div>

      {extraEmails && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1].map((i) => (
            <label key={`em-${i}`} className={label}>
              <span className="flex items-center gap-1.5">
                <Envelope size={13} className="text-stone-400" aria-hidden />
                Additional email
              </span>
              <input
                name="extraEmail"
                type="email"
                defaultValue={extraEmails[i] ?? ""}
                className={fieldCls}
              />
            </label>
          ))}
          <label className={label}>
            <span className="flex items-center gap-1.5">
              <Phone size={13} className="text-stone-400" aria-hidden />
              Additional phone
            </span>
            <PhoneInput name="extraPhone" defaultValue="" className={fieldCls} />
          </label>
        </div>
      )}
    </div>
  );
}

function AddressBlock({
  prefix,
  legend,
  values,
}: {
  prefix: "home" | "work";
  legend: string;
  values: Address | null;
}) {
  const f = (k: keyof Address) => values?.[k] ?? "";
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">{legend}</legend>
      <Field label="Line 1" name={`${prefix}Line1`} defaultValue={f("line1")} />
      <Field label="Line 2" name={`${prefix}Line2`} defaultValue={f("line2")} />
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
        <Field label="City" name={`${prefix}City`} defaultValue={f("city")} />
        <Field label="ST" name={`${prefix}State`} defaultValue={f("state")} maxLength={2} />
        <Field label="Zip" name={`${prefix}Zip`} defaultValue={f("zip")} />
      </div>
    </fieldset>
  );
}

export function ContactForm({
  action,
  contact,
  contacts,
  members,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  contact?: (Contact & { owners?: Array<{ userId: string }> }) | null;
  contacts: Array<{ id: string; name: string }>;
  members: Array<{ userId: string; name: string }>;
  submitLabel: string;
}) {
  const secondary = (contact?.secondary as PersonFields | null) ?? null;
  const primary: PersonFields | null = contact
    ? {
        title: contact.personTitle ?? undefined,
        first: contact.firstName ?? undefined,
        middle: contact.middleName ?? undefined,
        last: contact.lastName ?? undefined,
        jobTitle: contact.jobTitle ?? undefined,
        cell: contact.phone ?? undefined,
        workPhone: contact.workPhone ?? undefined,
        email: contact.email ?? undefined,
      }
    : null;
  const extra = (contact?.extraContacts as { phones?: string[]; emails?: string[] } | null) ?? null;
  const categories = contact?.categories ?? [];
  const allCategories = Array.from(new Set([...SUGGESTED_CATEGORIES, ...categories]));
  const mailing = contact?.mailingAddress === "home" ? "home" : "work";
  const ownerIds = contact?.owners?.map((o) => o.userId) ?? [];

  return (
    <form action={action} className="flex flex-col gap-5">
      {contact && <input type="hidden" name="id" value={contact.id} />}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <Panel
          title="Contact information"
          icon={<UserCircle size={15} weight="fill" className="text-stone-400" aria-hidden />}
        >
          <div className="flex flex-col gap-4">
            <PersonBlock prefix="p" values={primary} extraEmails={extra?.emails ?? []} />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Company" name="company" defaultValue={contact?.company ?? ""} />
              <Field label="Team name" name="teamName" defaultValue={contact?.teamName ?? ""} />
              <label className={label}>
                <span className="flex items-center gap-1.5">
                  <LinkIcon size={13} className="text-stone-400" aria-hidden />
                  Website
                </span>
                <input name="website" defaultValue={contact?.website ?? ""} className={fieldCls} />
              </label>
            </div>

            <div className="border-t border-stone-100 pt-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
                <UsersThree size={15} weight="fill" className="text-stone-400" aria-hidden />
                Second person
              </p>
              <p className="mb-3 mt-0.5 text-xs text-stone-500">
                Always tied to this contact — often an assistant or a spouse. They're included on
                every email to this contact, and searching finds the record by either name.
              </p>
              <PersonBlock prefix="s" values={secondary} />
            </div>

            <Field
              label="Fax"
              name="fax"
              defaultValue={contact?.fax ?? ""}
              className="sm:max-w-xs"
            />
          </div>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel
            title="Categories"
            icon={<AddressBook size={15} weight="fill" className="text-stone-400" aria-hidden />}
          >
            <input
              name="newCategory"
              placeholder="Type a new category…"
              className={fieldCls}
              defaultValue=""
            />
            <p className="mb-3 mt-1.5 text-xs text-stone-400">
              Comma-separate to add several at once.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {allCategories.map((c) => (
                <label
                  key={c}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-stone-200 px-2.5 py-1 text-xs has-checked:border-brand-600 has-checked:bg-brand-50 has-checked:text-brand-800"
                >
                  <input
                    type="checkbox"
                    name="categories"
                    value={c}
                    defaultChecked={categories.includes(c)}
                    className="h-3 w-3 accent-brand-600"
                  />
                  {c}
                </label>
              ))}
            </div>
          </Panel>

          <Panel title="Relationship rating">
            {/* A–D set how often somebody resurfaces for a touch; the last
                option opts them out entirely. */}
            <div className="grid grid-cols-5 gap-1">
              {GRADES.map((g) => (
                <label
                  key={g}
                  title={`Every ${GRADE_CADENCE[g]} days`}
                  className="flex cursor-pointer flex-col items-center rounded-md border border-stone-200 py-1.5 text-sm font-semibold text-stone-600 has-checked:border-brand-600 has-checked:bg-brand-50 has-checked:text-brand-800"
                >
                  <input
                    type="radio"
                    name="grade"
                    value={g}
                    defaultChecked={contact?.grade === g}
                    className="sr-only"
                  />
                  {g}
                </label>
              ))}
              <label
                title="No auto-prospecting"
                className="flex cursor-pointer flex-col items-center rounded-md border border-stone-200 py-1.5 text-sm text-stone-400 has-checked:border-stone-400 has-checked:bg-stone-100 has-checked:text-stone-700"
              >
                <input
                  type="radio"
                  name="grade"
                  value=""
                  defaultChecked={!contact?.grade}
                  className="sr-only"
                />
                <span aria-hidden>⊘</span>
                <span className="sr-only">Not rated</span>
              </label>
            </div>
            <p className="mt-2 text-xs text-stone-400">
              How often this contact comes back round for a touch — A every {GRADE_CADENCE.A} days
              through D every {GRADE_CADENCE.D}. Not rated means they never surface on their own.
            </p>
          </Panel>
        </div>
      </div>

      <Panel title="Mailing addresses">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-700">
              <input
                type="radio"
                name="mailingAddress"
                value="home"
                defaultChecked={mailing === "home"}
                className="accent-brand-600"
              />
              Home address
            </label>
            <AddressBlock
              prefix="home"
              legend="Home address"
              values={(contact?.homeAddress as Address | null) ?? null}
            />
          </div>
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-700">
              <input
                type="radio"
                name="mailingAddress"
                value="work"
                defaultChecked={mailing === "work"}
                className="accent-brand-600"
              />
              Work address
            </label>
            <AddressBlock
              prefix="work"
              legend="Work address"
              values={(contact?.workAddress as Address | null) ?? null}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-stone-400">
          The selected one is where post goes. Both are kept either way.
        </p>
      </Panel>

      <Panel title="Contact owners">
        <div className="sm:max-w-md">
          <MultiSelect
            name="ownerIds"
            label="Who covers this contact"
            placeholder="Add a coordinator…"
            defaultValue={ownerIds}
            options={members.map((m) => ({ value: m.userId, label: m.name }))}
          />
          <p className="mt-1.5 text-xs text-stone-400">
            More than one is fine — shared coverage and stand-ins are normal. Left empty, it's
            yours.
          </p>
        </div>
      </Panel>

      <Panel title="Other details">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Brokerage license"
                name="brokerageLicense"
                defaultValue={contact?.brokerageLicense ?? ""}
              />
              <Field
                label="Salesperson license"
                name="salespersonLicense"
                defaultValue={contact?.salespersonLicense ?? ""}
              />
            </div>
            <label className={label}>
              Notes
              <textarea
                name="notes"
                defaultValue={contact?.notes ?? ""}
                rows={4}
                placeholder="Initial contact note…"
                className={fieldCls}
              />
            </label>
          </div>

          <fieldset className="rounded-lg border border-stone-200/80 p-3">
            <legend className="px-1 text-sm font-medium text-stone-700">Who referred them?</legend>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="referralKind"
                  value="contact"
                  defaultChecked={Boolean(contact?.referredById)}
                  className="accent-brand-600"
                />
                A contact
              </label>
              <select
                name="referredById"
                defaultValue={contact?.referredById ?? ""}
                className={fieldCls}
              >
                <option value="">Choose…</option>
                {contacts
                  .filter((c) => c.id !== contact?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="referralKind"
                  value="source"
                  defaultChecked={Boolean(contact?.referralSource)}
                  className="accent-brand-600"
                />
                A source
              </label>
              <input
                name="referralSource"
                defaultValue={contact?.referralSource ?? ""}
                placeholder="Zillow, postcard campaign…"
                className={fieldCls}
              />
              <label className={label}>
                Referred on
                <input
                  type="date"
                  name="referralDate"
                  defaultValue={
                    contact?.referralDate ? contact.referralDate.toISOString().slice(0, 10) : ""
                  }
                  className={fieldCls}
                />
              </label>
            </div>
          </fieldset>
        </div>
      </Panel>

      <div>
        <button type="submit" className={btn}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
