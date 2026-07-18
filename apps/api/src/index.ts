import { prisma } from "@freehold/db";
import Fastify from "fastify";
import { Redis } from "ioredis";

const app = Fastify({ logger: true });

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
  : null;

app.get("/health", async (_req, reply) => {
  let db = false;
  let redisOk: boolean | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  if (redis) {
    try {
      if (redis.status === "wait") await redis.connect();
      redisOk = (await redis.ping()) === "PONG";
    } catch {
      redisOk = false;
    }
  }
  const ok = db && redisOk !== false;
  return reply.code(ok ? 200 : 503).send({
    status: ok ? "ok" : "degraded",
    db,
    redis: redisOk,
    service: "api",
    version: "0.0.0",
  });
});

/**
 * Validate a Better Auth session token (Authorization: Bearer <token>) and
 * return the caller's user + active tenant. Session records are shared with
 * the web app through the same database.
 */
app.get("/v1/me", async (req, reply) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return reply.code(401).send({ error: "missing_bearer_token" });
  }
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) {
    return reply.code(401).send({ error: "invalid_or_expired_session" });
  }
  return {
    user: { id: session.user.id, email: session.user.email, name: session.user.name },
    activeTenantId: session.activeOrganizationId,
  };
});

const port = Number(process.env.PORT ?? 3001);
app
  .listen({ port, host: "0.0.0.0" })
  .then(() => app.log.info(`Freehold API listening on :${port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
