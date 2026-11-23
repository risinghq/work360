import { type RouteDefinition, useParams } from "@solidjs/router";

import { leadNavigationQuery } from "~/features/record-show/header/lead-navigation";
import { RecordShowPage } from "~/features/record-show/page/record-show-page";
import { leadDetailQuery } from "~/rpc/workflow/lead-detail";

export const route = {
  preload: ({ params }) => {
    if (!params.recordId) {
      return;
    }

    // Warming only. Nothing awaits this promise, so a rejection (an unknown
    // or deleted lead id is an expected one) would surface as an unhandled
    // rejection and reach Sentry. The page reads the same cached queries and
    // renders the failure through its error boundary.
    void Promise.allSettled([
      leadDetailQuery(params.recordId),
      leadNavigationQuery(),
    ]);
  },
} satisfies RouteDefinition;

export default function RecordShowRoute() {
  const params = useParams<{ recordId: string }>();

  return <RecordShowPage recordId={params.recordId} />;
}
