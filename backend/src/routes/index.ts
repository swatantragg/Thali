import { Router } from 'express';
import authRouter    from './auth.route';
import profileRouter from './profile.route';
import logsRouter    from './logs.route';
import foodsRouter   from './foods.route';
import weightRouter  from './weight.route';

const router = Router();

router.use('/auth',    authRouter);
router.use('/profile', profileRouter);
router.use('/logs',    logsRouter);
router.use('/foods',   foodsRouter);
router.use('/weight',  weightRouter);

export default router;
