import { prisma } from "@freehold/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { emailOTP, organization, twoFactor, username } from "better-auth/plugins";
import { adminAlert } from "@/lib/notify";
import { platformEmailEnabled, sendPlatformEmail } from "@/lib/platform-email";
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
        },
        after: async (user) => {
          adminAlert(`🆕 New Freehold signup: ${user.name} <${user.email}>`);
        },
      },
    },
  },
});
