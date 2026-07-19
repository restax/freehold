import type { Contact } from "@freehold/db";
import {
  type Address,
  GRADE_CADENCE,
  GRADES,
  MONTHS,
  type MonthDay,
  type PersonFields,
  SUGGESTED_CATEGORIES,
  type TouchDates,
} from "@/lib/crm";
import { btn, card, input, label } from "@/lib/ui";

/**
 * The dual-person contact entry form, shared by create and edit. Card-based
 * sections, zero-JS server-action submit; conditional groups use <details>
 * so everything works without a client bundle.
 */

function PersonGrid({
  prefix,
  legend,
  values,
}: {
  prefix: "p" | "s";
  legend: string;
  values: PersonFields | null;
}) {
  const f = (k: keyof PersonFields) => values?.[k] ?? "";
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
        {legend}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={label}>
          Title
          <input
            name={`${prefix}Title`}
            defaultValue={f("title")}
            placeholder="Mr / Ms / Dr"
            className={input}
          />
        </label>
        <label className={label}>
          First name
          <input name={`${prefix}First`} defaultValue={f("first")} className={input} />
        </label>
        <label className={label}>
          Middle
          <input name={`${prefix}Middle`} defaultValue={f("middle")} className={input} />
        </label>
        <label className={label}>
          Last name
          <input name={`${prefix}Last`} defaultValue={f("last")} className={input} />
        </label>
        <label className={label}>
          Job title
          <input name={`${prefix}JobTitle`} defaultValue={f("jobTitle")} className={input} />
        </label>
        <label className={label}>
          Cell phone
          <input name={`${prefix}Cell`} defaultValue={f("cell")} className={input} />
        </label>
        <label className={label}>
          Work phone
          <input name={`${prefix}WorkPhone`} defaultValue={f("workPhone")} className={input} />
        </label>
        <label className={label}>
          Email
          <input name={`${prefix}Email`} type="email" defaultValue={f("email")} className={input} />
        </label>
      </div>
    </fieldset>
  );
}

function AddressGrid({
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
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
        {legend}
      </legend>
      <div className="grid gap-3 sm:grid-cols-6">
        <label className={`${label} sm:col-span-3`}>
          Line 1
          <input name={`${prefix}Line1`} defaultValue={f("line1")} className={input} />
        </label>
        <label className={`${label} sm:col-span-3`}>
          Line 2
          <input name={`${prefix}Line2`} defaultValue={f("line2")} className={input} />
        </label>
        <label className={`${label} sm:col-span-3`}>
          City
          <input name={`${prefix}City`} defaultValue={f("city")} className={input} />
        </label>
        <label className={label}>
          ST
          <input
            name={`${prefix}State`}
            defaultValue={f("state")}
            maxLength={2}
            className={input}
          />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Zip
          <input name={`${prefix}Zip`} defaultValue={f("zip")} className={input} />
        </label>
      </div>
    </fieldset>
  );
}

