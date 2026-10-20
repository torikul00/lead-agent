import { Router } from 'express';
const router = Router();
import { findCities, findEmails, generateLeads, getLeadList, getLeadLists, saveLeadList } from '../controllers/lead.controller.js';
import { findCitiesSchema, findEmailsSchema, generateLeadsSchema, saveLeadListSchema } from '../validation/lead.validation.js';
import authMiddleware from '../../middlewares/authMiddleware.js';
import validate from '../../middlewares/validate.middleware.js';


router.use(authMiddleware);

router.post('/generate_leads', validate(generateLeadsSchema), generateLeads);
router.post('/find_emails', validate(findEmailsSchema), findEmails);
router.post('/find_cities', validate(findCitiesSchema), findCities);
router.post('/save_list', validate(saveLeadListSchema), saveLeadList);
router.get('/lists', getLeadLists);
router.get('/lists/:id', getLeadList);


export default router;
