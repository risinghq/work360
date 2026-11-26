import { createIcon } from "./create-icon";

const iconNode = [
  ["path", { d: "M12 5l0 14", key: "arrow-up-stem" }],
  ["path", { d: "M18 11l-6 -6", key: "arrow-up-right" }],
  ["path", { d: "M6 11l6 -6", key: "arrow-up-left" }],
] as const;

const ArrowUp = createIcon("arrow-up", iconNode);

export default ArrowUp;
