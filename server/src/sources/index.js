import wikidata from './wikidata.source.js';
import geoapify from './geoapify.source.js';

// Every source the lead search can use, richest first so dedupe keeps its version of a company. To add one, create its file and register it here.
// OpenStreetMap (osm.source.js) is turned off for now because its public servers are unreliable; import it and add it here to turn it back on.
export const SOURCES = { wikidata, geoapify };
