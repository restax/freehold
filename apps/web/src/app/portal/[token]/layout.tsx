import { VoiceWidget } from "@/components/voice-widget";
import { liveLink } from "@/lib/portal";

/**
 * Shared chrome for every portal page. The pages each render their own
 * <main>, so this adds only what belongs on all of them — today, voice search,
 * scoped to this link and nothing else.
 *
 * A revoked or unknown token gets no widget at all; the pages themselves still
 * own the 404, so this stays quiet rather than second-guessing them.
 */
export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await liveLink(token);

  return (
    <>
      {children}
      {link && <VoiceWidget portalToken={token} />}
    </>
  );
}
