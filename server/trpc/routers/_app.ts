import { createTRPCRouter } from "../init";
import { businessRouter } from "./business";
import { clientsRouter } from "./clients";
import { healthRouter } from "./health";
import { projectsRouter } from "./projects";
import { tasksRouter } from "./tasks";
import { timeRouter } from "./time";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  business: businessRouter,
  clients: clientsRouter,
  projects: projectsRouter,
  tasks: tasksRouter,
  time: timeRouter,
});

export type AppRouter = typeof appRouter;
