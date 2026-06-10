import { createTRPCRouter, publicProcedure } from "../init";

export const healthRouter = createTRPCRouter({
  ping: publicProcedure.query(() => ({
    ok: true as const,
    time: new Date(),
  })),
});
