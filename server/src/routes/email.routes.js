import { Router } from 'express';
const router = Router();
import { createTemplate, deleteTemplate, getTemplate, getTemplates, updateTemplate, uploadTemplateImage } from '../controllers/email.controller.js';
import { connectMailbox, disconnectMailbox, getMailboxes, mailboxCallback } from '../controllers/mailbox.controller.js';
import { checkReplies, deleteConversation, getConversation, getConversations, getSendReport, getUnreadCount, replyToConversation, sendBulkEmailToLead, sendLeadList } from '../controllers/inbox.controller.js';
import { emailTemplateSchema, replySchema, sendBulkEmailSchema, sendListSchema } from '../validation/email.validation.js';
import authMiddleware from '../../middlewares/authMiddleware.js';
import { createFileUploadMiddleware, withUploadErrorHandling } from '../../middlewares/fileUpload.middleware.js';
import validate from '../../middlewares/validate.middleware.js';

// Google and Microsoft redirect the browser here, so it's checked by its one-time state instead of the login cookie
router.get('/mailboxes/:provider/callback', mailboxCallback);

router.use(authMiddleware);

router.get('/mailboxes', getMailboxes);
router.get('/mailboxes/:provider/connect', connectMailbox);
router.post('/mailboxes/:id/disconnect', disconnectMailbox);

router.post('/send_bulk', validate(sendBulkEmailSchema), sendBulkEmailToLead);
router.post('/send_list', validate(sendListSchema), sendLeadList);
router.get('/send_list', getSendReport);
router.post('/check_replies', checkReplies);
router.get('/unread_count', getUnreadCount);
router.get('/conversations', getConversations);
router.get('/conversations/:id', getConversation);
router.delete('/conversations/:id', deleteConversation);
router.post('/conversations/:id/reply', validate(replySchema), replyToConversation);

router.get('/templates', getTemplates);
router.get('/templates/:id', getTemplate);
router.post('/templates/images', withUploadErrorHandling(createFileUploadMiddleware({ kind: 'emailImage', fieldName: 'image' })), uploadTemplateImage);
router.post('/templates', validate(emailTemplateSchema), createTemplate);
router.patch('/templates/:id', validate(emailTemplateSchema), updateTemplate);
router.delete('/templates/:id', deleteTemplate);


export default router;
