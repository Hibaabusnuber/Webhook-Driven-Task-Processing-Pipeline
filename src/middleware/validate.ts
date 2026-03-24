import { NextFunction, Request, Response } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

/**
 * Runs express-validator chains and returns 400 with details if invalid.
 */
export function validate(chains: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(chains.map((c) => c.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }
    next();
  };
}
