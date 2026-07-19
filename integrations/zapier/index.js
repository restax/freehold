const pkg = require("./package.json");
const zapier = require("zapier-platform-core");

/**
 * Freehold for Zapier (private app).
 *
 * Auth: the workspace's API key (Settings → API keys) + the Freehold URL
 * (https://freeholdtc.dev for Cloud, or a self-hosted origin).
 *
 * Hook triggers subscribe through POST /api/v1/webhooks, so events arrive
 * signed and instantly; polling triggers ride the plain REST endpoints.
 */

const base = (bundle) => `${bundle.authData.api_url.replace(/\/$/, "")}/api/v1`;

const authentication = {
  type: "custom",
  fields: [
    {
      key: "api_url",
      label: "Freehold URL",
      required: true,
      default: "https://freeholdtc.dev",
      helpText: "https://freeholdtc.dev for Freehold Cloud, or your self-hosted address.",
    },
    {
      key: "api_key",
      label: "API key",
      required: true,
      type: "password",
      helpText: "Create one in Freehold under Settings → API keys (starts with `fh_live_`).",
    },
  ],
  test: async (z, bundle) => {
    const res = await z.request(`${base(bundle)}/account`);
    return res.data;
  },
  connectionLabel: "{{workspace}}",
};

const withAuth = (z, bundle) => ({
  headers: { Authorization: `Bearer ${bundle.authData.api_key}` },
});

// ---------- hook trigger factory ----------

function hookTrigger({ key, noun, label, description, event, sampleList }) {
  return {
    key,
    noun,
    display: { label, description },
    operation: {
      type: "hook",
      performSubscribe: async (z, bundle) => {
        const res = await z.request({
          url: `${base(bundle)}/webhooks`,
          method: "POST",
          ...withAuth(z, bundle),
          body: { url: bundle.targetUrl, events: [event] },
        });
        return res.data.webhook;
      },
      performUnsubscribe: async (z, bundle) => {
        const res = await z.request({
          url: `${base(bundle)}/webhooks/${bundle.subscribeData.id}`,
          method: "DELETE",
          ...withAuth(z, bundle),
        });
        return res.data;
      },
      perform: (z, bundle) => {
        const data = bundle.cleanedRequest && bundle.cleanedRequest.data;
        return data ? [data] : [];
      },
      performList: sampleList,
    },
  };
}

// ---------- triggers ----------

const newTransaction = {
  key: "new_transaction",
  noun: "Transaction",
  display: {
    label: "New Transaction",
    description: "Triggers when a transaction is created in Freehold.",
  },
  operation: {
    perform: async (z, bundle) => {
      const res = await z.request({ url: `${base(bundle)}/transactions`, ...withAuth(z, bundle) });
      return res.data.transactions;
    },
  },
};

const newContact = {
  key: "new_contact",
  noun: "Contact",
  display: {
    label: "New Contact",
    description: "Triggers when a contact (including website leads) is created in Freehold.",
  },
  operation: {
    perform: async (z, bundle) => {
      const res = await z.request({ url: `${base(bundle)}/contacts`, ...withAuth(z, bundle) });
      return res.data.contacts;
    },
  },
};

const taskCompleted = hookTrigger({
  key: "task_completed",
  noun: "Task",
  label: "Task Completed",
  description: "Triggers instantly when a task is marked done in Freehold.",
  event: "task.completed",
  sampleList: async (z, bundle) => {
    const res = await z.request({ url: `${base(bundle)}/tasks`, ...withAuth(z, bundle) });
    return res.data.tasks;
  },
});

const documentUploaded = hookTrigger({
  key: "document_uploaded",
  noun: "Document",
  label: "Document Uploaded",
  description:
    "Triggers instantly when a document is uploaded to a transaction — e.g. to send it for signature in DocuSign.",
  event: "document.uploaded",
  sampleList: async () => [
    {
      id: "doc_sample",
      transactionId: "txn_sample",
      filename: "Purchase Agreement.pdf",
      contentType: "application/pdf",
      sizeBytes: 245133,
    },
  ],
});

