/**
 * Profile photo, or an initials circle when there isn't one. Server-rendered;
 * photos come from the authed /api/users/[id]/avatar route.
 */
export function Avatar({
  user,
  size = 32,
}: {
  user: { id: string; name: string; image?: string | null };
  size?: number;
}) {
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  if (user.image) {
    return (
      // biome-ignore lint/performance/noImgElement: authed API route serving tiny avatars — next/image can't fetch it and has nothing to optimize
      <img
        src={user.image}
        alt={user.name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-full bg-brand-100 font-medium text-brand-800"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }}
    >
      {initials || "?"}
    </span>
  );
}
