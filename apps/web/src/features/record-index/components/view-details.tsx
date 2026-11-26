import { type JSX } from "@solidjs/web";
import { Show } from "solid-js";

import ArrowDown from "~/components/icons/arrow-down";
import ArrowUp from "~/components/icons/arrow-up";
import X from "~/components/icons/x";
import { Button } from "~/components/ui/input/button";

import { useRecordIndex } from "../context/record-index-context";

import styles from "../styles/toolbar.module.css";

function Chip(props: {
  label: string;
  value?: string;
  icon?: JSX.Element;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <div class={styles.chip}>
      <button type="button" class={styles.chipLabel} onClick={props.onOpen}>
        {props.icon}
        <span>{props.label}</span>
        <Show when={props.value}>
          {(value) => <span class={styles.chipValue}>{value()}</span>}
        </Show>
      </button>
      <button
        type="button"
        class={styles.chipRemove}
        aria-label={`Quitar ${props.label}`}
        onClick={props.onRemove}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// The sort and filter the list shows, with Reset and Update view when they
// differ from the saved view, as Twenty's ViewBarDetails.
export function RecordIndexViewDetails() {
  const recordIndex = useRecordIndex();

  const sortChip = () => {
    const catalog = recordIndex.definition.sort?.catalog;
    const value = recordIndex.sorting?.value();
    if (!catalog || !value) return undefined;
    const field = catalog.fields.find((candidate) =>
      value.startsWith(`${candidate.prefix}_`),
    );
    return field
      ? { label: field.label, ascending: value.endsWith("_asc") }
      : undefined;
  };

  const filterChip = () => {
    const catalog = recordIndex.definition.filter?.catalog;
    const value = recordIndex.filtering?.value();
    if (!catalog || !value || value === catalog.defaultValue) return undefined;
    for (const field of catalog.fields) {
      const option = field.options.find(
        (candidate) => candidate.value === value,
      );
      if (option) return { label: `${field.label}:`, value: option.label };
    }
    return undefined;
  };

  return (
    <Show
      when={
        recordIndex.details &&
        (recordIndex.details.sortChanged() ||
          recordIndex.details.filterChanged())
      }
    >
      <div class={styles.viewDetails}>
        <div class={styles.viewDetailsChips}>
          <Show when={sortChip()}>
            {(chip) => (
              <Chip
                label={chip().label}
                icon={
                  chip().ascending ? (
                    <ArrowUp size={14} />
                  ) : (
                    <ArrowDown size={14} />
                  )
                }
                onOpen={() => recordIndex.columns.setOpenMenu("sort")}
                onRemove={() =>
                  recordIndex.sorting?.set(
                    recordIndex.definition.sort?.catalog.defaultValue,
                  )
                }
              />
            )}
          </Show>
          <Show when={sortChip() && filterChip()}>
            <div class={styles.viewDetailsSeparator} />
          </Show>
          <Show when={filterChip()}>
            {(chip) => (
              <Chip
                label={chip().label}
                value={chip().value}
                onOpen={() => recordIndex.columns.setOpenMenu("filter")}
                onRemove={() =>
                  recordIndex.filtering?.set(
                    recordIndex.definition.filter?.catalog.defaultValue,
                  )
                }
              />
            )}
          </Show>
        </div>
        <div class={styles.viewDetailsActions}>
          <button
            type="button"
            class={styles.toolbarButton}
            onClick={() => recordIndex.details?.reset()}
          >
            Restablecer
          </button>
          <Show when={recordIndex.details?.canSave}>
            <Button
              variant="secondary"
              size="compact"
              onClick={() => recordIndex.details?.update()}
            >
              Actualizar vista
            </Button>
          </Show>
        </div>
      </div>
    </Show>
  );
}
