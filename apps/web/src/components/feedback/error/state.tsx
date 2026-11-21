import { Show } from "solid-js";

import { Button } from "~/components/ui/input/button";

import styles from "./state.module.css";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState(props: ErrorStateProps) {
  return (
    <section class={styles.root} role="alert" aria-live="assertive">
      <h2 class={styles.title}>
        {props.title ?? "No se pudo mostrar esta página"}
      </h2>
      <p class={styles.message}>{props.message}</p>
      <Show when={props.onRetry}>
        <div class={styles.actions}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              props.onRetry?.();
            }}
          >
            Reintentar
          </Button>
        </div>
      </Show>
    </section>
  );
}
