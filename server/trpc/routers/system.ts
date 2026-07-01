import { z } from "zod";

import { currentVersion } from "@/lib/version";
import {
  getUpdateChecksEnabled,
  getUpdateStatus,
  isCloudInstance,
  setUpdateChecksEnabled,
} from "@/server/updates";

import { createTRPCRouter, permissionProcedure } from "../init";

// Instance-wide administration (System Administration in Settings) - all
// gated the same way as the rest of settings, but the data itself lives
// outside the business tenancy model (see db/schema.ts's instance_settings).
export const systemRouter = createTRPCRouter({
  // What the System Administration card renders: whether this is the
  // managed cloud instance (in which case the section has nothing to show),
  // the running version, and the current toggle state.
  settings: permissionProcedure("settings.manageUpdates").query(async () => ({
    isCloudInstance: isCloudInstance(),
    currentVersion: currentVersion(),
    updateChecksEnabled: await getUpdateChecksEnabled(),
  })),

  setUpdateChecksEnabled: permissionProcedure("settings.manageUpdates")
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      await setUpdateChecksEnabled(input.enabled);
      return { ok: true };
    }),

  // Backs the update-available banner. Gated like the rest of this router:
  // only whoever can act on an update (turn checks off, pull a new image)
  // sees the prompt.
  updateStatus: permissionProcedure("settings.manageUpdates").query(() =>
    getUpdateStatus(),
  ),
});
