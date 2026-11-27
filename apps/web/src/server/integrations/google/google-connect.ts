import { parseCookieHeader, serializeCookie } from "@solidjs/web";
import { decodeIdToken, Google } from "arctic";

import { googleOAuthConfig } from "~/server/platform/config/env";
import { isProduction } from "~/shared/observability/runtime-env";
import { Err, Ok, type Result } from "~/shared/result";
import { isPlainRecord } from "~/shared/type-guards";

// A member connects Google to host Meet links. This flow is separate from
// "Continuar con Google": it asks for the calendar scope and an offline
// refresh token, and returns to its own callback.
export const GOOGLE_CONNECT_CALLBACK_PATH = "/api/integrations/google/callback";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
const SCOPES = ["openid", "email", CALENDAR_SCOPE];

const COOKIE_MAX_AGE = 600;
const STATE_COOKIE = "google_connect_state";
const VERIFIER_COOKIE = "google_connect_verifier";

function client(publicOrigin: string): Google {
  const env = googleOAuthConfig();
  return new Google(
    env.googleClientId,
    env.googleClientSecret,
    `${publicOrigin}${GOOGLE_CONNECT_CALLBACK_PATH}`,
  );
}

// `prompt=consent` makes Google issue a refresh token on every connection,
// not only the first.
export function googleConnectUrl(
  publicOrigin: string,
  state: string,
  codeVerifier: string,
): URL {
  const url = client(publicOrigin).createAuthorizationURL(
    state,
    codeVerifier,
    SCOPES,
  );
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url;
}

export type GoogleGrant = { email: string; refreshToken: string };

// `calendar_denied` is a member who unticked the calendar box on Google's
// consent screen: the grant could not host a Meet link.
export async function exchangeGoogleConnectCode(
  publicOrigin: string,
  code: string,
  codeVerifier: string,
): Promise<Result<GoogleGrant, "invalid" | "calendar_denied">> {
  let tokens;
  try {
    tokens = await client(publicOrigin).validateAuthorizationCode(
      code,
      codeVerifier,
    );
  } catch {
    return Err("invalid");
  }
  if (!tokens.hasScopes() || !tokens.scopes().includes(CALENDAR_SCOPE)) {
    return Err("calendar_denied");
  }
  const claims = decodeIdToken(tokens.idToken());
  if (
    !tokens.hasRefreshToken() ||
    !isPlainRecord(claims) ||
    typeof claims.email !== "string"
  ) {
    return Err("invalid");
  }
  return Ok({ email: claims.email, refreshToken: tokens.refreshToken() });
}

function cookie(name: string, value: string, maxAge: number): string {
  return serializeCookie(name, value, {
    path: "/api/integrations/google",
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    maxAge,
  });
}

export function appendGoogleConnectCookies(
  headers: Headers,
  params: { state: string; codeVerifier: string },
): void {
  headers.append(
    "Set-Cookie",
    cookie(STATE_COOKIE, params.state, COOKIE_MAX_AGE),
  );
  headers.append(
    "Set-Cookie",
    cookie(VERIFIER_COOKIE, params.codeVerifier, COOKIE_MAX_AGE),
  );
}

export function appendClearedGoogleConnectCookies(headers: Headers): void {
  headers.append("Set-Cookie", cookie(STATE_COOKIE, "", 0));
  headers.append("Set-Cookie", cookie(VERIFIER_COOKIE, "", 0));
}

export function readGoogleConnectCookies(header: string | null): {
  state: string | null;
  codeVerifier: string | null;
} {
  const cookies = parseCookieHeader(header ?? "");
  return {
    state: cookies[STATE_COOKIE] ?? null,
    codeVerifier: cookies[VERIFIER_COOKIE] ?? null,
  };
}
