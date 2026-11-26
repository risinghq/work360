import type { FieldMetadata } from "~/contracts/objects/registry";

// A campaign file carries its own columns as facts on each record. The grid
// shows each one as a text field, in the order the file first used it.

export function factNames(
  records: ReadonlyArray<{ facts: Readonly<Record<string, string>> }>,
): string[] {
  return [...new Set(records.flatMap((record) => Object.keys(record.facts)))];
}

export function factLabel(fact: string): string {
  return fact.replaceAll("_", " ");
}

export function factField(fact: string): FieldMetadata {
  return {
    key: `fact.${fact}`,
    label: factLabel(fact),
    type: "TEXT",
    icon: "list",
  };
}
