import {
  type Accessor,
  type ParentProps,
  createContext,
  createSignal,
  useContext,
} from "solid-js";

import { selectCurrentEntry, selectNavigationStack } from "../core/selectors";
import type {
  PageCommandGroup,
  PageCommandSource,
} from "../types/page-commands";
import type {
  SidePanelNavigationEntry,
  SidePanelPageDefinition,
  SidePanelPageState,
} from "../types/side-panel-page";
import { createSidePanelStore } from "./store";

export type SidePanelContextValue = {
  isOpen: Accessor<boolean>;
  isClosing: Accessor<boolean>;
  currentEntry: Accessor<SidePanelNavigationEntry | null>;
  navigationStack: Accessor<SidePanelNavigationEntry[]>;
  searchText: Accessor<string>;
  panelWidth: Accessor<number>;
  getPageState: (pageId: string) => SidePanelPageState | undefined;
  updatePageState: (
    pageId: string,
    updater: (state: SidePanelPageState) => SidePanelPageState,
  ) => void;
  openPanel: (page: SidePanelPageDefinition) => void;
  closePanel: () => void;
  navigateTo: (
    page: SidePanelPageDefinition,
    opts?: { resetStack?: boolean },
  ) => void;
  goBack: () => void;
  navigateToStackIndex: (index: number) => void;
  onCloseAnimationComplete: () => void;
  setSearchText: (text: string) => void;
  setPanelWidth: (width: number) => void;
  pageCommands: Accessor<PageCommandGroup | null>;
  // Returns the unregister function. One page registers at a time; a stale
  // unregister does not clear a newer page's commands.
  registerPageCommands: (source: PageCommandSource) => () => void;
};

const SidePanelContext = createContext<SidePanelContextValue>();

export function SidePanelProvider(props: ParentProps) {
  const store = createSidePanelStore();
  const { state } = store;
  const currentEntry: Accessor<SidePanelNavigationEntry | null> = () =>
    selectCurrentEntry(state);
  const navigationStack: Accessor<SidePanelNavigationEntry[]> = () =>
    selectNavigationStack(state);
  const [pageCommandSource, setPageCommandSource] =
    createSignal<PageCommandSource | null>(null);

  const registerPageCommands = (source: PageCommandSource) => {
    setPageCommandSource(() => source);

    return () =>
      setPageCommandSource((current) => (current === source ? null : current));
  };

  const value: SidePanelContextValue = {
    isOpen: () => state.isOpen,
    isClosing: () => state.isClosing,
    currentEntry,
    navigationStack,
    searchText: () => state.searchText,
    panelWidth: store.panelWidth,
    getPageState: (pageId) => state.pageStateById[pageId],
    updatePageState: store.updatePageState,
    openPanel: store.openPanel,
    closePanel: store.closePanel,
    navigateTo: store.navigateTo,
    goBack: store.goBack,
    navigateToStackIndex: store.navigateToStackIndex,
    onCloseAnimationComplete: store.onCloseAnimationComplete,
    setSearchText: store.setSearchText,
    setPanelWidth: store.setPanelWidth,
    pageCommands: () => pageCommandSource()?.() ?? null,
    registerPageCommands,
  };

  return <SidePanelContext value={value}>{props.children}</SidePanelContext>;
}

export function useSidePanel(): SidePanelContextValue {
  const ctx = useContext(SidePanelContext);
  if (ctx === undefined) {
    throw new Error("useSidePanel must be used within a SidePanelProvider");
  }
  return ctx;
}
