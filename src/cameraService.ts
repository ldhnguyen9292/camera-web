import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import express, { Request, Response } from 'express';
import { OnvifDevice } from 'node-onvif-ts';
import { z } from 'zod';

import { cameraSchema, camerasConfig } from './config/camera';

const router = express.Router();

// Kiểu TypeScript của camera
type Camera = z.infer<typeof cameraSchema>;

// Folder lưu HLS stream
const HLS_BASE_PATH = path.join(__dirname, 'hls_streams');
if (!fs.existsSync(HLS_BASE_PATH)) fs.mkdirSync(HLS_BASE_PATH);

// Quản lý tiến trình FFmpeg theo IP camera
const ffmpegProcesses: Map<string, ChildProcessWithoutNullStreams> = new Map();

function startFfmpegForCamera(camera: Camera): void {
  const folder = path.join(HLS_BASE_PATH, camera.ip);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder);

  if (ffmpegProcesses.has(camera.ip)) {
    // FFmpeg đã chạy cho camera này rồi
    return;
  }

  const args = [
    '-rtsp_transport',
    'tcp',
    '-i',
    camera.rtspUrl,
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-ar',
    '44100',
    '-b:a',
    '64k',
    '-f',
    'hls',
    '-hls_time',
    '4',
    '-hls_list_size',
    '5',
    '-hls_flags',
    'delete_segments+append_list',
    '-hls_segment_filename',
    path.join(folder, 'segment_%03d.ts'),
    path.join(folder, 'stream.m3u8')
  ];

  const ffmpeg = spawn('ffmpeg', args);

  ffmpeg.stderr.on('data', (data: Buffer) => {
    console.log(`[FFmpeg][${camera.ip}] ${data.toString()}`);
  });

  ffmpeg.on('close', (code: number, signal: string) => {
    console.log(`[FFmpeg][${camera.ip}] exited with code ${code} signal ${signal}`);
    ffmpegProcesses.delete(camera.ip);
  });

  ffmpegProcesses.set(camera.ip, ffmpeg);
}

// Hàm điều khiển PTZ camera qua ONVIF
async function ptzContinuousMove(
  camera: Camera,
  velocity: { x: number; y: number; z: number },
  timeout = 1
): Promise<void> {
  // Tạo device ONVIF
  const device = new OnvifDevice({
    xaddr: `http://${camera.ip}:${camera.onvifPort ?? '80'}/onvif/device_service`,
    user: camera.username,
    pass: camera.password
  });

  await device.init();

  // Gửi lệnh PTZ
  await device.ptzMove({
    speed: { x: velocity.x, y: velocity.y, z: velocity.z },
    timeout
  });

  console.log(device.services.media?.getVideoSourceConfiguration({ ConfigurationToken: 'abcs' }));
}

// Route xem camera
router.get('/:ip', (req: Request, res: Response) => {
  const ip = req.params.ip;
  const camera = camerasConfig.find((c) => c.ip === ip);
  if (!camera) return res.status(404).send('Camera not found');

  try {
    startFfmpegForCamera(camera);
    res.render('camera', { camera: { ip: camera.ip, rtspUrl: camera.rtspUrl } });
  } catch (error) {
    console.error(`Error starting camera stream for ${ip}:`, error);
    return res.status(500).send('Error starting camera stream');
  }
});

// Route ví dụ gọi PTZ
router.post('/:ip/ptz', express.json(), async (req: Request, res: Response) => {
  const ip = req.params.ip;
  const { x, y, z, timeout } = req.body; // velocity và timeout từ client

  const camera = camerasConfig.find((c) => c.ip === ip);
  if (!camera) return res.status(404).send('Camera not found');

  try {
    await ptzContinuousMove(camera, { x, y, z }, timeout ?? 1);
    res.json({ success: true, message: 'PTZ command sent' });
  } catch (error) {
    console.error('PTZ error:', error);
    res
      .status(500)
      .json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Phục vụ file tĩnh HLS
router.use('/hls', express.static(HLS_BASE_PATH));

async function getPlaybackUri(
  camera: Camera,
  recordingToken: string,
  _start: Date,
  _end: Date
): Promise<string> {
  const device = new OnvifDevice({
    xaddr: `http://${camera.ip}:${camera.onvifPort ?? 80}/onvif/device_service`,
    user: camera.username,
    pass: camera.password
  });

  await device.init();

  const replayService = device.services.media;
  if (!replayService) throw new Error('Replay service not available');

  const resp = await replayService.getVideoSources();

  return resp.data.find((source: { token: string }) => source.token === recordingToken)?.uri || '';
}

router.get('/:ip/playback', async (req: Request, res: Response) => {
  const ip = req.params.ip;
  const { recordingToken, start, end } = req.query;

  if (typeof recordingToken !== 'string' || typeof start !== 'string' || typeof end !== 'string') {
    return res.status(400).send('Missing or invalid query parameters');
  }

  const camera = camerasConfig.find((c) => c.ip === ip);
  if (!camera) return res.status(404).send('Camera not found');

  try {
    const playbackUri = await getPlaybackUri(
      camera,
      recordingToken,
      new Date(start),
      new Date(end)
    );

    // Tạo folder playback tạm cho camera
    const folder = path.join(HLS_BASE_PATH, `${ip}_playback`);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder);

    // Dùng FFmpeg convert RTSP playback sang HLS
    const args = [
      '-rtsp_transport',
      'tcp',
      '-i',
      playbackUri,
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-ar',
      '44100',
      '-b:a',
      '64k',
      '-f',
      'hls',
      '-hls_time',
      '4',
      '-hls_list_size',
      '5',
      '-hls_flags',
      'delete_segments+append_list',
      '-hls_segment_filename',
      path.join(folder, 'segment_%03d.ts'),
      path.join(folder, 'stream.m3u8')
    ];

    // Nếu có tiến trình ffmpeg playback cũ thì kill nó trước
    if (ffmpegProcesses.has(`${ip}_playback`)) {
      ffmpegProcesses.get(`${ip}_playback`)?.kill();
      ffmpegProcesses.delete(`${ip}_playback`);
    }

    const ffmpeg = spawn('ffmpeg', args);

    ffmpeg.stderr.on('data', (data: Buffer) => {
      console.log(`[FFmpeg][${ip}_playback] ${data.toString()}`);
    });

    ffmpeg.on('close', (code: number, signal: string) => {
      console.log(`[FFmpeg][${ip}_playback] exited with code ${code} signal ${signal}`);
      ffmpegProcesses.delete(`${ip}_playback`);
    });

    ffmpegProcesses.set(`${ip}_playback`, ffmpeg);

    // Trả về trang xem video playback
    res.render(`cameraPlayback`, {
      ip: ip,
      playbackUrl: `/camera/hls/${ip}_playback/stream.m3u8`
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error getting playback stream');
  }
});

export default router;
