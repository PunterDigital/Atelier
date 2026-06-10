import { createTRPCRouter } from "../init";
import { businessRouter } from "./business";
import { clientsRouter } from "./clients";
import { healthRouter } from "./health";
import { projectsRouter } from "./projects";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  business: businessRouter,
  clients: clientsRouter,
  projects: projectsRouter,
});

export type AppRouter = typeof appRouter;
