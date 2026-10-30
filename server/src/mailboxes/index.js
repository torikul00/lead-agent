import gmail from './gmail.mailbox.js';
import outlook from './outlook.mailbox.js';

// Mail providers a user can connect, by the name used in the routes and saved on the mailbox. To add one, create its file and register it here.
export const MAILBOXES = { gmail, outlook };
