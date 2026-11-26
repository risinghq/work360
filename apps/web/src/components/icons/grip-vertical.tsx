import { createIcon } from "./create-icon";

const dot = (x: number, y: number) =>
  `M${x} ${y}m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0`;

const iconNode = [
  ["path", { d: dot(9, 5), key: "1" }],
  ["path", { d: dot(9, 12), key: "2" }],
  ["path", { d: dot(9, 19), key: "3" }],
  ["path", { d: dot(15, 5), key: "4" }],
  ["path", { d: dot(15, 12), key: "5" }],
  ["path", { d: dot(15, 19), key: "6" }],
] as const;

const GripVertical = createIcon("grip-vertical", iconNode);

export default GripVertical;
