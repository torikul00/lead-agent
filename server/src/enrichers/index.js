import wikidata from './wikidata.enricher.js';
import website from './website.enricher.js';

// Every step that adds contacts to the final leads, run in this order so the website step can match emails to people Wikidata found. To add one, create its file and register it here.
export const ENRICHERS = [wikidata, website];
