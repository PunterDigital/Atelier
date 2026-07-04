import { getDb } from "@/db";
import { exportBusinessData } from "@/modules/export/service";

import { createTRPCRouter, permissionProcedure } from "../init";

// The "export everything" capability. businessId comes from the tenancy
// boundary (permissionProcedure builds on businessProcedure), never from
// client input, so a caller can only ever export their own active business.
// The download route in app/api/export serves the same data as a file; this
// procedure is the programmatic entry point.
export const exportRouter = createTRPCRouter({
  everything: permissionProcedure("data.export").query(({ ctx }) =>
    exportBusinessData(getDb(), ctx.businessId),
  ),
});
