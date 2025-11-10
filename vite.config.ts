import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // .env, .env.local, .env.[mode], .env.[mode].local 파일에서 환경변수 로드
    const env = loadEnv(mode, process.cwd(), '');
    const geminiApiKey = env.GEMINI_API_KEY || '';
    const youtubeApiKey = env.YOUTUBE_API_KEY || '';
    
    // 개발 모드에서 환경변수 확인 로그 (프로덕션에서는 제거 권장)
    if (mode === 'development') {
      if (!geminiApiKey) {
        console.warn('⚠️  GEMINI_API_KEY가 .env.local 파일에 설정되지 않았습니다.');
      } else {
        console.log('✓ GEMINI_API_KEY가 로드되었습니다.');
      }
      
      if (!youtubeApiKey) {
        console.warn('⚠️  YOUTUBE_API_KEY가 .env.local 파일에 설정되지 않았습니다. UI에서 입력하거나 환경변수로 설정하세요.');
      } else {
        console.log('✓ YOUTUBE_API_KEY가 로드되었습니다.');
      }
    }
    
    return {
      server: {
        port: 3777,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(geminiApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
        'import.meta.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiApiKey),
        'process.env.YOUTUBE_API_KEY': JSON.stringify(youtubeApiKey),
        'import.meta.env.YOUTUBE_API_KEY': JSON.stringify(youtubeApiKey),
        'import.meta.env.VITE_YOUTUBE_API_KEY': JSON.stringify(youtubeApiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
