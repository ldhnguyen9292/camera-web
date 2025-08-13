import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().optional(),
  CAMERAS_CONFIG_PATH: z.string().min(1, 'CAMERAS_CONFIG_PATH bắt buộc'),
  USERNAME: z.string().min(1, 'USERNAME bắt buộc'),
  PASSWORD: z.string().min(1, 'PASSWORD bắt buộc'),
  SESSION_SECRET: z.string().min(1, 'SESSION_SECRET bắt buộc')
});

export const env = envSchema.parse(process.env);
