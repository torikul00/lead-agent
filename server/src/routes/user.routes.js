import { Router } from 'express';
const router = Router();
import { registerUser, loginUser, verifyEmail, resendVerificationCode, getMe, updateMe, changePassword, logoutUser } from '../controllers/user.controller.js';
import { registerSchema, loginSchema, verifyEmailSchema, updateMeSchema, changePasswordSchema } from '../validation/user.validation.js';
import authMiddleware from '../../middlewares/authMiddleware.js';
import validate from '../../middlewares/validate.middleware.js';
import { createFileUploadMiddleware, withUploadErrorHandling } from '../../middlewares/fileUpload.middleware.js';
import { authLimiter } from '../../middlewares/rateLimit.middleware.js';


router.post('/register', authLimiter, validate(registerSchema), registerUser);
router.post('/login', authLimiter, validate(loginSchema), loginUser);
router.post('/verify_email', authLimiter, authMiddleware, validate(verifyEmailSchema), verifyEmail);
router.post('/resend_verification', authLimiter, authMiddleware, resendVerificationCode);
router.get('/me', authMiddleware, getMe);

router.patch('/me', authMiddleware, withUploadErrorHandling(createFileUploadMiddleware({ kind: 'avatar' })), validate(updateMeSchema), updateMe);
router.patch('/me/password', authMiddleware, validate(changePasswordSchema), changePassword);
router.post('/logout', logoutUser);


export default router;
