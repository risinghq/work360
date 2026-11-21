import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { createSignal, createUniqueId, omit } from "solid-js";

import { InputErrorHelper } from "./input-error-helper";
import { InputLabel } from "./input-label";

import styles from "./field.module.css";

export interface FileInputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

// The native input stays in the form, hidden, so callers read `files` from its
// change event. The browser's own control would label itself in the OS
// language, so a Spanish one stands in for it.
export function FileInput(props: FileInputProps) {
  const others = omit(props, "label", "error", "class", "id");
  const inputId = props.id || createUniqueId();
  const [chosen, setChosen] = createSignal("");

  const watchChoice = (input: HTMLInputElement) => {
    input.addEventListener("change", () => {
      const names = Array.from(input.files ?? [], (file) => file.name);
      setChosen(names.join(", "));
    });
  };

  return (
    <div class={styles.field}>
      {props.label && (
        <InputLabel for={inputId}>
          {props.label}
          {props.required && <span class={styles.required}>*</span>}
        </InputLabel>
      )}
      <label
        class={clsx(
          styles.fileControl,
          props.error ? styles.errorControl : undefined,
          props.disabled ? styles.fileDisabled : undefined,
          props.class,
        )}
      >
        <input
          id={inputId}
          type="file"
          class={styles.fileNative}
          ref={watchChoice}
          {...others}
        />
        <span class={styles.fileButton}>
          {props.multiple ? "Elegir archivos" : "Elegir archivo"}
        </span>
        <span class={chosen() ? styles.fileName : styles.fileEmpty}>
          {chosen() || "Ningún archivo elegido"}
        </span>
      </label>
      {props.error && <InputErrorHelper>{props.error}</InputErrorHelper>}
    </div>
  );
}
