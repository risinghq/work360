/// <reference types="@solidjs/vite-plugin/virtual-modules" />
// The Worker: routes each API request to the Durable Object that holds the
// store it names, and serves the app there. Each object composes its own
// store's application and reaches its peers through `remote` ports, one
// Durable Object call per operation. A static asset never reaches this code;
// a path no asset matches does, and gets the app shell.
import { constantTimeEqual } from "@oslojs/crypto/subtle";
import {
  instrumentDurableObjectWithSentry,
  withSentry,
} from "@sentry/cloudflare";
import { DurableObject, type ServerWebSocket } from "cloudflare:workers";
import { handleRequest } from "virtual:solid-ssr-handler";

import {
  REALTIME_CLOSE,
  REALTIME_PING,
  REALTIME_PONG,
} from "~/contracts/realtime/channel";
import { WorkspaceId } from "~/domain/ids";
import { SESSION_COOKIE_NAME } from "~/server/auth/session/cookies";
import { sessionTokenWorkspace } from "~/server/auth/session/tokens";
import type { CompanyRegistryClient } from "~/server/client-search/ports";
import type {
  PlatformSurface,
  RequestHost,
} from "~/server/composition/application";
import type { WorkspacePorts } from "~/server/composition/platform-application";
import { dispatch, remote, type Invoke } from "~/server/composition/remote";
import {
  createStoreSchedule,
  reportAlarmFailure,
} from "~/server/composition/store-schedule";
import {
  composePlatform,
  composeRegistry,
  createHostServices,
  openWorkspaceInfrastructure,
  type HostStorage,
} from "~/server/composition/stores";
import {
  createWorkspaceApplication,
  type WorkspaceApplication,
} from "~/server/composition/workspace-application";
import { runInHost } from "~/server/entrypoints/runtime.workers";
import { workerSentryOptions } from "~/server/entrypoints/sentry.workers";
import { extensionCredentialWorkspace } from "~/server/extension/crypto";
import type { CommitEffects } from "~/server/platform/database/commit-effects";
import { createDurableObjectStore } from "~/server/platform/database/durable-object-store";
import { applyMigrations } from "~/server/platform/database/migrate";
import { PLATFORM_MIGRATIONS } from "~/server/platform/database/schema/platform";
import { REGISTRY_MIGRATIONS } from "~/server/platform/database/schema/registry";
import { WORKSPACE_MIGRATIONS } from "~/server/platform/database/schema/workspace";
import {
  localEnd,
  serveTransfer,
} from "~/server/platform/database/store-pages";
import {
  r2Blobs,
  type R2BucketLike,
} from "~/server/platform/files/r2-blob-store";
import { serveAppShell } from "~/server/platform/http/app-shell";
import { relaySentryEnvelope } from "~/server/platform/http/sentry-tunnel";
import { queueDuty } from "~/server/platform/jobs/job-queue";
import {
  createObjectAlarm,
  type ObjectAlarm,
} from "~/server/platform/schedule/object-alarm";
import type { Duty } from "~/server/platform/schedule/schedule";
import {
  upgradeSocket,
  type RealtimeSocket,
  type RealtimeSockets,
  type SocketPeer,
  type SocketUpgrade,
} from "~/server/realtime/sockets";
import { SENTRY_TUNNEL_PATH } from "~/shared/observability/sentry";

interface ObjectNamespace<Stub> {
  idFromName(name: string): import("cloudflare:workers").DurableObjectId;
  get(id: import("cloudflare:workers").DurableObjectId): Stub;
}

interface Served {
  fetch(request: Request): Promise<Response>;
}

// Runs one paged transfer operation on a store; see `serveTransfer`.
interface Transfer {
  transfer(operation: string, body: string): Promise<string>;
}

