import { Router } from 'express';
const router = Router();
import { createTemplate, deleteTemplate, getTemplate, getTemplates, updateTemplate } from '../controllers/email.controller.js';
import { emailTemplateSchema } from '../validation/email.validation.js';
import authMiddleware from '../../middlewares/authMiddleware.js';
import validate from '../../middlewares/validate.middleware.js';


router.use(authMiddleware);

router.get('/templates', getTemplates);
router.get('/templates/:id', getTemplate);
router.post('/templates', validate(emailTemplateSchema), createTemplate);
router.patch('/templates/:id', validate(emailTemplateSchema), updateTemplate);
router.delete('/templates/:id', deleteTemplate);


export default router;
