import { Router } from 'express';
const router = Router();
import { addManualCompanyEmail, createLeadList, exportLeads, findCities, findEmails, generateLeads, getLeadList, getLeadLists, getLeads, saveLeadList, updateLeadCategory, deleteLead, deleteLeadList } from '../controllers/lead.controller.js';
import { addCompanyEmailSchema, createLeadListSchema, findCitiesSchema, findEmailsSchema, generateLeadsSchema, saveLeadListSchema } from '../validation/lead.validation.js';
import { updateLeadCategorySchema } from '../validation/categoryAssignment.validation.js';
import authMiddleware from '../../middlewares/authMiddleware.js';
import validate from '../../middlewares/validate.middleware.js';


router.use(authMiddleware);

router.get('/', getLeads);
router.get('/export', exportLeads);
router.post('/generate_leads', validate(generateLeadsSchema), generateLeads);
router.post('/find_emails', validate(findEmailsSchema), findEmails);
router.post('/find_cities', validate(findCitiesSchema), findCities);
router.post('/save_list', validate(saveLeadListSchema), saveLeadList);
router.post('/create_list', validate(createLeadListSchema), createLeadList);
router.get('/lists', getLeadLists);
router.get('/lists/:id', getLeadList);
router.delete('/lists/:id', deleteLeadList);
router.delete('/:id', deleteLead);
router.patch('/:id/category', validate(updateLeadCategorySchema), updateLeadCategory);
router.post('/:id/company_emails', validate(addCompanyEmailSchema), addManualCompanyEmail);


export default router;
