import OpenAI from 'openai';
import { z } from 'zod';

// Shape the model must return; used to validate its answer
const leadsSchema = z.object({
    leads: z.array(
        z.object({
            name: z.string(),
            domain: z.string().nullable(),
            country: z.string(),
            industry: z.string(),
            employee_range: z.string().nullable(),
            address: z.string().nullable(),
            description: z.string().nullable(),
            ai_score: z.number().min(0).max(100),
            ai_reason: z.string(),
            source_url: z.string().nullable(),
        })
    ),
});

const buildPrompt = ({ country, industry, company_size, keywords }) => {
    const size = company_size ? `${company_size} employees` : 'Any';
    const keywordList = keywords.length ? keywords.join(', ') : 'None';

    return `You are a B2B lead research assistant.
Use web search to find the 5 real companies that best match these criteria:
- Country: ${country}
- Industry: ${industry}
- Company size: ${size}
- Keywords: ${keywordList}

Rules:
- Only include real, currently operating companies that you found through search.
- Never invent companies, websites, addresses, employee counts or other details. Use null when you cannot confirm a field.
- Rank the companies from best to worst match.

Reply with only a JSON object in this exact shape and no other text:
{
  "leads": [
    {
      "name": string,
      "domain": string | null (website domain only, e.g. "example.com"),
      "country": string,
      "industry": string,
      "employee_range": string | null,
      "address": string | null,
      "description": string | null,
      "ai_score": number (0-100, how well the company matches the criteria),
      "ai_reason": string (one or two sentences explaining the score),
      "source_url": string | null (page where you found the company)
    }
  ]
}`;
};

// Pull the JSON object out of the reply in case the model adds extra text around it
const extractJson = (text) => JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));

// POST /api/leads/generate_leads — ask the AI model to search the web for the top 5 leads matching the criteria.
export const generateLeads = async (req, res) => {
    try {
        const ai = new OpenAI({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: 'https://api.groq.com/openai/v1',
        });

        const response = await ai.chat.completions.create({
            model: process.env.GROQ_MODEL,
            messages: [{ role: 'user', content: buildPrompt(req.body) }],
            // Groq's built-in web search, so the model finds real companies instead of guessing
            tools: [{ type: 'browser_search' }],
            tool_choice: 'required',
        });

        const { leads } = leadsSchema.parse(extractJson(response.choices[0].message.content ?? ''));
        return res.status(200).json({ leads: leads.slice(0, 5) });
    } catch (err) {
        console.error('Lead generation failed:', err);
        return res.status(502).json({ error: 'Could not generate leads right now. Please try again.' });
    }
};
