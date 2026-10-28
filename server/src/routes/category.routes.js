import { Router } from 'express';
import { createCategory, deleteCategory, getCategories, updateCategory } from '../controllers/category.controller.js';
import authMiddleware from '../../middlewares/authMiddleware.js';
import validate from '../../middlewares/validate.middleware.js';
import { createCategorySchema } from '../validation/category.validation.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getCategories);
router.post('/', validate(createCategorySchema), createCategory);
router.patch('/:id', validate(createCategorySchema), updateCategory);
router.delete('/:id', deleteCategory);

export default router;