const envelopeCompleted = hookTrigger({
  key: "envelope_completed",
  noun: "Envelope",
  label: "Envelope Completed",
  description: "Triggers instantly when a signature envelope completes in Freehold.",
  event: "envelope.completed",
  sampleList: async () => [
    {
      id: "env_sample",
      transactionId: "txn_sample",
      documentId: "doc_sample",
      provider: "DOCUMENSO",
    },
  ],
});

// ---------- actions ----------

const createTransaction = {
  key: "create_transaction",
  noun: "Transaction",
  display: {
    label: "Create Transaction",
    description: "Creates a transaction in Freehold — e.g. when a Dotloop loop is created.",
  },
  operation: {
    inputFields: [
      { key: "propertyAddress", label: "Property address", required: true },
      { key: "city" },
      { key: "state" },
      { key: "zip" },
      {
        key: "status",
        choices: ["LISTING", "UNDER_CONTRACT", "PENDING", "CLOSED", "CANCELLED"],
      },
      { key: "side", choices: ["BUY_SIDE", "SELL_SIDE", "DUAL"] },
      { key: "purchasePrice", type: "number" },
      { key: "contractDate", type: "datetime", helpText: "Date only is used (YYYY-MM-DD)." },
      { key: "closeDate", type: "datetime", helpText: "Date only is used (YYYY-MM-DD)." },
    ],
    perform: async (z, bundle) => {
      const res = await z.request({
        url: `${base(bundle)}/transactions`,
        method: "POST",
        ...withAuth(z, bundle),
        body: bundle.inputData,
      });
      return res.data.transaction;
    },
  },
};

const createContact = {
  key: "create_contact",
  noun: "Contact",
  display: {
    label: "Create Contact",
    description: "Creates a contact in Freehold.",
  },
  operation: {
    inputFields: [
      { key: "name", required: true },
      { key: "email" },
      { key: "phone" },
      { key: "category" },
    ],
    perform: async (z, bundle) => {
      const res = await z.request({
        url: `${base(bundle)}/contacts`,
        method: "POST",
        ...withAuth(z, bundle),
        body: bundle.inputData,
      });
      return res.data.contact;
    },
  },
};

const createTask = {
  key: "create_task",
  noun: "Task",
  display: {
    label: "Create Task",
    description: "Creates a task in Freehold, optionally on a transaction.",
  },
  operation: {
    inputFields: [
      { key: "title", required: true },
      { key: "transactionId", label: "Transaction ID" },
      { key: "dueDate", type: "datetime", helpText: "Date only is used (YYYY-MM-DD)." },
      { key: "priority", choices: ["NORMAL", "HIGH", "CRITICAL"] },
    ],
    perform: async (z, bundle) => {
      const res = await z.request({
        url: `${base(bundle)}/tasks`,
        method: "POST",
        ...withAuth(z, bundle),
        body: bundle.inputData,
      });
      return res.data.task;
    },
  },
};

const addNote = {
  key: "add_note",
  noun: "Note",
  display: {
    label: "Add Transaction Note",
    description:
      "Appends a timestamped note to a transaction — e.g. when a DocuSign envelope completes.",
  },
  operation: {
    inputFields: [
      { key: "transactionId", label: "Transaction ID", required: true },
      { key: "body", label: "Note", required: true },
    ],
    perform: async (z, bundle) => {
      const res = await z.request({
        url: `${base(bundle)}/notes`,
        method: "POST",
        ...withAuth(z, bundle),
        body: bundle.inputData,
      });
      return res.data;
    },
  },
};

module.exports = {
  version: pkg.version,
  platformVersion: zapier.version,
  authentication,
  triggers: {
    [newTransaction.key]: newTransaction,
    [newContact.key]: newContact,
    [taskCompleted.key]: taskCompleted,
    [documentUploaded.key]: documentUploaded,
    [envelopeCompleted.key]: envelopeCompleted,
  },
  creates: {
    [createTransaction.key]: createTransaction,
    [createContact.key]: createContact,
    [createTask.key]: createTask,
    [addNote.key]: addNote,
  },
};
