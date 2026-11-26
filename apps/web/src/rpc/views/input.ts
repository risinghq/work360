import { isViewObject, type ViewObject } from "~/contracts/views/views";
import type { DomainError } from "~/domain/errors";
import { validationFail } from "~/server/platform/action/input-reader";
import { Err, Ok, type Result } from "~/shared/result";

// The reader has no pattern check, so the view object is checked after it.
export function requireViewObject<T extends { object: string }>(
  parsed: Result<T, DomainError>,
): Result<Omit<T, "object"> & { object: ViewObject }, DomainError> {
  if (!parsed.ok) return parsed;
  const { object } = parsed.value;
  return isViewObject(object)
    ? Ok({ ...parsed.value, object })
    : Err(validationFail("object", "invalid"));
}
