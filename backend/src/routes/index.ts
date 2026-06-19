import { Router } from 'express';
import authRouter    from './auth.route';
import profileRouter from './profile.route';
import logsRouter    from './logs.route';
import foodsRouter   from './foods.route';
import weightRouter  from './weight.route';
import fastsRouter   from './fasts.route';

const router = Router();

router.use('/auth',    authRouter);
router.use('/profile', profileRouter);
router.use('/logs',    logsRouter);
router.use('/foods',   foodsRouter);
router.use('/weight',  weightRouter);
router.use('/fasts',   fastsRouter);

export default router;
