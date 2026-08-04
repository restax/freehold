import { describe, expect, it } from "vitest";
import {
  allDemoTasks,
  DEMO_CLIENTS,
  DEMO_CLOSED_KEYS,
  DEMO_CONTACTS,
  DEMO_EMAIL_DOMAIN,
  DEMO_TEAMMATES,
  DEMO_TRANSACTIONS,
  overdueDemoTasks,
  upcomingDemoTasks,
} from "./data";

/**
 * These pin the *shape* the demo is meant to have on screen. The dataset is
 * edited by hand and read by a camera, so a drift that would be invisible in
 * a unit test ("now there are nine overdue tasks") is exactly the drift that
 * ruins a recording.
 */
describe("demo dataset", () => {
  it("has the counts the demo script expects", () => {
    expect(DEMO_TRANSACTIONS).toHaveLength(15);
    expect(DEMO_CLIENTS.length).toBeGreaterThanOrEqual(6);
    expect(DEMO_CLIENTS.length).toBeLessThanOrEqual(10);
    expect(DEMO_CONTACTS.length).toBeGreaterThanOrEqual(28);
    expect(DEMO_TEAMMATES).toHaveLength(2);
  });

  it("has exactly three closed-and-billed files", () => {
    expect(DEMO_CLOSED_KEYS).toHaveLength(3);
    for (const key of DEMO_CLOSED_KEYS) {
      const txn = DEMO_TRANSACTIONS.find((t) => t.key === key);
      expect(txn?.status).toBe("CLOSED");
      // A closed file must already be in the past, or the demo shows a
      // "closed" transaction with a future closing date.
      expect(txn?.closeOffset).toBeLessThan(0);
      expect(txn?.invoice?.amount).toBeGreaterThan(0);
    }
  });

  it("has exactly two overdue tasks, both carrying notes", () => {
    const overdue = overdueDemoTasks();
    expect(overdue).toHaveLength(2);
    for (const task of overdue) {
      expect(task.notes, `${task.title} should explain why it is late`).toBeTruthy();
    }
    // On two different files, so the dashboard shows spread rather than one
    // problem transaction.
    expect(new Set(overdue.map((t) => t.transactionKey)).size).toBe(2);
  });

  it("has a healthy pile of work due in the next 30 days", () => {
    const upcoming = upcomingDemoTasks(30);
    expect(upcoming.length).toBeGreaterThanOrEqual(15);
    expect(upcoming.every((t) => t.dueOffset >= 0 && t.dueOffset <= 30)).toBe(true);
  });

  it("routes every email address through the freeholdtc.dev catchall", () => {
    // A sample contact on a domain we do not own bounces, and bounces are
    // counted against the sending domain's reputation.
    const addresses = [
      ...DEMO_CLIENTS.map((c) => c.email),
      ...DEMO_CONTACTS.map((c) => c.email),
      ...DEMO_TEAMMATES.map((t) => t.email),
    ];
    for (const address of addresses) {
      expect(address.endsWith(`@${DEMO_EMAIL_DOMAIN}`), `${address} is off-domain`).toBe(true);
      expect(address.startsWith("demo."), `${address} is missing the demo. prefix`).toBe(true);
    }
    expect(new Set(addresses).size, "duplicate email addresses").toBe(addresses.length);
  });

  it("uses unique keys throughout", () => {
    for (const [label, keys] of [
      ["transaction", DEMO_TRANSACTIONS.map((t) => t.key)],
      ["client", DEMO_CLIENTS.map((c) => c.key)],
      ["contact", DEMO_CONTACTS.map((c) => c.key)],
      ["teammate", DEMO_TEAMMATES.map((t) => t.key)],
    ] as const) {
      expect(new Set(keys).size, `duplicate ${label} key`).toBe(keys.length);
    }
  });

  it("points every transaction at a real client and real contacts", () => {
    const clientKeys = new Set(DEMO_CLIENTS.map((c) => c.key));
    const contactKeys = new Set(DEMO_CONTACTS.map((c) => c.key));
    for (const txn of DEMO_TRANSACTIONS) {
      expect(clientKeys.has(txn.clientKey), `${txn.key} client`).toBe(true);
      for (const role of [
        "buyerKey",
        "sellerKey",
        "buyerAgentKey",
        "sellerAgentKey",
        "lenderKey",
        "titleKey",
      ] as const) {
        const key = txn[role];
        if (key) expect(contactKeys.has(key), `${txn.key}.${role} = ${key}`).toBe(true);
      }
      for (const email of txn.emails ?? []) {
        expect(contactKeys.has(email.contactKey), `${txn.key} email contact`).toBe(true);
      }
    }
  });

  it("spreads the fifteen files across exactly three owning clients", () => {
    const owners = new Set(DEMO_TRANSACTIONS.map((t) => t.clientKey));
    expect(owners.size).toBe(3);
  });

  it("only gives a contract PDF to files that have an executed contract", () => {
    for (const txn of DEMO_TRANSACTIONS) {
      if (txn.hasContract) {
        expect(txn.contractOffset, `${txn.key} claims a contract`).not.toBeNull();
      } else {
        expect(txn.contractOffset, `${txn.key} has no contract`).toBeNull();
        expect(txn.closeOffset).toBeNull();
      }
    }
  });

  it("keeps every task's due date inside a sane window", () => {
    // Guards against a typo like 400 instead of 40 putting a task a year out.
    for (const task of allDemoTasks()) {
      expect(task.dueOffset).toBeGreaterThan(-120);
      expect(task.dueOffset).toBeLessThan(120);
    }
  });
});