interface Env {
  ASSETS: Served;
  FILES: R2BucketLike;
  WORKSPACE: ObjectNamespace<
    Served & {
      invoke(
        workspaceId: WorkspaceId,
        path: string[],
        args: unknown[],
      ): Promise<unknown>;
      transfer(
        workspaceId: WorkspaceId,
        operation: string,
        body: string,
      ): Promise<string>;
    }
  >;
  PLATFORM: ObjectNamespace<Served & Transfer & { invoke: Invoke }>;
  REGISTRY: ObjectNamespace<Transfer & { invoke: Invoke }>;
  // Opens the store routes while set. Provisioning sets it, loads the stores
  // and deletes it.
  LOAD_TOKEN?: string;
}

// Set by the router on the request it forwards to a workspace object. The
// object checks it against its own id, so the header cannot open another
// workspace's store.
const WORKSPACE_HEADER = "x-workspace-id";

// The platform and the registry are one store each.
const PLATFORM_NAME = "platform";
const REGISTRY_NAME = "registry";

function platformStub(env: Env) {
  return env.PLATFORM.get(env.PLATFORM.idFromName(PLATFORM_NAME));
}

function workspaceStub(env: Env, workspaceId: WorkspaceId) {
  return env.WORKSPACE.get(env.WORKSPACE.idFromName(workspaceId));
}

function registryStub(env: Env) {
  return env.REGISTRY.get(env.REGISTRY.idFromName(REGISTRY_NAME));
}

function remotePlatform(env: Env): PlatformSurface {
  return remote<PlatformSurface>((path, args) =>
    platformStub(env).invoke(path, args),
  );
}

function remoteWorkspace(env: Env, workspaceId: WorkspaceId): WorkspacePorts {
  return remote<WorkspacePorts>((path, args) =>
    workspaceStub(env, workspaceId).invoke(workspaceId, path, args),
  );
}

function remoteRegistry(env: Env): CompanyRegistryClient {
  return remote<CompanyRegistryClient>((path, args) =>
    registryStub(env).invoke(path, args),
  );
}

// Each object holds one store, so the store name is not needed.
function objectStorage(
  storage: import("cloudflare:workers").DurableObjectState["storage"],
  env: Env,
): HostStorage {
  return {
    openStore: () => createDurableObjectStore(storage),
    openBlobs: r2Blobs(env.FILES),
  };
}

function readCookie(request: Request, name: string): string | null {
  for (const pair of request.headers.get("cookie")?.split(";") ?? []) {
    const separator = pair.indexOf("=");
    if (separator > 0 && pair.slice(0, separator).trim() === name) {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    }
  }
  return null;
}

// The workspace a request's credential names: the session cookie of a signed-in
// user, or the bearer token every extension request carries. Both are sealed
// under SESSION_SECRET or signed, so a forged one names no workspace.
async function requestWorkspace(request: Request): Promise<WorkspaceId | null> {
  const session = readCookie(request, SESSION_COOKIE_NAME);
  const fromSession = session ? sessionTokenWorkspace(session) : null;
  if (fromSession) {
    return fromSession;
  }
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? extensionCredentialWorkspace(authorization.slice(7).trim())
    : null;
}

function isSocketHandshake(request: Request): boolean {
  return request.headers.get("upgrade")?.toLowerCase() === "websocket";
}

// The 101 that hands the browser its end of the pair.
function switchedTo(client: unknown): Response {
  const init: ResponseInit & { webSocket: unknown } = {
    status: 101,
    webSocket: client,
  };
  return new Response(null, init);
}

// A handshake whose credential names no workspace has no session, and the
// platform object holds no sockets, so the Worker closes it here.
function refusedSocket(): Response {
  const pair = new WebSocketPair();
  pair[1].accept();
  pair[1].close(REALTIME_CLOSE.unauthenticated, "unauthenticated");
  return switchedTo(pair[0]);
}

async function route(request: Request, env: Env): Promise<Response> {
  const workspaceId = await requestWorkspace(request);
  if (!workspaceId) {
    return isSocketHandshake(request)
      ? refusedSocket()
      : platformStub(env).fetch(request);
  }
  const forwarded = new Request(request);
  forwarded.headers.set(WORKSPACE_HEADER, workspaceId);
  return workspaceStub(env, workspaceId).fetch(forwarded);
}

