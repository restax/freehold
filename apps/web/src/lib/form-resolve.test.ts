import { describe, expect, it } from "vitest";
import {
  isClientKnownKey,
  pickFormForClient,
  portalFormsFor,
  trimKnownClientFields,
} from "./form-resolve";
import type { FormLayout } from "./form-schema";

const form = (id: string, over: Partial<Parameters<typeof pickFormForClient>[0][number]> = {}) => ({
  id,
  kind: "transaction_intake",
  status: "published",
  showPortal: true,
  clientId: null as string | null,
  ...over,
});

describe("pickFormForClient", () => {
  const shared = form("shared");
  const mine = form("mine", { clientId: "c1" });
  const someoneElses = form("theirs", { clientId: "c2" });

  it("a client's own version wins over the shared one", () => {
    expect(pickFormForClient([shared, mine], "transaction_intake", "c1")?.id).toBe("mine");
  });

  it("falls back to the shared one, which is the whole point", () => {
    expect(pickFormForClient([shared, someoneElses], "transaction_intake", "c1")?.id).toBe(
      "shared",
    );
    expect(pickFormForClient([shared], "transaction_intake", null)?.id).toBe("shared");
  });

  it("never hands a client someone else's private form", () => {
    expect(pickFormForClient([someoneElses], "transaction_intake", "c1")).toBeNull();
    expect(pickFormForClient([someoneElses], "transaction_intake", null)).toBeNull();
  });

  it("a draft is invisible however it's addressed", () => {
    expect(
      pickFormForClient(
        [form("d", { status: "draft", clientId: "c1" })],
        "transaction_intake",
        "c1",
      ),
    ).toBeNull();
  });

  it("a form not placed in portals stays out of them", () => {
    expect(
      pickFormForClient([form("p", { showPortal: false })], "transaction_intake", "c1"),
    ).toBeNull();
  });

  it("keeps the kinds apart", () => {
    expect(
      pickFormForClient([form("c", { kind: "client_intake" })], "transaction_intake", "c1"),
    ).toBeNull();
  });
});

describe("portalFormsFor", () => {
  it("shows one form per kind — never both versions of the same thing", () => {
    const forms = [
      form("sharedTxn"),
      form("mineTxn", { clientId: "c1" }),
      form("sharedClient", { kind: "client_intake" }),
    ];
    expect(
      portalFormsFor(forms, "c1")
        .map((f) => f.id)
        .sort(),
    ).toEqual(["mineTxn", "sharedClient"]);
  });

  it("is empty when nothing is placed in portals", () => {
    expect(portalFormsFor([form("x", { showPortal: false })], "c1")).toEqual([]);
  });
});

describe("trimKnownClientFields", () => {
  const field = (key: string): FormLayout["rows"][number] => ({
    id: `r-${key}`,
    cells: [{ id: `c-${key}`, kind: "field", type: "text", key, label: key }],
  });
  const heading = (text: string): FormLayout["rows"][number] => ({
    id: `r-${text}`,
    cells: [{ id: `c-${text}`, kind: "block", type: "heading", text }],
  });

  it("drops the identity questions and keeps the deal ones", () => {
    const out = trimKnownClientFields({
      rows: [field("clientName"), field("propertyAddress"), field("billingEmail")],
    });
    expect(out?.rows.flatMap((r) => r.cells.map((c) => (c.kind === "field" ? c.key : "")))).toEqual(
      ["propertyAddress"],
    );
  });

  it("is null when the whole form was only about who they are", () => {
    // Otherwise the client gets a Send button over an empty form.
    expect(trimKnownClientFields({ rows: [field("clientName"), field("email")] })).toBeNull();
    expect(trimKnownClientFields({ rows: [heading("Your brokerage"), field("phone")] })).toBeNull();
  });

  it("drops a heading whose fields all went away", () => {
    const out = trimKnownClientFields({
      rows: [
        heading("The property"),
        field("propertyAddress"),
        heading("Who should we invoice?"),
        field("billingEmail"),
      ],
    });
    expect(
      out?.rows.map((r) => (r.cells[0].kind === "block" ? r.cells[0].text : r.cells[0].key)),
    ).toEqual(["The property", "propertyAddress"]);
  });
});

describe("isClientKnownKey", () => {
  it("suppresses identity, never the deal", () => {
    expect(isClientKnownKey("clientName")).toBe(true);
    expect(isClientKnownKey("billingEmail")).toBe(true);
    // Deal facts must always be asked, even of a known client.
    expect(isClientKnownKey("propertyAddress")).toBe(false);
    expect(isClientKnownKey("closeDate")).toBe(false);
    expect(isClientKnownKey("attorney")).toBe(false);
  });
});
