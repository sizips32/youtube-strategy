import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // .env 파일에서 환경변수 로드
    const env = loadEnv(mode, process.cwd(), '');
    const geminiApiKey = env.GEMINI_API_KEY || '';
    const youtubeApiKey = env.YOUTUBE_API_KEY || '';

    // 개발 모드에서만 환경변수 확인 로그
    if (mode === 'development') {
      console.log('🔑 API Keys Status:');
      console.log(`  Gemini: ${geminiApiKey ? '✓ Loaded' : '⚠️  Not set'}`);
      console.log(`  YouTube: ${youtubeApiKey ? '✓ Loaded' : '⚠️  Not set (can be set in UI)'}`);
    }

    return {
      server: {
        port: 3777,
        host: '0.0.0.0',
      },
      plugins: [react()],
      // 환경변수를 클라이언트에 전달 (보안 주의: API 키가 번들에 포함됨)
      define: {
        // 레거시 지원을 위한 process.env
        'process.env.API_KEY': JSON.stringify(geminiApiKey),
        // 표준 import.meta.env 방식
        'import.meta.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
        'import.meta.env.YOUTUBE_API_KEY': JSON.stringify(youtubeApiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
