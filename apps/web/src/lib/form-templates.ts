/**
 * The starter library a TC picks from when they make a form.
 *
 * A template is only a *starting layout*. Installing one writes its rows onto
 * a normal Form row and hands it to the designer — after that it is the TC's
 * form and nothing here can change it. That is deliberate: a template that
 * kept updating itself underneath a workspace would silently rewrite the
 * questions their clients are answering.
 *
 * The two long ones are ports of the intake forms real coordinators run
 * today, rebuilt against this app's field types so the answers land on a
 * Transaction instead of in an email. Where a question corresponds to a
 * mapped key it uses that key — that binding is the whole reason to rebuild
 * these rather than embed somebody else's form in an iframe.
 *
 * Dependency-free so the library is unit-testable: a template with a broken
 * key or a duplicate answer key is a form that quietly loses a client's
 * answer, and that has to be caught here rather than in production.
 */

import {
  defaultLayout,
  type FormCell,
  type FormField,
  type FormKind,
  type FormLayout,
  MAX_CELLS_PER_ROW,
  mappedField,
  normalizeLayout,
} from "./form-schema";

export interface FormTemplate {
  /** Stable id — stored nowhere, but it is what the picker submits. */
  id: string;
  kind: FormKind;
  /** Name the new form gets, and what the picker shows. */
  name: string;
  /** One line on the card: when a TC would reach for this one. */
  description: string;
  /** Shown to the person filling it in, above the first question. */
  title: string;
  intro: string;
  layout: () => FormLayout;
}

// --- builders ------------------------------------------------------------

let seq = 0;
/** Ids only have to be unique inside one layout; the designer re-keys on edit. */
const nextId = (prefix: string) => `${prefix}_${++seq}`;

function field(f: Omit<FormField, "id" | "kind">): FormField {
  return { id: nextId("c"), kind: "field", ...f };
}

/** A field bound to a mapped key, so it converts into a real column. */
function mapped(kind: FormKind, key: string, over: Partial<FormField> = {}): FormField {
  const m = mappedField(kind, key);
  if (!m) throw new Error(`unknown mapped field ${kind}.${key}`);
  return field({
    type: m.type,
    key: m.key,
    label: m.label,
    ...(m.options && { options: m.options }),
    ...over,
  });
}

const heading = (text: string): FormCell => ({
  id: nextId("b"),
  kind: "block",
  type: "heading",
  text,
});
const para = (text: string): FormCell => ({
  id: nextId("b"),
  kind: "block",
  type: "paragraph",
  text,
});
const divider = (): FormCell => ({ id: nextId("b"), kind: "block", type: "divider" });

function row(...cells: FormCell[]) {
  return { id: nextId("r"), cells: cells.slice(0, MAX_CELLS_PER_ROW) };
}

/**
 * "Check all that apply" as one checkbox per option.
 *
 * There is no multi-select field type, and inventing one would touch the
 * parser, the validator, the renderer, the designer and the converter. One
 * checkbox per line renders as the same thing to the person filling it in,
 * and has the advantage that each answer arrives under its own key instead
 * of buried in a joined string.
 */
function checkboxGroup(prefix: string, label: string, options: string[]) {
  const rows = [row(para(label))];
  for (let i = 0; i < options.length; i += MAX_CELLS_PER_ROW) {
    rows.push(
      row(
        ...options.slice(i, i + MAX_CELLS_PER_ROW).map((opt, j) =>
          field({
            type: "checkbox",
            key: `${prefix}${i + j + 1}`,
            label: opt,
          }),
        ),
      ),
    );
  }
  return rows;
}

/** The sign-off every intake form ends with. */
function acknowledgement(what: string) {
  return [
    row(divider()),
    row(
      field({
        type: "checkbox",
        key: "acknowledgement",
        label: "I agree",
        required: true,
        help: what,
      }),
    ),
  ];
}

// --- the templates -------------------------------------------------------

const SPECIAL_CIRCUMSTANCES = [
  "Client has a power of attorney — I'll send a copy for title/escrow approval",
  "Client needs title to draw up a POA — details in the final notes",
  "One or more sellers on title is deceased — details in the final notes",
  "Client is out of area and needs a mobile notary or documents mailed",
  "Clients are divorced or divorcing — please contact the parties separately",
  "Client does not sign electronically — I'll be getting wet signatures",
  "Client uses an interpreter — contact details in the final notes",
  "Please copy someone who isn't on the contract — details in the final notes",
];

const ACKNOWLEDGEMENT =
  "By submitting this form I authorise my transaction coordinator to contact my " +
  "client(s), the escrow and title officers, the cooperating agent, the attorney and " +
  "every other party to this transaction on my behalf, and I agree to pay for these " +
  "services under our signed agreement.";

