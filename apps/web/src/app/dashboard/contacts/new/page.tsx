import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { createContact } from "@/lib/actions/contacts";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  const { tenantId } = await requireTenant();
  const [contacts, members] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.contact.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ),
    prisma.member.findMany({
      where: { organizationId: tenantId },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <Link href="/dashboard/contacts" className="text-sm text-stone-500 hover:underline">
          ← Contacts
        </Link>
        <h1 className="text-xl font-semibold">New contact</h1>
        <p className="text-sm text-stone-500">
          One record can hold two people — a couple, or a client and their assistant — so mailings
          and merges address both.
        </p>
      </div>
      <ContactForm
        action={createContact}
        contacts={contacts}
        members={members.map((m) => ({ userId: m.user.id, name: m.user.name }))}
        submitLabel="Save contact"
      />
    </div>
  );
}
