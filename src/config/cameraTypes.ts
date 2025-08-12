// Khai báo type chung cho camera
interface CameraConfig {
  ip: string;
  username: string;
  password: string;
  rtspUrl: string;
  onvifPort?: string;
}

export { CameraConfig };