/**
 * A listing going on the market. Sell-side by nature, so it asks about the
 * things that gate a listing going live — disclosures, photography, the go-live
 * date — rather than anything about a contract.
 */
function listingSubmission(): FormLayout {
  const k: FormKind = "listing_intake";
  return normalizeLayout({
    rows: [
      // The greeting is the form's own description, right above this — saying
      // it twice is the first thing a reader notices.
      row(para("If you haven't signed our terms of service yet, please get in touch first.")),
      row(field({ type: "text", key: "agentName", label: "Your name", required: true })),
      row(
        field({
          type: "select",
          key: "serviceRequested",
          label: "Which service are you asking for?",
          required: true,
          help: "Refer to your agreement for pricing.",
          options: [
            "Full-service listing — property prep, seller-signed disclosures and MLS prep",
            "MLS entry only",
            "Disclosures and compliance only",
          ],
        }),
      ),
      row(mapped(k, "propertyAddress", { required: true })),
      row(mapped(k, "city"), mapped(k, "state")),
      row(mapped(k, "listPrice"), mapped(k, "mlsId")),

      row(heading("Your client")),
      row(
        para(
          "Please include the name your client actually goes by. If title is held by a " +
            "trust, estate or LLC, give us the primary contact and the authorised signer.",
        ),
      ),
      row(mapped(k, "seller", { label: "Client", required: true })),
      row(field({ type: "party", key: "seller2", label: "Second client (if any)" })),
      row(field({ type: "text", key: "additionalClients", label: "Any further clients" })),
      row(mapped(k, "listingAgent", { label: "You (listing agent)" })),
      row(field({ type: "party", key: "coAgent", label: "Co-agent on this file (if any)" })),

      row(heading("Vendors")),
      row(
        para(
          "If we arrange the photographer or videographer, the listing goes live 24 hours " +
            "after the media is available.",
        ),
      ),
      row(field({ type: "party", key: "photographer", label: "Preferred photographer" })),
      row(field({ type: "party", key: "videographer", label: "Preferred videographer" })),
      row(field({ type: "party", key: "stager", label: "Preferred stager" })),

      row(heading("Dates and showings")),
      row(
        mapped(k, "listDate", {
          label: "Date you want to go active",
          help: "Please allow at least 24 hours' notice.",
        }),
        mapped(k, "expireDate"),
      ),
      row(field({ type: "text", key: "showingRestrictions", label: "Showing restrictions" })),
      row(
        field({ type: "date", key: "firstOpenHouse", label: "First open house" }),
        field({ type: "date", key: "caravanDate", label: "Caravan tour date" }),
      ),
      row(field({ type: "text", key: "caravanNote", label: "Caravan incentive or other note" })),

      row(heading("Disclosures and warranty")),
      row(
        field({
          type: "select",
          key: "disclosureKnowledge",
          label: "Does the seller know the property well enough to complete a disclosure?",
          required: true,
          options: [
            "Yes — they can complete a Seller's Property Disclosure",
            "No — we'll need a groundwater disclosure",
            "New construction — we'll need a groundwater disclosure",
          ],
        }),
      ),
      row(
        field({
          type: "select",
          key: "homeWarranty",
          label: "Should we order a seller's home warranty?",
          options: ["Yes — paid by the seller", "Yes — paid by the agent", "Not applicable"],
        }),
      ),
      row(field({ type: "text", key: "warrantyCompany", label: "Preferred warranty company" })),

      row(divider()),
      row(
        mapped(k, "contractFile", {
          label: "MLS data form",
          help: "Upload it here, or tell us below where to find it.",
        }),
      ),
      row(
        field({
          type: "text",
          key: "primaryPhoto",
          label: "Which photo should be the primary?",
          required: true,
        }),
      ),
      ...checkboxGroup(
        "special",
        "Do any of these apply? Tick any that do and give us the specifics in the final notes.",
        SPECIAL_CIRCUMSTANCES,
      ),
      row(
        mapped(k, "notes", {
          label: "Final notes",
          required: true,
          help:
            "Anything referenced above, anything still missing and when to expect it, and " +
            "anything you specifically want help with. If there's nothing, put “none”.",
        }),
      ),
      ...acknowledgement(ACKNOWLEDGEMENT),
    ],
  });
}

/**
 * An executed contract heading for closing. The long one: it asks for
 * everything a coordinator otherwise has to chase across a week of emails.
 */