function MonthDayRow({
  prefix,
  labelText,
  value,
}: {
  prefix: string;
  labelText: string;
  value: MonthDay | undefined;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <span className="w-44 text-sm font-medium text-stone-700">{labelText}</span>
      <label className={label}>
        <span className="sr-only">{labelText} month</span>
        <select name={`${prefix}M`} defaultValue={value?.m ?? ""} className={`${input} w-32`}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        <span className="sr-only">{labelText} day</span>
        <select name={`${prefix}D`} defaultValue={value?.d ?? ""} className={`${input} w-20`}>
          <option value="">Day</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        <span className="sr-only">{labelText} year (optional)</span>
        <input
          name={`${prefix}Y`}
          defaultValue={value?.y ?? ""}
          placeholder="Year (opt.)"
          inputMode="numeric"
          className={`${input} w-28`}
        />
      </label>
    </div>
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
  contact?: Contact | null;
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
  const touchDates = (contact?.touchDates as TouchDates | null) ?? null;
  const extra = (contact?.extraContacts as { phones?: string[]; emails?: string[] } | null) ?? null;
  const lead = (contact?.leadDetails as Record<string, string> | null) ?? null;
  const categories = contact?.categories ?? [];
  const allCategories = Array.from(new Set([...SUGGESTED_CATEGORIES, ...categories]));

  return (
    <form action={action} className="flex flex-col gap-5">
      {contact && <input type="hidden" name="id" value={contact.id} />}

      {/* Contact info */}
      <section className={card}>
        <h2 className="mb-4 font-medium">Contact info</h2>
        <div className="flex flex-col gap-5">
          <PersonGrid prefix="p" legend="Primary person" values={primary} />
          <PersonGrid
            prefix="s"
            legend="Second person — spouse, partner, or assistant"
            values={secondary}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className={label}>
              Company
              <input name="company" defaultValue={contact?.company ?? ""} className={input} />
            </label>
            <label className={label}>
              Website
              <input name="website" defaultValue={contact?.website ?? ""} className={input} />
            </label>
            <label className={label}>
              Fax
              <input name="fax" defaultValue={contact?.fax ?? ""} className={input} />
            </label>
          </div>
          <details>
            <summary className="cursor-pointer select-none text-sm font-medium text-brand-700 hover:text-brand-600">
              + Add more phones / emails
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1].map((i) => (
                <label key={`ph-${i}`} className={label}>
                  Extra phone
                  <input
                    name="extraPhone"
                    defaultValue={extra?.phones?.[i] ?? ""}
                    className={input}
                  />
                </label>
              ))}
              {[0, 1].map((i) => (
                <label key={`em-${i}`} className={label}>
                  Extra email
                  <input
                    name="extraEmail"
                    defaultValue={extra?.emails?.[i] ?? ""}
                    className={input}
                  />
                </label>
              ))}
            </div>
          </details>
        </div>
      </section>

      {/* Categories + rating */}
      <section className={card}>
        <h2 className="mb-1 font-medium">Categories &amp; relationship</h2>
        <p className="mb-3 text-sm text-stone-500">
          Tag for mailings and searches; the grade sets how often they surface in your prospecting
          queue.
        </p>
        <div className="flex flex-wrap gap-2">
          {allCategories.map((c) => (
            <label
              key={c}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-stone-200 px-3 py-1 text-sm has-checked:border-brand-600 has-checked:bg-brand-50 has-checked:text-brand-800"
            >
              <input
                type="checkbox"
                name="categories"
                value={c}
                defaultChecked={categories.includes(c)}
                className="h-3.5 w-3.5 accent-brand-600"
              />
              {c}
            </label>
          ))}
          <input
            name="newCategory"
            placeholder="New category…"
            className={`${input} w-40 rounded-full px-3 py-1 text-sm`}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {GRADES.map((g) => (
            <label
              key={g}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm has-checked:border-brand-600 has-checked:bg-brand-50"
            >
              <input
                type="radio"
                name="grade"
                value={g}
                defaultChecked={contact?.grade === g}
                className="accent-brand-600"
              />
              <span className="font-semibold">{g}</span>
              <span className="text-xs text-stone-500">every {GRADE_CADENCE[g]} days</span>
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm has-checked:border-stone-400">
            <input
              type="radio"
              name="grade"
              value=""
              defaultChecked={!contact?.grade}
              className="accent-stone-500"
            />
            <span className="text-stone-500">No auto-prospecting</span>
          </label>
        </div>
      </section>

      {/* Addresses */}
      <section className={card}>
        <h2 className="mb-4 font-medium">Mailing addresses</h2>
        <div className="flex flex-col gap-5">
          <AddressGrid
            prefix="home"
            legend="Home address"
            values={(contact?.homeAddress as Address | null) ?? null}
          />
          <AddressGrid
            prefix="work"
            legend="Work address"
            values={(contact?.workAddress as Address | null) ?? null}
          />
        </div>
      </section>

      {/* Ownership + referral */}
      <section className={card}>
        <h2 className="mb-4 font-medium">Ownership &amp; referral</h2>
        <div className="grid gap-5 lg:grid-cols-2">
          <label className={label}>
            Owner
            <select name="ownerId" defaultValue={contact?.ownerId ?? ""} className={input}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-stone-700">Who referred them?</legend>
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
                <select
                  name="referredById"
                  defaultValue={contact?.referredById ?? ""}
                  className={`${input} flex-1`}
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
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="referralKind"
                  value="source"
                  defaultChecked={Boolean(contact?.referralSource)}
                  className="accent-brand-600"
                />
                A source
                <input
                  name="referralSource"
                  defaultValue={contact?.referralSource ?? ""}
                  placeholder="Zillow, postcard campaign…"
                  className={`${input} flex-1`}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-stone-500">Referred on</span>
                <input
                  type="date"
                  name="referralDate"
                  defaultValue={
                    contact?.referralDate ? contact.referralDate.toISOString().slice(0, 10) : ""
                  }
                  className={input}
                />
              </label>
            </div>
          </fieldset>
        </div>
      </section>

      {/* Lead tracking */}
      <section className={card}>
        <h2 className="mb-3 font-medium">Lead tracking</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["BUYER", "Potential buyer"],
              ["SELLER", "Potential seller"],
              ["NONE", "Not a lead"],
            ] as const
          ).map(([v, l]) => (
            <label
              key={v}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm has-checked:border-brand-600 has-checked:bg-brand-50"
            >
              <input
                type="radio"
                name="leadType"
                value={v}
                defaultChecked={(contact?.leadType ?? "NONE") === v}
                className="accent-brand-600"
              />
              {l}
            </label>
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <details open={contact?.leadType === "BUYER"}>
            <summary className="cursor-pointer select-none text-sm font-medium text-stone-600">
              Buyer details
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <label className={label}>
                Cultivating — what are they looking for?
                <textarea
                  name="buyerCultivating"
                  defaultValue={lead?.cultivating ?? ""}
                  rows={2}
                  className={input}
                />
              </label>
              <label className={label}>
                Location / area
                <input name="buyerLocation" defaultValue={lead?.location ?? ""} className={input} />
              </label>
              <label className={label}>
                Price range
                <input
                  name="buyerRange"
                  defaultValue={lead?.range ?? ""}
                  placeholder="$500k–$750k"
                  className={input}
                />
              </label>
              <label className={label}>
                Income
                <input
                  name="buyerIncome"
                  defaultValue={lead?.income ?? ""}
                  inputMode="numeric"
                  className={input}
                />
              </label>
            </div>
          </details>
          <details open={contact?.leadType === "SELLER"}>
            <summary className="cursor-pointer select-none text-sm font-medium text-stone-600">
              Seller details
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <label className={label}>
                Cultivating — listing notes
                <textarea
                  name="sellerCultivating"
                  defaultValue={lead?.cultivating ?? ""}
                  rows={2}
                  className={input}
                />
              </label>
              <label className={label}>
                Property address
                <input name="sellerAddress" defaultValue={lead?.address ?? ""} className={input} />
              </label>
              <label className={label}>
                List price
                <input
                  name="sellerListPrice"
                  defaultValue={lead?.listPrice ?? ""}
                  inputMode="numeric"
                  className={input}
                />
              </label>
              <label className={label}>
                Estimated net proceeds
                <input
                  name="sellerNetProceeds"
                  defaultValue={lead?.netProceeds ?? ""}
                  inputMode="numeric"
                  className={input}
                />
              </label>
            </div>
          </details>
        </div>
      </section>

      {/* Touch dates */}
      <section className={card}>
        <h2 className="mb-1 font-medium">Yearly touch dates</h2>
        <p className="mb-4 text-sm text-stone-500">
          Recurring dates worth a call or a card. Year is optional.
        </p>
        <div className="flex flex-col gap-3">
          <MonthDayRow prefix="birthday" labelText="Birthday" value={touchDates?.birthday} />
          <MonthDayRow
            prefix="birthdayAlt"
            labelText="Birthday (spouse/alt)"
            value={touchDates?.birthdayAlt}
          />
          <MonthDayRow
            prefix="wedding"
            labelText="Wedding anniversary"
            value={touchDates?.weddingAnniversary}
          />
          <MonthDayRow
            prefix="purchase"
            labelText="Purchase anniversary"
            value={touchDates?.purchaseAnniversary}
          />
        </div>
      </section>

      <div>
        <button type="submit" className={btn}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
