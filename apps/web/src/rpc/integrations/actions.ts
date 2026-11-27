import { getApplication } from "~/server/composition/application";
import { executeSessionServerFunctionResult } from "~/server/platform/action";
import {
  parseObject,
  validationFail,
} from "~/server/platform/action/input-reader";
import { Ok } from "~/shared/result";

export async function connectZoom(input: unknown) {
  "use server";

  return executeSessionServerFunctionResult({
    name: "integrations.connect_zoom",
    access: { kind: "permission", permission: "admin:manage" },
    parse: () =>
      parseObject(input, validationFail, (r) => ({
        accountId: r.str("accountId", { min: 1, max: 200 }),
        clientId: r.str("clientId", { min: 1, max: 200 }),
        clientSecret: r.str("clientSecret", { min: 1, max: 200 }),
      })),
    execute: (ctx, credentials) =>
      getApplication().integrations.connectZoom(ctx.actor.userId, credentials),
  });
}

export async function disconnectZoom() {
  "use server";

  return executeSessionServerFunctionResult({
    name: "integrations.disconnect_zoom",
    access: { kind: "permission", permission: "admin:manage" },
    parse: () => Ok(null),
    execute: async () => {
      await getApplication().integrations.disconnect("zoom");
      return Ok(null);
    },
  });
}
