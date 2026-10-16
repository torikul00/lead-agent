import rateLimit from "express-rate-limit";

// 200 requests per 15 minutes for general API usage
export const apiLimiter = rateLimit({
   windowMs: 15 * 60 * 1000,
   limit: 200,
   standardHeaders: true,
   legacyHeaders: false,
   message: { error: "Too many requests. Please try again later." },
});

// 20 requests per 15 minutes for auth endpoints (register, login, verify email, resend verification)
export const authLimiter = rateLimit({
   windowMs: 15 * 60 * 1000, 
   limit: 20,
   standardHeaders: true,
   legacyHeaders: false,
   message: { error: "Too many attempts. Please try again later." },
});
