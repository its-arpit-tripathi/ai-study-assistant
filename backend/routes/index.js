import { Router } from 'express';
import authRoutes from './authRoutes.js';
import documentRoutes from './documentRoutes.js';
import chatRoutes from './chatRoutes.js';
import healthRoutes from './healthRoutes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/', documentRoutes);
apiRouter.use('/', chatRoutes);
apiRouter.use('/', healthRoutes);

export default apiRouter;
