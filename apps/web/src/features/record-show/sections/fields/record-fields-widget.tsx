import { For, Show, createMemo, createSignal } from "solid-js";

import ChevronDown from "~/components/icons/chevron-down";
import { AnimatedExpandableContainer } from "~/components/ui/animation/animated-expandable-container";
import type { ObjectName } from "~/contracts/objects/registry";
import { fieldIcon } from "~/features/object-registry/field-column";
import {
  recordFieldGroups,
  type RecordFieldGroup,
  type RecordFieldValue,
} from "~/features/record-show/model/field-groups";
import {
  FieldTable,
  FieldTextValue,
  RecordInlineCell,
} from "~/features/widgets/field-table";
import {
  WidgetCard,
  WidgetCardContent,
  WidgetCardHeader,
  WidgetCardSubsectionChevron,
  WidgetCardSubsectionHeader,
  WidgetCardTitle,
} from "~/features/widgets/widget-card";

function FieldList(props: { fields: ReadonlyArray<RecordFieldValue> }) {
  return (
    <FieldTable>
      <For each={props.fields}>
        {(entry) => (
          <RecordInlineCell
            label={entry.field.label}
            icon={fieldIcon(entry.field.icon)}
            empty={entry.value === null}
          >
            <FieldTextValue>{entry.value}</FieldTextValue>
          </RecordInlineCell>
        )}
      </For>
    </FieldTable>
  );
}

function FieldGroupSection(props: { group: RecordFieldGroup }) {
  const [isExpanded, setIsExpanded] = createSignal(true);
  return (
    <section>
      <WidgetCardSubsectionHeader onClick={() => setIsExpanded((v) => !v)}>
        <span>{props.group.name}</span>
        <WidgetCardSubsectionChevron isExpanded={isExpanded()}>
          <ChevronDown size={16} />
        </WidgetCardSubsectionChevron>
      </WidgetCardSubsectionHeader>
      <AnimatedExpandableContainer isExpanded={isExpanded()}>
        <FieldList fields={props.group.fields} />
      </AnimatedExpandableContainer>
    </section>
  );
}

// Twenty's FieldsWidget: the registry's field groups for one record, with
// group headers only when there is more than one group.
export function RecordFieldsWidget(props: {
  object: ObjectName;
  record: Readonly<Record<string, unknown>>;
}) {
  const groups = createMemo(() =>
    recordFieldGroups(props.object, props.record),
  );
  return (
    <WidgetCard variant="side-column">
      <WidgetCardHeader>
        <WidgetCardTitle text="Campos" />
      </WidgetCardHeader>
      <WidgetCardContent>
        <Show
          when={groups().length > 1}
          fallback={
            <FieldList fields={groups().flatMap((group) => group.fields)} />
          }
        >
          <For each={groups()}>
            {(group) => <FieldGroupSection group={group} />}
          </For>
        </Show>
      </WidgetCardContent>
    </WidgetCard>
  );
}
