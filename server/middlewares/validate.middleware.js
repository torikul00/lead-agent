import { z } from 'zod';

// Validate req.body with a zod schema and replace it with the clean, parsed data
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
        return res.status(400).json({
            error: result.error.issues[0].message,
            errors: z.flattenError(result.error).fieldErrors,
        });
    }

    req.body = result.data;
    next();
};

export default validate;