function contractIntake(): FormLayout {
  const k: FormKind = "transaction_intake";
  return normalizeLayout({
    rows: [
      row(para("If you haven't signed our terms of service yet, please get in touch first.")),
      row(field({ type: "text", key: "agentName", label: "Your name", required: true })),
      row(mapped(k, "propertyAddress", { required: true })),
      row(mapped(k, "city"), mapped(k, "state")),
      row(
        field({
          type: "select",
          key: "serviceRequested",
          label: "Which service are you asking for?",
          required: true,
          help: "Refer to your agreement for pricing.",
          options: [
            "Contract to post-close — one side, the other side has an agent",
            "Contract to post-close — the other side is unrepresented",
            "Contract to post-close — dual sided",
            "Compliance only — no lending, no repairs, no contact with the parties",
            "Short sale",
          ],
        }),
      ),
      row(mapped(k, "side", { label: "You represent", required: true })),
      row(mapped(k, "purchasePrice"), mapped(k, "closeDate")),

      row(heading("Your client")),
      row(
        para(
          "Please include the name your client actually goes by. If title is held by a " +
            "trust, estate or LLC, give us the primary contact and the authorised signer.",
        ),
      ),
      row(mapped(k, "buyer", { label: "Client", required: true })),
      row(field({ type: "party", key: "client2", label: "Second client (if any)" })),
      row(field({ type: "text", key: "additionalClients", label: "Any further clients" })),
      row(field({ type: "party", key: "coAgent", label: "Your co-agent (if any)" })),
      row(
        field({
          type: "party",
          key: "coopAgentTc",
          label: "The other agent's co-agent or coordinator",
          help: "Anyone on their side we should be copying.",
        }),
      ),

      row(heading("Money and the professionals")),
      row(
        field({
          type: "select",
          key: "financing",
          label: "Is there financing on this deal?",
          required: true,
          options: ["Yes", "No — cash", "Exchange"],
        }),
      ),
      row(mapped(k, "lender")),
      row(
        mapped(k, "titleCompany", {
          label: "Preferred closing location and title officer",
          required: true,
        }),
      ),
      row(mapped(k, "attorney", { help: "Required in an attorney state." })),
      row(
        field({
          type: "text",
          key: "commissionSplit",
          label: "Commission percentages",
          required: true,
          placeholder: "2% sell side / 3% buy side",
        }),
      ),
      row(
        field({
          type: "text",
          key: "commissionPayer",
          label: "Who is paying the commissions?",
          required: true,
        }),
      ),
      row(field({ type: "text", key: "referral", label: "Is there a referral to pay?" })),

      row(heading("Inspections")),
      row(
        field({
          type: "select",
          key: "homeInspection",
          label: "Home inspection",
          required: true,
          options: [
            "Not applicable",
            "Booked and confirmed with the seller / listing agent",
            "Booked, but the seller / listing agent don't know yet",
            "To be booked — I'll arrange it and tell you the time",
            "To be booked — the buyer will arrange it and I'll tell you the time",
            "Please book this for me",
            "I represent the seller and haven't been told the time yet",
            "Other — see the final notes",
          ],
        }),
      ),
      row(
        field({ type: "date", key: "inspectionDate", label: "Inspection date, if booked" }),
        mapped(k, "inspector", { label: "Inspection company" }),
      ),
      ...checkboxGroup("inspectionType", "If we're booking it, which inspections do you want?", [
        "Residential home inspection",
        "Termite",
        "Sewer scope",
        "Radon",
        "Mould",
        "Thermal imaging",
        "Sprinkler",
        "Pool or spa",
      ]),
      row(
        field({
          type: "select",
          key: "utilitiesOn",
          label: "If we're booking the inspection, are the utilities on?",
          options: ["Yes", "No", "Partly — see the final notes"],
        }),
      ),
      row(
        field({
          type: "select",
          key: "occupied",
          label: "Is the property occupied?",
          required: true,
          options: ["No — vacant", "Yes — owner occupied", "Yes — tenant occupied"],
        }),
      ),
      row(
        field({
          type: "select",
          key: "septicInspection",
          label: "Septic or lagoon inspection",
          options: [
            "Not applicable",
            "Booked and everyone told",
            "To be booked — I'll arrange it and tell you the time",
            "To be booked — the seller will arrange it and I'll tell you the time",
            "Please book this for me — say which below",
            "I represent the buyer and haven't been told the time yet",
            "Other — see the final notes",
          ],
        }),
      ),
      row(
        field({ type: "text", key: "septicType", label: "Septic or lagoon?" }),
        field({ type: "date", key: "septicDate", label: "Septic date, if booked" }),
      ),
      row(
        field({
          type: "select",
          key: "wellInspection",
          label: "Well inspection",
          options: [
            "Not applicable",
            "Booked and everyone told",
            "To be booked — I'll arrange it and tell you the time",
            "To be booked — the seller will arrange it and I'll tell you the time",
            "Please book this for me",
            "I represent the buyer and haven't been told the time yet",
            "Other — see the final notes",
          ],
        }),
        field({ type: "date", key: "wellDate", label: "Well date, if booked" }),
      ),

      row(heading("The property and the parties")),
      row(
        field({
          type: "select",
          key: "newConstruction",
          label: "Is this new construction or a pre-sale?",
          required: true,
          options: ["Yes", "No", "Other — see the final notes"],
        }),
      ),
      row(
        field({
          type: "select",
          key: "hoaDocs",
          label: "HOA documents",
          required: true,
          options: [
            "Not applicable",
            "The seller or listing agent will send us a copy",
            "Please help collect them from title",
            "Please follow up with the listing agent",
            "Other — see the final notes",
          ],
        }),
      ),
      row(
        field({
          type: "select",
          key: "attendingClosing",
          label: "Will your client attend the closing?",
          required: true,
          options: [
            "Yes",
            "No",
            "Not known yet — please check nearer the time",
            "Other — see the final notes",
          ],
        }),
      ),
      row(
        field({
          type: "text",
          key: "maritalStatus",
          label: "Your client's marital status, and any spouse not named on the contract",
          required: true,
        }),
      ),
      row(
        field({
          type: "select",
          key: "sellerMortgage",
          label: "If you represent the seller, is there a mortgage on the property?",
          options: ["Yes", "No", "Other — see the final notes"],
        }),
        field({
          type: "select",
          key: "sellerUsCitizen",
          label: "If you represent the seller, are they a US citizen?",
          help:
            "Title asks because section 1445 of the Internal Revenue Code requires tax to " +
            "be withheld when the seller of US real property is a foreign person.",
          options: ["Yes", "No"],
        }),
      ),
      row(
        field({
          type: "select",
          key: "buyerPrimaryResidence",
          label: "If you represent the buyer, will this be their primary residence?",
          options: ["Yes", "No"],
        }),
        field({
          type: "select",
          key: "exchange1031",
          label: "Is this a 1031 exchange?",
          required: true,
          options: ["Yes", "No"],
        }),
      ),
      ...checkboxGroup(
        "special",
        "Do any of these apply? Tick any that do and give us the specifics in the final notes.",
        SPECIAL_CIRCUMSTANCES,
      ),

      row(divider()),
      row(
        mapped(k, "contractFile", {
          label: "The contract",
          help: "Upload it here, or tell us below where to find it.",
        }),
      ),
      row(
        mapped(k, "notes", {
          label: "Final notes",
          required: true,
          help:
            "Anything referenced above, any documents still missing and when to expect " +
            "them, and anything you specifically want help with. If there's nothing, " +
            "put “none”.",
        }),
      ),
      ...acknowledgement(ACKNOWLEDGEMENT),
    ],
  });
}

