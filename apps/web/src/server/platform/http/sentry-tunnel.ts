// Relays a browser Sentry envelope to the ingest host. An envelope's first
// line is a JSON header naming its DSN. Only envelopes for our own DSN are
// relayed, so the route cannot post to another Sentry project.

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

interface Project {
  host: string;
  id: string;
}

export async function relaySentryEnvelope(
  request: Request,
  dsn: string,
  send: Fetch = fetch,
): Promise<Response> {
  const ours = dsnProject(dsn);
  if (!ours) {
    return new Response(null, { status: 404 });
  }
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }

  const envelope = new Uint8Array(await request.arrayBuffer());
  const named = dsnProject(envelopeDsn(envelope));
  if (!named || named.host !== ours.host || named.id !== ours.id) {
    return new Response(null, { status: 400 });
  }

  const upstream = await send(`https://${ours.host}/api/${ours.id}/envelope/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-sentry-envelope" },
    body: envelope,
  });
  return new Response(upstream.body, { status: upstream.status });
}

function envelopeDsn(envelope: Uint8Array): string {
  const end = envelope.indexOf(0x0a);
  const line = new TextDecoder().decode(
    end === -1 ? envelope : envelope.subarray(0, end),
  );
  try {
    const header: unknown = JSON.parse(line);
    const dsn =
      typeof header === "object" && header !== null
        ? Reflect.get(header, "dsn")
        : undefined;
    return typeof dsn === "string" ? dsn : "";
  } catch {
    return "";
  }
}

function dsnProject(dsn: string): Project | undefined {
  if (!dsn) {
    return undefined;
  }
  try {
    const url = new URL(dsn);
    const id = url.pathname.split("/").findLast((part) => part !== "");
    return id ? { host: url.host, id } : undefined;
  } catch {
    return undefined;
  }
}
