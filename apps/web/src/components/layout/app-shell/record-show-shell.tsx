import { type JSX } from "@solidjs/web";
import { Loading, type ParentProps } from "solid-js";

import { PageCardLayout } from "~/components/ui/layout/page-card/page-card-layout";

import { RecordShowShellSkeleton } from "./skeletons/record-show-shell-skeleton";

// The record page frame every object shares: a page card whose header holds
// the object's breadcrumb and actions, and the record body below it.
export function RecordShowShell(props: ParentProps<{ header: JSX.Element }>) {
  return (
    <PageCardLayout header={props.header}>
      <Loading fallback={<RecordShowShellSkeleton />}>{props.children}</Loading>
    </PageCardLayout>
  );
}
