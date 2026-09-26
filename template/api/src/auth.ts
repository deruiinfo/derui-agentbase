import { createAuth } from '@rls-kit/core/auth';
import { config } from './config.ts';

export const auth = createAuth({
  secret: config.jwtSecret,
  expiresInHours: config.jwtExpireHours,
});
