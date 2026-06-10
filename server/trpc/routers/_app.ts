import { createTRPCRouter } from "../init";
import { businessRouter } from "./business";
import { clientsRouter } from "./clients";
import { healthRouter } from "./health";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  business: businessRouter,
  clients: clientsRouter,
});

export type AppRouter = typeof appRouter;
