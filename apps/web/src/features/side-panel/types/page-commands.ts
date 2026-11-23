import type { Accessor, Component } from "solid-js";

export type PageCommand = {
  id: string;
  label: string;
  icon: Component<{ size?: number }>;
  danger?: boolean;
  disabled?: boolean;
  onAction: () => void;
};

export type PageCommandGroup = {
  label: string;
  items: PageCommand[];
};

export type PageCommandSource = Accessor<PageCommandGroup | null>;
