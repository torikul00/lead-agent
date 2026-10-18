import { readLabel, runQuery, toItems } from '../sources/wikidata.source.js';
import { addCompanyEmail, addContact, getRole } from '../../utils/helper.js';

// Statement properties for each role (direct value, statement, statement value) and the order roles are listed in
const ROLE_PROPERTIES = `
    (wdt:P169 p:P169 ps:P169 "CEO" 1)
    (wdt:P112 p:P112 ps:P112 "Founder" 2)
    (wdt:P488 p:P488 ps:P488 "Chair" 3)
`;

// Living people who are CEO, founder or chair, skipping roles with an end date; "mul" holds names stored once for every language
const buildPeopleQuery = (items) => `
    SELECT ?company ?person ?personLabel ?role ?linkedin WHERE {
        VALUES ?company { ${items} }
        VALUES (?prop ?claim ?value ?role ?order) { ${ROLE_PROPERTIES} }
        ?company ?prop ?person.
        ?person wdt:P31 wd:Q5.
        FILTER NOT EXISTS { ?person wdt:P570 []. }
        FILTER NOT EXISTS { ?company ?claim ?statement. ?statement ?value ?person; pq:P582 []. }
        OPTIONAL { ?person wdt:P6634 ?linkedin. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
    }
    ORDER BY ?order
`;

const buildCompanyQuery = (items) => `
    SELECT ?company ?email ?phone WHERE {
        VALUES ?company { ${items} }
        OPTIONAL { ?company wdt:P968 ?email. }
        OPTIONAL { ?company wdt:P1329 ?phone. }
    }
`;

// "http://www.wikidata.org/entity/Q2283" or "https://www.wikidata.org/wiki/Q2283" -> "Q2283"
const toId = (uri) => uri.split('/').pop();

export default {
    name: 'wikidata',
    label: 'Wikidata',

    // Adds leaders, company emails and phone numbers to the leads that came from Wikidata
    async enrich(leads) {
        const leadsById = new Map(leads.filter((lead) => lead.source_name === 'Wikidata').map((lead) => [toId(lead.source_url), lead]));
        if (!leadsById.size) return;

        const items = toItems([...leadsById.keys()]);
        const [peopleRows, companyRows] = await Promise.all([runQuery(buildPeopleQuery(items)), runQuery(buildCompanyQuery(items))]);

        // One row per role, so a founder who is also CEO becomes one person with both roles
        const people = new Map();
        for (const row of peopleRows) {
            const name = readLabel(row.personLabel);
            if (!name) continue;

            const key = `${row.company.value}|${row.person.value}`;
            if (!people.has(key)) {
                people.set(key, {
                    lead: leadsById.get(toId(row.company.value)),
                    name,
                    roles: [],
                    linkedin: row.linkedin?.value,
                    url: `https://www.wikidata.org/wiki/${toId(row.person.value)}`,
                });
            }

            const person = people.get(key);
            if (!person.roles.includes(row.role.value)) person.roles.push(row.role.value);
        }

        for (const { lead, name, roles, linkedin, url } of people.values()) {
            const title = roles.join(', ');
            addContact(lead, {
                name,
                title,
                role: getRole(title),
                email: null,
                phone: null,
                linkedin_url: linkedin ? `https://www.linkedin.com/in/${linkedin}` : null,
                source_name: 'Wikidata',
                source_url: url,
            });
        }

        // Wikidata stores emails as "mailto:" links
        for (const row of companyRows) {
            const lead = leadsById.get(toId(row.company.value));
            if (row.email) {
                addCompanyEmail(lead, { email: row.email.value.replace(/^mailto:/i, '').toLowerCase(), source_name: 'Wikidata', source_url: lead.source_url });
            }
            if (row.phone) lead.phone ??= row.phone.value;
        }
    },
};
