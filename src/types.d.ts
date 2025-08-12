// type.d.ts
import 'express-session';

// Khai báo type cho biến môi trường
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT?: string;
    CAMERAS_CONFIG_PATH: string;
    SESSION_SECRET: string;
  }
}

// Khai báo type chung cho camera
interface CameraConfig {
  ip: string;
  username: string;
  password: string;
  rtspUrl: string;
  onvifPort?: string;
}

declare module 'express-session' {
  export interface SessionData {
    user: { [key: string]: any };
  }
}