const STORE_ROUTE =
  /^\/api\/admin\/stores\/(platform|registry|workspaces\/([^/]+))\/(\w+)$/;

function holdsLoadToken(request: Request, env: Env): boolean {
  const authorization = request.headers.get("authorization");
  if (!env.LOAD_TOKEN || !authorization?.startsWith("Bearer ")) {
    return false;
  }
  const encoder = new TextEncoder();
  return constantTimeEqual(
    encoder.encode(authorization.slice(7).trim()),
    encoder.encode(env.LOAD_TOKEN),
  );
}

function storeTransfer(
  env: Env,
  name: string,
  id: string | undefined,
): Transfer | null {
  if (name === PLATFORM_NAME) {
    return platformStub(env);
  }
  if (name === REGISTRY_NAME) {
    return registryStub(env);
  }
  const parsed = WorkspaceId.parse(id);
  if (!parsed.ok) {
    return null;
  }
  const workspaceId = parsed.value;
  const stub = workspaceStub(env, workspaceId);
  return {
    transfer: (operation, body) => stub.transfer(workspaceId, operation, body),
  };
}

// `POST .../<operation>` runs one transfer operation on the store. Without the
// load token the routes do not exist.
async function storeRoute(
  request: Request,
  env: Env,
  match: RegExpExecArray,
): Promise<Response> {
  const transfer = holdsLoadToken(request, env)
    ? storeTransfer(env, match[1] ?? "", match[2])
    : null;
  if (!transfer) {
    return new Response(null, { status: 404 });
  }
  try {
    if (request.method !== "POST") {
      return new Response(null, { status: 405 });
    }
    const body = await transfer.transfer(match[3] ?? "", await request.text());
    return new Response(body, {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return new Response(String(error), { status: 409 });
  }
}

export default withSentry(workerSentryOptions, {
  fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const store = STORE_ROUTE.exec(pathname);
    if (store) {
      return storeRoute(request, env, store);
    }
    if (pathname === SENTRY_TUNNEL_PATH) {
      return relaySentryEnvelope(
        request,
        import.meta.env.VITE_SENTRY_DSN ?? "",
      );
    }
    return pathname.startsWith("/api/") || pathname.startsWith("/_server")
      ? route(request, env)
      : serveAppShell(request, env.ASSETS);
  },
});

// An object's store with the alarm that runs its duties. Each invocation
// settles the alarm when it ends, so a write that brings a deadline closer
// moves the alarm without a wake call.
class StoreAlarm {
  readonly #alarm: ObjectAlarm;

  constructor(
    readonly store: string,
    storage: import("cloudflare:workers").DurableObjectState["storage"],
    duties: Duty[],
    effects: CommitEffects,
  ) {
    this.#alarm = createObjectAlarm(
      createStoreSchedule(store, duties),
      effects,
      storage,
    );
  }

  async around<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } finally {
      await this.settle();
    }
  }

  async settle(): Promise<void> {
    try {
      // clock-boundary: alarm. The deadline is compared to the wall clock.
      await this.#alarm.settle(new Date());
    } catch (error: unknown) {
      reportAlarmFailure("alarm_failed", { store: this.store }, error);
    }
  }

  // A throw makes the runtime retry the alarm with backoff.
  fire(): Promise<void> {
    // clock-boundary: alarm. Each firing is its own inbound event, so every
    // row it touches carries the same instant.
    return this.#alarm.fire(new Date());
  }
}

// The store of one object, migrated, as a transfer end. `reset` composes the
// object again over the loaded rows and arms the alarm for their deadlines.
function objectTransfer(
  storage: import("cloudflare:workers").DurableObjectState["storage"],
  migrations: readonly (readonly string[])[],
  reset: () => Promise<void>,
): Transfer {
  const migrated = async () => {
    const store = createDurableObjectStore(storage);
    await applyMigrations(store, migrations);
    return store;
  };
  return {
    transfer: async (operation, body) =>
      serveTransfer(
        localEnd(await migrated(), migrations, { committed: reset }),
        operation,
        body,
      ),
  };
}

