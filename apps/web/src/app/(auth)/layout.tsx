import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Link
        href="/"
        className="mb-6 font-serif text-3xl font-semibold tracking-tight text-brand-700"
      >
        Freehold
      </Link>
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}
