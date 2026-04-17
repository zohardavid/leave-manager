import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import requestsRouter from "./requests.js";
import soldiersRouter from "./soldiers.js";
import roundsRouter from "./rounds.js";
import swapsRouter from "./swaps.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/requests", requestsRouter);
router.use("/soldiers", soldiersRouter);
router.use("/rounds", roundsRouter);
router.use("/swaps", swapsRouter);

export default router;
