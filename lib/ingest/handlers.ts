/** Registry of per-source ingest handlers, keyed by `sources.kind`. */

import type { KindHandler } from "./types";
import { trustpilotHandler } from "./trustpilot";
import { googlePlayHandler } from "./googleplay";
import { appStoreHandler } from "./appstore";

export const HANDLERS: Record<string, KindHandler> = {
  trustpilot: trustpilotHandler,
  google_play: googlePlayHandler,
  app_store: appStoreHandler,
};
