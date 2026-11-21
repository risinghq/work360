import type { JSX } from "@solidjs/web";
import { Errored } from "solid-js";

import { NotFoundPage } from "~/components/layout/not-found-page";
import { parseWireError } from "~/contracts/errors";
import { createLogger } from "~/shared/observability/runtime-logger";

import { reportBoundaryError } from "./boundary-utils";
import { ErrorState } from "./state";

interface AppErrorBoundaryProps {
  children: JSX.Element;
  title?: string;
}

const logger = createLogger("app-error-boundary");

export function AppErrorBoundary(props: AppErrorBoundaryProps) {
  return (
    <Errored
      fallback={(error, reset) => {
        // Solid 2 hands the fallback an accessor rather than the value.
        const thrown = error();
        const wire = parseWireError(thrown);

        // A missing record is an expected outcome, not a fault: it gets the
        // same page as an unknown URL and is not reported.
        if (wire.kind === "not_found") {
          return <NotFoundPage />;
        }

        reportBoundaryError(logger, thrown);

        // A fault's own message names code, so the member sees the wire
        // message, which is generic for anything but an expected error.
        return (
          <ErrorState
            title={props.title}
            message={wire.message}
            onRetry={reset}
          />
        );
      }}
    >
      {props.children}
    </Errored>
  );
}
