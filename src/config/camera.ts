import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';
import { z } from 'zod';

import { CameraConfig } from './cameraTypes';

dotenv.config();

const cameraSchema = z.object({
  ip: z.string().min(7),
  username: z.string().min(1),
  password: z.string().min(1),
  rtspUrl: z.string().url(),
  onvifPort: z.string().optional()
});

const camerasSchema = z.array(cameraSchema);

function loadCamerasConfig(): CameraConfig[] {
  const configPath = process.env.CAMERAS_CONFIG_PATH;

  if (!configPath) {
    throw new Error('CAMERAS_CONFIG_PATH is not defined in .env');
  }

  const absolutePath = path.resolve(configPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found at path: ${absolutePath}`);
  }

  const rawData = fs.readFileSync(absolutePath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    throw new Error('Invalid JSON format in cameras config file');
  }

  const result = camerasSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid cameras config: ${result.error.message}`);
  }

  return result.data;
}

export const camerasConfig = loadCamerasConfig();