// What a socket carries through hibernation.
interface SocketAttachment {
  id: string;
  openedAt: number;
}

function isSocketAttachment(value: unknown): value is SocketAttachment {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "openedAt" in value &&
    typeof value.openedAt === "number"
  );
}

// A socket may close between listing and use, and the runtime throws on a
// send or close after that. Its close event follows, so the throw is dropped.
function quietly(act: () => void): void {
  try {
    act();
  } catch {
    // Already closed.
  }
}

function peerOf(socket: ServerWebSocket): SocketPeer {
  return {
    send: (frame) => quietly(() => socket.send(frame)),
    close: (code, reason) => quietly(() => socket.close(code, reason)),
  };
}

// The handshake an object completes after the request handler returns, since
// the handler cannot carry a 101.
interface ObjectHandshake {
  response: Response;
  // Makes a socket that is still open at the end of the request hibernatable.
  settle: () => void;
}

interface ObjectSockets {
  realtime: RealtimeSockets;
  upgrade: (answer: { handshake: ObjectHandshake | null }) => SocketUpgrade;
}

// The object's sockets. An open one is hibernatable and tagged with its topic,
// so the runtime lists it again after the object wakes.
//
// A close sent on a hibernatable socket during the request that opened it
// reaches the client only about 36 s later (workerd 1.20261118), while frames
// arrive at once. So a socket stays unaccepted until its first frame or the end
// of its request, and one closed before either is a plain socket the object
// forgets. Until then the object lists it from memory.
function objectSockets(
  ctx: import("cloudflare:workers").DurableObjectState,
): ObjectSockets {
  const unaccepted = new Map<
    string,
    { topic: string; socket: RealtimeSocket }
  >();

  function hibernating(topic: string): RealtimeSocket[] {
    return ctx.getWebSockets(topic).flatMap((socket) => {
      const attachment = socket.deserializeAttachment();
      return isSocketAttachment(attachment)
        ? [{ ...attachment, ...peerOf(socket) }]
        : [];
    });
  }

  function upgrade(answer: {
    handshake: ObjectHandshake | null;
  }): SocketUpgrade {
    return (request) => {
      const pair = new WebSocketPair();
      const server = pair[1];
      let accepted = false;
      const hibernate = (): void => {
        if (accepted) {
          return;
        }
        accepted = true;
        unaccepted.delete(request.id);
        ctx.acceptWebSocket(
          server,
          request.topic === null ? [] : [request.topic],
        );
        const attachment: SocketAttachment = {
          id: request.id,
          openedAt: request.openedAt,
        };
        server.serializeAttachment(attachment);
      };
      const peer: SocketPeer = {
        send(frame) {
          hibernate();
          quietly(() => server.send(frame));
        },
        close(code, reason) {
          if (!accepted) {
            accepted = true;
            unaccepted.delete(request.id);
            server.accept();
          }
          quietly(() => server.close(code, reason));
        },
      };
      if (request.topic !== null) {
        unaccepted.set(request.id, {
          topic: request.topic,
          socket: { id: request.id, openedAt: request.openedAt, ...peer },
        });
      }
      request.open(peer);
      answer.handshake = { response: switchedTo(pair[0]), settle: hibernate };
    };
  }

  return {
    realtime: {
      // The runtime reports a close to the object, not to the socket's owner.
      accept: (socketUpgrade, topic) =>
        upgradeSocket(socketUpgrade, topic, () => {}),
      onTopic: (topic) => [
        ...hibernating(topic),
        ...[...unaccepted.values()]
          .filter((entry) => entry.topic === topic)
          .map((entry) => entry.socket),
      ],
    },
    upgrade,
  };
}

interface OpenedWorkspace {
  workspaceId: WorkspaceId;
  app: WorkspaceApplication;
  alarm: StoreAlarm;
}

