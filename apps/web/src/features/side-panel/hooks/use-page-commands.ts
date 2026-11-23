import { onCleanup } from "solid-js";

import { useSidePanel } from "../state/use-side-panel";
import type { PageCommandSource } from "../types/page-commands";

// Shows the current page's own actions at the top of the command menu, the
// way Twenty folds record actions into its command menu instead of a
// separate "more" menu.
export function usePageCommands(source: PageCommandSource): void {
  const { registerPageCommands } = useSidePanel();

  onCleanup(registerPageCommands(source));
}
