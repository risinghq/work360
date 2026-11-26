import { type JSX } from "@solidjs/web";
import { For, Show, createMemo, createSignal } from "solid-js";

import ChevronDown from "~/components/icons/chevron-down";
import { AnimatedExpandableContainer } from "~/components/ui/animation/animated-expandable-container";
import type { FieldKey, ObjectName } from "~/contracts/objects/registry";
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
  type RecordInlineCellEdit,
} from "~/features/widgets/field-table";
import {
  WidgetCard,
  WidgetCardContent,
  WidgetCardHeader,
  WidgetCardSubsectionChevron,
  WidgetCardSubsectionHeader,
  WidgetCardTitle,
} from "~/features/widgets/widget-card";

// A cell a record page draws itself, for a field the registry cannot render
// from a plain value: a relation chip, or a field edited in place.
export type RecordFieldCellRenderer = (entry: RecordFieldValue) => JSX.Element;

export type RecordFieldCells<O extends ObjectName> = Partial<
  Record<FieldKey<O>, RecordFieldCellRenderer>
>;

type CellLookup = Readonly<Partial<Record<string, RecordFieldCellRenderer>>>;

// One field cell with the registry's label and icon.
export function RecordFieldCell(props: {
  entry: RecordFieldValue;
  empty?: boolean;
  edit?: RecordInlineCellEdit;
  children: JSX.Element;
}) {
  return (
    <RecordInlineCell
      label={props.entry.field.label}
      icon={fieldIcon(props.entry.field.icon)}
      empty={props.empty}
      edit={props.edit}
    >
      {props.children}
    </RecordInlineCell>
  );
}

function FieldList(props: {
  fields: ReadonlyArray<RecordFieldValue>;
  cells: CellLookup;
}) {
  return (
    <FieldTable>
      <For each={props.fields}>
        {(entry) => (
          <Show
            when={props.cells[entry.field.key]}
            fallback={
              <RecordFieldCell entry={entry} empty={entry.value === null}>
                <FieldTextValue>{entry.value}</FieldTextValue>
              </RecordFieldCell>
            }
          >
            {(render) => render()(entry)}
          </Show>
        )}
      </For>
    </FieldTable>
  );
}

function FieldGroupSection(props: {
  group: RecordFieldGroup;
  cells: CellLookup;
}) {
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
        <FieldList fields={props.group.fields} cells={props.cells} />
      </AnimatedExpandableContainer>
    </section>
  );
}

// Twenty's FieldsWidget: the registry's field groups for one record, with
// group headers only when there is more than one group.
export function RecordFieldsWidget<O extends ObjectName>(props: {
  object: O;
  record: Readonly<Record<string, unknown>>;
  cells?: RecordFieldCells<O>;
}) {
  const groups = createMemo(() =>
    recordFieldGroups(props.object, props.record),
  );
  const cells = (): CellLookup => props.cells ?? {};
  return (
    <WidgetCard variant="side-column">
      <WidgetCardHeader>
        <WidgetCardTitle text="Campos" />
      </WidgetCardHeader>
      <WidgetCardContent>
        <Show
          when={groups().length > 1}
          fallback={
            <FieldList
              fields={groups().flatMap((group) => group.fields)}
              cells={cells()}
            />
          }
        >
          <For each={groups()}>
            {(group) => <FieldGroupSection group={group} cells={cells()} />}
          </For>
        </Show>
      </WidgetCardContent>
    </WidgetCard>
  );
}
