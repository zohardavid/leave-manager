import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth.js";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import requestsRouter from "./requests.js";
import soldiersRouter from "./soldiers.js";
import roundsRouter from "./rounds.js";
import swapsRouter from "./swaps.js";
import pushRouter from "./push.js";
import notificationsRouter from "./notifications.js";
import configRouter from "./config.js";
import sheetsRouter from "./sheets.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);

// All routes below require a valid JWT
router.use(requireAuth);
router.use("/requests", requestsRouter);
router.use("/soldiers", soldiersRouter);
router.use("/rounds", roundsRouter);
router.use("/swaps", swapsRouter);
router.use("/push", pushRouter);
router.use("/notifications", notificationsRouter);
router.use("/config", configRouter);
router.use("/sheets", sheetsRouter);

export default router;
