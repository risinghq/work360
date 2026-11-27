import { createIcon } from "./create-icon";

const iconNode = [
  [
    "path",
    {
      d: "M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z",
      key: "video-1",
    },
  ],
  [
    "path",
    {
      d: "M3 8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z",
      key: "video-2",
    },
  ],
] as const;

const Video = createIcon("video", iconNode);

export default Video;
