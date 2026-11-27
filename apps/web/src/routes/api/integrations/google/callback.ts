import type { APIEvent } from "filesystem-routing/api";

import { getApplication } from "~/server/composition/application";
import {
  appendClearedGoogleConnectCookies,
  exchangeGoogleConnectCode,
  readGoogleConnectCookies,
} from "~/server/integrations/google/google-connect";
import {
  authenticate,
  authorizePermission,
} from "~/server/platform/action/session";
import { getRequestContext } from "~/server/platform/http/request-context-storage";
import { isErr } from "~/shared/result";

// The settings page reads `google` to show the outcome in a snackbar.
type Outcome = "connected" | "denied" | "calendar_denied" | "failed";

function backToSettings(origin: string, outcome: Outcome): Response {
  const location = new URL("/settings/accounts", origin);
  location.searchParams.set("google", outcome);
  const headers = new Headers([["Location", location.toString()]]);
  appendClearedGoogleConnectCookies(headers);
  return new Response(null, { status: 302, headers });
}

export async function GET(event: APIEvent): Promise<Response> {
  const { publicOrigin } = getRequestContext();
  const session = await authenticate();
  if (
    isErr(session) ||
    isErr(authorizePermission(session.value, "meeting:schedule"))
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(event.request.url);
  if (url.searchParams.get("error")) {
    return backToSettings(publicOrigin, "denied");
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = readGoogleConnectCookies(event.request.headers.get("cookie"));
  if (!code || !state || !cookies.codeVerifier || state !== cookies.state) {
    return backToSettings(publicOrigin, "failed");
  }

  const grant = await exchangeGoogleConnectCode(
    publicOrigin,
    code,
    cookies.codeVerifier,
  );
  if (isErr(grant)) {
    return backToSettings(
      publicOrigin,
      grant.error === "calendar_denied" ? "calendar_denied" : "failed",
    );
  }
  await getApplication().integrations.connectGoogle(
    session.value.userId,
    grant.value,
  );
  return backToSettings(publicOrigin, "connected");
}
