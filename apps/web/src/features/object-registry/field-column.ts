import Building2 from "~/components/icons/building-2";
import CalendarDays from "~/components/icons/calendar-days";
import Info from "~/components/icons/info";
import List from "~/components/icons/list";
import Mail from "~/components/icons/mail";
import MapIcon from "~/components/icons/map";
import Package from "~/components/icons/package";
import Phone from "~/components/icons/phone";
import Target from "~/components/icons/target";
import TimelineEvent from "~/components/icons/timeline-event";
import User from "~/components/icons/user";
import Users from "~/components/icons/users";
import {
  isLabelIdentifier,
  objectField,
  type FieldIconName,
  type FieldKey,
  type FieldMetadata,
  type ObjectName,
} from "~/contracts/objects/registry";
import type {
  DataGridColumn,
  DataGridIcon,
} from "~/features/data-grid/model/types";

const FIELD_ICONS: Record<FieldIconName, DataGridIcon> = {
  building: Building2,
  calendar: CalendarDays,
  info: Info,
  list: List,
  mail: Mail,
  map: MapIcon,
  package: Package,
  phone: Phone,
  target: Target,
  timeline: TimelineEvent,
  user: User,
  users: Users,
};

export function fieldIcon(name: FieldIconName): DataGridIcon {
  return FIELD_ICONS[name];
}

type ColumnRendering<T> = Omit<
  DataGridColumn<T>,
  "key" | "label" | "icon" | "sticky"
>;

// The registry names the column; the caller says how a cell renders. The
// label identifier stays put while the grid scrolls, as in Twenty.
export function metadataColumn<T>(
  object: ObjectName,
  field: FieldMetadata,
  rendering: ColumnRendering<T>,
): DataGridColumn<T> {
  return {
    ...rendering,
    key: field.key,
    label: field.label,
    icon: fieldIcon(field.icon),
    sticky: isLabelIdentifier(object, field.key),
  };
}

export function fieldColumn<O extends ObjectName, T>(
  object: O,
  key: FieldKey<O>,
  rendering: ColumnRendering<T>,
): DataGridColumn<T> {
  return metadataColumn(object, objectField(object, key), rendering);
}
