import { browserTracingIntegration, init } from "@sentry/browser";
import { enableRichArguments } from "@solidjs/web/server-functions/rich-args";

import {
  applyThemeMode,
  readThemeMode,
} from "../components/ui/theme/theme-mode";
import {
  SENTRY_TUNNEL_PATH,
  sentryDefaultDataCollection,
} from "../shared/observability/sentry";
import { reloadOnStaleBuild } from "./stale-build";

// Browser setup that must run before the app renders. The plugin's generated
// client entry imports it first (`clientSetup` in vite.config.ts).

function startSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (typeof dsn !== "string" || !dsn) {
    return;
  }

  init({
    dsn,
    tunnel: SENTRY_TUNNEL_PATH,
    // Router 2 navigates through the History API, which this integration
    // instruments directly. It replaces @sentry/solid's router integration,
    // which is pinned to Solid 1 and Router 0.x/1.x.
    integrations: [browserTracingIntegration()],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1,
    dataCollection: sentryDefaultDataCollection(),
  });

  // Replay is heavy and never needed for the first paint.
  void import("@sentry/browser").then(({ addIntegration, replayIntegration }) =>
    addIntegration(replayIntegration()),
  );
}

if (import.meta.env.PROD) {
  startSentry();
}

reloadOnStaleBuild();

// Set before the first paint, so a dark-theme user never sees a light frame.
applyThemeMode(readThemeMode());

// Server functions cannot encode `undefined` in their default JSON arguments.
// The rich-argument codec preserves optional fields and other non-JSON values
// at every call site.
enableRichArguments();
