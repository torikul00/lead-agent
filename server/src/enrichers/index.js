import wikidata from './wikidata.enricher.js';
import website from './website.enricher.js';

// Every step that adds contacts to the final leads, run in this order so the website step can match emails to people Wikidata found. To add one, create its file and register it here.
// Hunter isn't listed: it spends credits, so it only runs when the user asks for one lead (POST /api/leads/find_emails).
export const ENRICHERS = [wikidata, website];
