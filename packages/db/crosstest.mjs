import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const ACME = "4S22tIvxC8OZq0k5YigGb8xHWqLsim7u";
const MAPLE = "919b03b4-129b-4abb-93a8-c1342207cce4";
const now = new Date();

// A user who belongs to Maplewood only.
const maple = await p.member.findFirst({
  where: { organizationId: MAPLE },
  include: { user: true },
});
const alsoInAcme = await p.member.findFirst({
  where: { organizationId: ACME, userId: maple.userId },
});
await p.organization.update({ where: { id: MAPLE }, data: { mcpEnabled: true } });

const clientId = "cross-tenant-probe";
await p.oauthApplication.upsert({
  where: { clientId },
  create: {
    id: randomUUID(),
    clientId,
    name: "Probe",
    redirectUrls: "https://claude.ai/api/mcp/auth_callback",
    type: "public",
    createdAt: now,
    updatedAt: now,
  },
  update: {},
});
await p.oauthAccessToken.deleteMany({ where: { accessToken: "cross_probe_token" } });
await p.oauthAccessToken.create({
  data: {
    id: randomUUID(),
    accessToken: "cross_probe_token",
    refreshToken: `rt_${randomUUID()}`,
    accessTokenExpiresAt: new Date(Date.now() + 3600e3),
    refreshTokenExpiresAt: new Date(Date.now() + 7 * 864e5),
    clientId,
    userId: maple.userId,
    scopes: "openid",
    createdAt: now,
    updatedAt: now,
  },
});

// Deliberately point their connection at ACME — a workspace they are NOT in.
await p.mcpConnection.upsert({
  where: { userId_clientId: { userId: maple.userId, clientId } },
  create: { tenantId: ACME, userId: maple.userId, clientId, clientName: "Probe" },
  update: { tenantId: ACME, revokedAt: null },
});

console.log(
  JSON.stringify({
    user: maple.user.email,
    memberOfAcme: !!alsoInAcme,
    connectionPointsAt: "ACME",
  }),
);
await p.$disconnect();
