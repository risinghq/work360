import type { HostedVideoProvider } from "~/contracts/meetings/views";
import type { UserId } from "~/domain/ids";

export type VideoRoomSpec = {
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
};

export type VideoRoom = { joinUrl: string; externalId: string };

// One provider account that opens rooms. Each call throws when the provider
// refuses or cannot be reached; the meetings runtime decides what that means.
export interface VideoRoomHost {
  create(spec: VideoRoomSpec): Promise<VideoRoom>;
  update(externalId: string, spec: VideoRoomSpec): Promise<void>;
  // A room the provider no longer has counts as removed.
  remove(externalId: string): Promise<void>;
}

// The hosted providers a member can use. A workspace connection (Zoom) serves
// every member; a personal one (Google, Microsoft) serves only its owner.
export interface VideoRooms {
  available(userId: UserId): Promise<HostedVideoProvider[]>;
  host(
    provider: HostedVideoProvider,
    userId: UserId,
  ): Promise<VideoRoomHost | null>;
}

export const NO_VIDEO_ROOMS: VideoRooms = {
  available: async () => [],
  host: async () => null,
};
