import '../loadEnv.js';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Lead from '../src/models/lead.model.js';

// Test only: replaces every lead's company emails with one test inbox, and the real ones can't be restored. From server/: npx cross-env NODE_ENV=development node scripts/setTestCompanyEmails.js
const TEST_EMAIL = 'toriqulislam142@gmail.com';

if (process.env.NODE_ENV === 'production') throw new Error('This test script must not run on production.');

await connectDB();

try {
    // Sending only accepts certain sources, so a "Manual" email would get every lead skipped
    const { modifiedCount } = await Lead.updateMany({}, { company_emails: [{ email: TEST_EMAIL, source_name: 'Company website', source_url: null }] });
    console.log(`Done: ${modifiedCount} leads updated.`);
} finally {
    await mongoose.disconnect();
}
