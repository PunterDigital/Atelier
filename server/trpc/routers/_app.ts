import { createTRPCRouter } from "../init";
import { businessRouter } from "./business";
import { healthRouter } from "./health";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  business: businessRouter,
});

export type AppRouter = typeof appRouter;
