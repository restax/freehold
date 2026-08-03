import { prisma } from "@freehold/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { emailOTP, mcp, organization, twoFactor, username } from "better-auth/plugins";
import { MCP_SCOPES, mcpResourceUrl } from "@/lib/mcp";
import { adminAlert } from "@/lib/notify";
import { platformEmailEnabled, sendPlatformEmail } from "@/lib/platform-email";
import { enforceSessionLimit } from "@/lib/session-limit";
import { TERMS_VERSION } from "@/lib/terms";
import {
  checkUsernameAvailability,
  normalizeUsername,
  USERNAME_MAX,
  USERNAME_MIN,
  usernameFormatError,
} from "@/lib/username";

type SocialProvider = { clientId: string; clientSecret: string };

// OAuth providers activate only when their env keys are present, so a
// self-hosted install works out of the box with email/password alone.
const socialProviders: Record<string, SocialProvider> = {};
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  socialProviders.microsoft = {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  };
}

// Six-digit email verification is enforced on Freehold Cloud (where the
// platform mailer exists). Self-hosted installs without Resend skip it so
// nobody gets locked out of their own server.
const requireEmailVerification = process.env.FREEHOLD_CLOUD === "1" && platformEmailEnabled();

export const auth = betterAuth({
  appName: "Freehold",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification,
    minPasswordLength: 8,
    async sendResetPassword({ user, url }) {
      if (!platformEmailEnabled()) return;
      await sendPlatformEmail(
        user.email,
        "Reset your Freehold password",
        `We received a request to reset your Freehold password. Click the link below to choose a new one:\n\n${url}\n\nThis link expires in an hour. If you didn't request it, ignore this email — your password is unchanged.`,
      );
    },
  },
  // Terms-of-service acceptance record. input: false on both means neither
  // is ever accepted from the client (so it can't be spoofed) — the
  // user.create.before hook below is the only writer, stamping every new
  // account with the version live at signup. The signup page's required
  // checkbox is the actual consent gesture; this only records that it
  // happened.
  user: {
    additionalFields: {
      termsAcceptedAt: { type: "date", required: false, input: false },
      termsVersion: { type: "string", required: false, input: false },
    },
  },
  // Extra Session columns for the concurrent-desktop-session limit (see
  // lib/session-limit.ts) — better-auth strips any field the adapter writes
  // that isn't declared here, even though it's a real Prisma column.
  session: {
    additionalFields: {
      deviceType: { type: "string", required: false, input: false },
      revoked: { type: "boolean", required: false, defaultValue: false, input: false },
      revokedReason: { type: "string", required: false, input: false },
    },
  },
  socialProviders,
  plugins: [
    organization(),
    twoFactor({ issuer: "Freehold" }),
    // Usernames double as subdomains. Format/length/reserved is enforced here
    // (sync); uniqueness against other usernames AND workspace slugs is enforced
    // in the user.create.before hook below, which shares the availability check
    // with the live signup endpoint.
    username({
      minUsernameLength: USERNAME_MIN,
      maxUsernameLength: USERNAME_MAX,
      usernameValidator: (value) => usernameFormatError(normalizeUsername(value)) === null,
    }),
    // Freehold is its own OAuth authorization server, so a TC can connect
    // their workspace to Claude without anyone handling a raw API key. The
    // plugin serves discovery, Dynamic Client Registration, /authorize and
    // /token under /api/auth/mcp/*; the MCP endpoint itself is /api/mcp.
    //
    // `resource` is set explicitly and must not be removed: the plugin would
    // otherwise default it to the bare origin, and Anthropic requires the
    // protected-resource metadata's `resource` to equal the connector URL the
    // user actually typed, path included.
    mcp({
      loginPage: "/login",
      resource: mcpResourceUrl(),
      oidcConfig: {
        // Required by the underlying OIDC options type. The mcp plugin
        // overwrites it with the `loginPage` above, so keep the two equal —
        // a mismatch here would be silently ignored, not flagged.
        loginPage: "/login",
        // Claude registers itself on each fresh connection rather than being
        // pre-registered, so DCR has to be open. It is not an unauthenticated
        // door into anything: registering a client grants nothing until a
        // real person signs in and approves it on the consent screen.
        allowDynamicClientRegistration: true,
        consentPage: "/oauth/consent",
        scopes: MCP_SCOPES,
        // Anthropic sends S256 on every authorization request; accepting the
        // plaintext challenge would only widen the attack surface.
        allowPlainCodeChallengeMethod: false,
      },
    }),
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      sendVerificationOnSignUp: requireEmailVerification,
      async sendVerificationOTP({ email, otp }) {
        if (!platformEmailEnabled()) return;
        await sendPlatformEmail(
          email,
          `${otp} is your Freehold verification code`,
          `Your Freehold verification code is: ${otp}\n\nIt expires in 10 minutes. If you didn't request it, ignore this email.`,
        );
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        // Authoritative gate: a username can't collide with another user or a
        // workspace slug (shared subdomain namespace). The plugin already
        // rejects malformed handles; this closes the async gap.
        before: async (user) => {
          const handle = (user as { username?: unknown }).username;
          if (typeof handle === "string" && handle.length > 0) {
            const check = await checkUsernameAvailability(handle);
            if (!check.available) {
              throw new APIError("BAD_REQUEST", {
                message: check.reason ?? "Username unavailable.",
              });
            }
          }
          return { data: { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION } };
        },
        after: async (user) => {
          adminAlert(`🆕 New Freehold signup: ${user.name} <${user.email}>`);
        },
      },
    },
    session: {
      create: {
        // Concurrent-desktop-session limit (Free/Pro only — see
        // lib/session-limit.ts): classifies this session's device type and,
        // for a non-exempt desktop sign-in, revokes any other live desktop
        // session for this user from a different IP. ipAddress/userAgent are
        // already resolved onto `session` by the time this runs.
        before: async (session) => {
          const { deviceType } = await enforceSessionLimit({
            userId: session.userId,
            ipAddress: (session as { ipAddress?: string }).ipAddress ?? null,
            userAgent: (session as { userAgent?: string }).userAgent ?? null,
          });
          return { data: { deviceType } };
        },
      },
    },
  },
});
