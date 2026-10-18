import { Router } from 'express';
const router = Router();
import { findEmails, generateLeads } from '../controllers/lead.controller.js';
import { findEmailsSchema, generateLeadsSchema } from '../validation/lead.validation.js';
import authMiddleware from '../../middlewares/authMiddleware.js';
import validate from '../../middlewares/validate.middleware.js';


router.use(authMiddleware);

router.post('/generate_leads', validate(generateLeadsSchema), generateLeads);
router.post('/find_emails', validate(findEmailsSchema), findEmails);


export default router;
