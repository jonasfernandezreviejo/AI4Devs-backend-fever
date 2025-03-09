import { Router } from 'express';
import { getPositionCandidatesController } from '../presentation/controllers/positionController';

const router = Router();

// GET /positions/:id/candidates
router.get('/:id/candidates', getPositionCandidatesController);

export default router; 