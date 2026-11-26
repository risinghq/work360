import { type RouteDefinition, useParams } from "@solidjs/router";

import { RecordShowShell } from "~/components/layout/app-shell/record-show-shell";
import {
  CompanyRecordHeader,
  CompanyRecordPage,
} from "~/features/companies/company-record-page";
import { companyQuery } from "~/rpc/companies/queries";

export const route = {
  preload: ({ params }) => {
    if (params.id) {
      void companyQuery(params.id);
    }
  },
} satisfies RouteDefinition;

export default function CompanyPage() {
  const params = useParams<{ id: string }>();
  return (
    <RecordShowShell header={<CompanyRecordHeader companyId={params.id} />}>
      <CompanyRecordPage companyId={params.id} />
    </RecordShowShell>
  );
}
