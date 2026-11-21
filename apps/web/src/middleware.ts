import type { StartMiddleware } from "@solidjs/vite-plugin";
import { createAPIHandler } from "filesystem-routing/api";
import routes from "virtual:file-routes";

import { getSessionCookie } from "./server/auth/session/cookies";
import { sessionTokenWorkspace } from "./server/auth/session/tokens";
import { requestHost } from "./server/entrypoints/runtime";
import { middlewareConfig } from "./server/platform/config/middleware-config";
import { enforceAuthRequest } from "./server/platform/http/request-auth";
import { classifyRequest } from "./server/platform/http/request-class";
import { buildAnonymousRequestContext } from "./server/platform/http/request-context-builder";
import { securityHeaders } from "./server/platform/http/security-headers";
import { relaySentryEnvelope } from "./server/platform/http/sentry-tunnel";
import { generateRequestId, generateTraceId } from "./shared/observability/ids";
import { SENTRY_TUNNEL_PATH } from "./shared/observability/sentry";

const SECURITY_HEADERS = securityHeaders({
  development: import.meta.env.DEV,
});

// The Worker entry relays these before any Durable Object; this serves the
// Bun server.
const relaySentry: StartMiddleware = (event, next) =>
  new URL(event.request.url).pathname === SENTRY_TUNNEL_PATH
    ? relaySentryEnvelope(event.request, import.meta.env.VITE_SENTRY_DSN ?? "")
    : next();

const identifyRequest: StartMiddleware = (event, next) => {
  const { trustedProxy } = middlewareConfig();

  event.locals.requestContext = buildAnonymousRequestContext(
    event.request,
    {
      traceId: generateTraceId(),
      requestId: generateRequestId(),
      startedAt: new Date(), // clock-boundary: HTTP request arrival
      startedTicks: performance.now(),
    },
    trustedProxy,
  );

  return next();
};

const applySecurityHeaders: StartMiddleware = (event, next) => {
  const headers = event.response.headers;
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  return next();
};

const resolveSession: StartMiddleware = async (event, next) => {
  if (classifyRequest(new URL(event.request.url).pathname) === "page") {
    return next();
  }

  const host = await requestHost();
  event.locals.host = host;

  // The cookie names its workspace, so a request opens only that workspace's
  // store. Anonymous requests are the login, recovery, invite and webhook
  // flows, which run on the platform and find their workspace from what they
  // read.
  const token = getSessionCookie();
  const workspaceId = token ? sessionTokenWorkspace(token) : null;
  if (!token || !workspaceId) {
    return next();
  }

  const application = await host.workspace(workspaceId);
  const context = event.locals.requestContext;
  const principal = await application.sessions.resolve(token, {
    operationAt: context.startedAt,
  });
  if (principal) {
    event.locals.requestContext = { ...context, principal };
    event.locals.application = application;
  }

  return next();
};

const authorizeRequest: StartMiddleware = async (event, next) => {
  const decision = await enforceAuthRequest(event);
  return decision.kind === "allow" ? next() : decision.response;
};

const recordRequestTiming: StartMiddleware = async (event, next) => {
  const { startedTicks } = event.locals.requestContext;
  const response = await next();
  const duration = Math.round(performance.now() - startedTicks);

  response.headers.set("Server-Timing", `app;dur=${duration}`);

  return response;
};

// API routes are the GET/POST/... exports of modules under src/routes.
// `createAPIHandler` is fetch-style (request first) while the plugin hands every
// middleware the request event, so the event's request is passed through.
const handleApiRoutes = createAPIHandler(routes);

const serveApiRoutes: StartMiddleware = (event, next) =>
  handleApiRoutes(event.request, next);

export default [
  relaySentry,
  identifyRequest,
  applySecurityHeaders,
  resolveSession,
  authorizeRequest,
  recordRequestTiming,

  // Last, so every request above has already been identified, secured,
  // session-resolved, and authorized.
  serveApiRoutes,
] satisfies StartMiddleware[];
