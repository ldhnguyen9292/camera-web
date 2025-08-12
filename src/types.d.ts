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

declare module 'express-session' {
  export interface SessionData {
    user: { [key: string]: unknown };
  }
}