class WorkspaceObjectBase extends DurableObject<Env> {
  #opened: OpenedWorkspace | null = null;
  readonly #sockets: ObjectSockets;

  constructor(ctx: import("cloudflare:workers").DurableObjectState, env: Env) {
    super(ctx, env);
    this.#sockets = objectSockets(ctx);
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(REALTIME_PING, REALTIME_PONG),
    );
  }

  // Composed on the first call, which names the workspace this object holds.
  async #open(workspaceId: WorkspaceId): Promise<OpenedWorkspace> {
    if (this.#opened) {
      if (this.#opened.workspaceId !== workspaceId) {
        throw new Error("workspace_mismatch");
      }
      return this.#opened;
    }
    this.#checkHolds(workspaceId);
    const services = createHostServices();
    const infrastructure = await openWorkspaceInfrastructure(
      objectStorage(this.ctx.storage, this.env),
      workspaceId,
    );
    // Another call may have composed it while the store opened.
    if (!this.#opened) {
      const app = createWorkspaceApplication(
        infrastructure,
        {
          ...services,
          platform: remotePlatform(this.env).inbound,
          registry: remoteRegistry(this.env),
        },
        this.#sockets.realtime,
      );
      this.#opened = {
        workspaceId,
        app,
        alarm: new StoreAlarm(
          `workspace:${workspaceId}`,
          this.ctx.storage,
          app.createDuties(),
          infrastructure.effects,
        ),
      };
    }
    return this.#opened;
  }

  #checkHolds(workspaceId: WorkspaceId): void {
    if (!this.ctx.id.equals(this.env.WORKSPACE.idFromName(workspaceId))) {
      throw new Error("workspace_mismatch");
    }
  }

  #transfer(workspaceId: WorkspaceId): Transfer {
    this.#checkHolds(workspaceId);
    return objectTransfer(this.ctx.storage, WORKSPACE_MIGRATIONS, async () => {
      this.#opened = null;
      await (await this.#open(workspaceId)).alarm.settle();
    });
  }

  transfer(
    workspaceId: WorkspaceId,
    operation: string,
    body: string,
  ): Promise<string> {
    return this.#transfer(workspaceId).transfer(operation, body);
  }

  async fetch(request: Request): Promise<Response> {
    const parsed = WorkspaceId.parse(request.headers.get(WORKSPACE_HEADER));
    if (!parsed.ok) {
      return new Response(null, { status: 400 });
    }
    const workspaceId = parsed.value;
    const { app, alarm } = await this.#open(workspaceId);
    const host: RequestHost = {
      platform: remotePlatform(this.env),
      workspace: (id) =>
        id === workspaceId
          ? Promise.resolve(app)
          : Promise.reject(new Error("workspace_mismatch")),
    };
    if (!isSocketHandshake(request)) {
      return alarm.around(() => runInHost(host, () => handleRequest(request)));
    }
    const answer: { handshake: ObjectHandshake | null } = { handshake: null };
    const socketUpgrade = this.#sockets.upgrade(answer);
    const response = await alarm.around(() =>
      runInHost(host, () =>
        handleRequest(request, { event: { locals: { socketUpgrade } } }),
      ),
    );
    const { handshake } = answer;
    if (!handshake) {
      return response;
    }
    handshake.settle();
    return handshake.response;
  }

  // Frames from the browser are pings, which the auto-response answers
  // without waking the object.
  webSocketMessage(): void {}

  // Completes the closing handshake the browser started.
  webSocketClose(socket: ServerWebSocket, code: number, reason: string): void {
    quietly(() => socket.close(code, reason));
  }

  async invoke(
    workspaceId: WorkspaceId,
    path: string[],
    args: unknown[],
  ): Promise<unknown> {
    const { app, alarm } = await this.#open(workspaceId);
    return alarm.around(() => dispatch(app.inbound, path, args));
  }

  // The object was reached by `idFromName(workspaceId)`, so its name is the
  // workspace it holds.
  async alarm(): Promise<void> {
    const parsed = WorkspaceId.parse(this.ctx.id.name);
    if (!parsed.ok) {
      reportAlarmFailure(
        "alarm_failed",
        { store: "workspace" },
        new Error("workspace_alarm_without_name"),
      );
      return;
    }
    await (await this.#open(parsed.value)).alarm.fire();
  }
}

