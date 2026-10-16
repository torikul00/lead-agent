import rateLimit from "express-rate-limit";

// General ceiling for all API traffic — generous enough for normal dashboard
// use, just there to blunt scraping/abuse bursts.
export const apiLimiter = rateLimit({
   windowMs: 15 * 60 * 1000,
   limit: 1000,
   standardHeaders: true,
   legacyHeaders: false,
   message: { error: "Too many requests. Please try again later." },
});

// Tighter limit for login/register — the endpoints most worth protecting
// against credential-stuffing / brute-force.
export const authLimiter = rateLimit({
   windowMs: 15 * 60 * 1000,
   limit: 20,
   standardHeaders: true,
   legacyHeaders: false,
   message: { error: "Too many attempts. Please try again later." },
});