/**
 * The library, in the order the picker shows it: the short starters first,
 * because a TC who wants to build their own shouldn't have to scroll past two
 * forty-question forms to find a blank-ish one.
 */
export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "basic_client",
    kind: "client_intake",
    name: "New client",
    description: "The short one: who they are, their brokerage, and where invoices go.",
    title: "Work with us",
    intro: "Tell us a little about you and we'll get you set up.",
    layout: () => defaultLayout("client_intake"),
  },
  {
    id: "basic_contract",
    kind: "transaction_intake",
    name: "New contract",
    description: "The short one: address, dates, price and who else is on the deal.",
    title: "New contract",
    intro: "Send us the contract and the basics, and we'll open the file.",
    layout: () => defaultLayout("transaction_intake"),
  },
  {
    id: "basic_listing",
    kind: "listing_intake",
    name: "New listing",
    description: "The short one: address, list price, go-live date and the seller.",
    title: "New listing",
    intro: "Tell us about the listing and we'll get it ready to go live.",
    layout: () => defaultLayout("listing_intake"),
  },
  {
    id: "full_listing",
    kind: "listing_intake",
    name: "Listing submission (full)",
    description:
      "Everything that gates a listing going live — service level, disclosures, " +
      "photography, staging, showing restrictions and open houses.",
    title: "Listing submission",
    intro: "Congratulations on the new listing. A few details and we can get started.",
    layout: listingSubmission,
  },
  {
    id: "full_contract",
    kind: "transaction_intake",
    name: "Contract intake (full)",
    description:
      "The long one — financing, title, attorney, commissions, every inspection, " +
      "occupancy, HOA and closing logistics in a single pass.",
    title: "New contract submission",
    intro: "Congratulations on the new contract. A few details that aren't on the contract itself.",
    layout: contractIntake,
  },
];

export function formTemplate(id: string): FormTemplate | null {
  return FORM_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function templatesForKind(kind: FormKind): FormTemplate[] {
  return FORM_TEMPLATES.filter((t) => t.kind === kind);
}