interface OpenedPlatform {
  application: PlatformSurface;
  alarm: StoreAlarm;
}

class PlatformObjectBase extends DurableObject<Env> {
  #opened: Promise<OpenedPlatform> | null = null;

  #open(): Promise<OpenedPlatform> {
    this.#opened ??= composePlatform(
      objectStorage(this.ctx.storage, this.env),
      createHostServices(),
      async (workspaceId) => remoteWorkspace(this.env, workspaceId),
    ).then(({ store, application }) => ({
      application,
      alarm: new StoreAlarm(
        PLATFORM_NAME,
        this.ctx.storage,
        application.createDuties(),
        store.effects,
      ),
    }));
    return this.#opened;
  }

  async fetch(request: Request): Promise<Response> {
    const { application, alarm } = await this.#open();
    const host: RequestHost = {
      platform: application,
      // The router sends a request that names a workspace to that
      // workspace's object, so a request here has none.
      workspace: () => Promise.reject(new Error("no_workspace_on_platform")),
    };
    return alarm.around(() => runInHost(host, () => handleRequest(request)));
  }

  async invoke(path: string[], args: unknown[]): Promise<unknown> {
    const { application, alarm } = await this.#open();
    return alarm.around(() => dispatch(application, path, args));
  }

  async alarm(): Promise<void> {
    await (await this.#open()).alarm.fire();
  }

  #transfer = objectTransfer(
    this.ctx.storage,
    PLATFORM_MIGRATIONS,
    async () => {
      this.#opened = null;
      await (await this.#open()).alarm.settle();
    },
  );

  transfer(operation: string, body: string): Promise<string> {
    return this.#transfer.transfer(operation, body);
  }
}

interface OpenedRegistry {
  client: CompanyRegistryClient;
  alarm: StoreAlarm;
}

class RegistryObjectBase extends DurableObject<Env> {
  #opened: Promise<OpenedRegistry> | null = null;

  #open(): Promise<OpenedRegistry> {
    this.#opened ??= composeRegistry(
      objectStorage(this.ctx.storage, this.env).openStore,
      createHostServices(),
      async (workspaceId) => remoteWorkspace(this.env, workspaceId),
    ).then(({ store, registry }) => ({
      client: registry.client,
      alarm: new StoreAlarm(
        REGISTRY_NAME,
        this.ctx.storage,
        [queueDuty(registry.createQueue())],
        store.effects,
      ),
    }));
    return this.#opened;
  }

  async invoke(path: string[], args: unknown[]): Promise<unknown> {
    const { client, alarm } = await this.#open();
    return alarm.around(() => dispatch(client, path, args));
  }

  async alarm(): Promise<void> {
    await (await this.#open()).alarm.fire();
  }

  #transfer = objectTransfer(
    this.ctx.storage,
    REGISTRY_MIGRATIONS,
    async () => {
      this.#opened = null;
      await (await this.#open()).alarm.settle();
    },
  );

  transfer(operation: string, body: string): Promise<string> {
    return this.#transfer.transfer(operation, body);
  }
}

// The wrap covers `fetch`, `alarm`, the socket handlers and the RPC methods,
// so an error thrown in `invoke` reaches Sentry from the object that threw it.
export const WorkspaceObject = instrumentDurableObjectWithSentry(
  workerSentryOptions,
  WorkspaceObjectBase,
);
export const PlatformObject = instrumentDurableObjectWithSentry(
  workerSentryOptions,
  PlatformObjectBase,
);
export const RegistryObject = instrumentDurableObjectWithSentry(
  workerSentryOptions,
  RegistryObjectBase,
);
