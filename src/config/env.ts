import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().optional(),
  SESSION_SECRET: z.string().min(1, 'SESSION_SECRET bắt buộc')
});

export const env = envSchema.parse(process.env);
