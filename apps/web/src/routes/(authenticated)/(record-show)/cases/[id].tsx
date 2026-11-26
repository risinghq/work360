import { type RouteDefinition, useParams } from "@solidjs/router";

import { RecordShowShell } from "~/components/layout/app-shell/record-show-shell";
import {
  CaseRecordHeader,
  CaseRecordPage,
} from "~/features/cases/case-record-page";
import { caseQuery } from "~/rpc/cases/queries";

export const route = {
  preload: ({ params }) => {
    if (params.id) {
      void caseQuery(params.id);
    }
  },
} satisfies RouteDefinition;

export default function CasePage() {
  const params = useParams<{ id: string }>();
  return (
    <RecordShowShell header={<CaseRecordHeader caseId={params.id} />}>
      <CaseRecordPage caseId={params.id} />
    </RecordShowShell>
  );
}
