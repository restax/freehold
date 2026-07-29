import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { updateContact } from "@/lib/actions/contacts";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId } = await requireTenant();
  const { id } = await params;
  const [contact, contacts, members] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.contact.findUnique({ where: { id }, include: { owners: { select: { userId: true } } } }),
    ),
    withTenant(tenantId, (tx) =>
      tx.contact.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ),
    prisma.member.findMany({
      where: { organizationId: tenantId },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);
  if (!contact) notFound();

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <Link href={`/dashboard/contacts/${id}`} className="text-sm text-stone-500 hover:underline">
          ← {contact.name}
        </Link>
        <h1 className="text-xl font-semibold">Edit contact</h1>
      </div>
      <ContactForm
        action={updateContact}
        contact={contact}
        contacts={contacts}
        members={members.map((m) => ({ userId: m.user.id, name: m.user.name }))}
        submitLabel="Save changes"
      />
    </div>
  );
}
