import { generateCodeVerifier, generateState } from "arctic";

import {
  appendGoogleConnectCookies,
  googleConnectUrl,
} from "~/server/integrations/google/google-connect";
import {
  authenticate,
  authorizePermission,
} from "~/server/platform/action/session";
import { getRequestContext } from "~/server/platform/http/request-context-storage";
import { isErr } from "~/shared/result";

export async function GET(): Promise<Response> {
  const session = await authenticate();
  if (
    isErr(session) ||
    isErr(authorizePermission(session.value, "meeting:schedule"))
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = googleConnectUrl(
    getRequestContext().publicOrigin,
    state,
    codeVerifier,
  );
  const headers = new Headers([["Location", url.toString()]]);
  appendGoogleConnectCookies(headers, { state, codeVerifier });
  return new Response(null, { status: 302, headers });
}
