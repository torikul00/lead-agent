import { Router } from 'express';
const router = Router();
import { registerUser, loginUser, getMe, updateMe, changePassword, logoutUser } from '../controllers/user.controller.js';
import authMiddleware from '../../middlewares/authMiddleware.js';
import { createFileUploadMiddleware, withUploadErrorHandling } from '../../middlewares/fileUpload.middleware.js';
import { authLimiter } from '../../middlewares/rateLimit.middleware.js';


router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.get('/me', authMiddleware, getMe);

router.patch('/me', authMiddleware, withUploadErrorHandling(createFileUploadMiddleware({ kind: 'avatar' })), updateMe);
router.patch('/me/password', authMiddleware, changePassword);
router.post('/logout', logoutUser);


export default router;
