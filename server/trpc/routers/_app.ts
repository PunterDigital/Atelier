import { createTRPCRouter } from "../init";
import { businessRouter } from "./business";
import { clientsRouter } from "./clients";
import { dashboardRouter } from "./dashboard";
import { expensesRouter } from "./expenses";
import { healthRouter } from "./health";
import { invoicesRouter } from "./invoices";
import { projectsRouter } from "./projects";
import { tasksRouter } from "./tasks";
import { teamRouter } from "./team";
import { timeRouter } from "./time";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  business: businessRouter,
  clients: clientsRouter,
  projects: projectsRouter,
  tasks: tasksRouter,
  time: timeRouter,
  invoices: invoicesRouter,
  expenses: expensesRouter,
  team: teamRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
