export interface SecurityHeaderOptions {
  /**
   * The Vite dev server injects inline, unhashable scripts (the HMR client and
   * module preloads), so development relaxes script-src. A build's document is
   * the static shell, whose only script is the client entry file.
   */
  development: boolean;
}

export function securityHeaders(
  options: SecurityHeaderOptions,
): Record<string, string> {
  const scriptSrc = options.development
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self'";

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Sentry Replay compresses recordings in a worker it builds from a blob.
    // Only a script that script-src already admitted can create one.
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // The browser reports to Sentry through the same-origin tunnel.
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'none'",
  ].join("; ");

  return {
    "Content-Security-Policy": csp,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    ...(options.development
      ? {}
      : { "Strict-Transport-Security": "max-age=63072000; includeSubDomains" }),
  };
}
