import { createIcon } from "./create-icon";

const iconNode = [
  ["path", { d: "M12 5l0 14", key: "arrow-down-stem" }],
  ["path", { d: "M18 13l-6 6", key: "arrow-down-right" }],
  ["path", { d: "M6 13l6 6", key: "arrow-down-left" }],
] as const;

const ArrowDown = createIcon("arrow-down", iconNode);

export default ArrowDown;
