# 보안 가이드

## ⚠️ API 키 보안

### 중요 사항
- **절대로 API 키를 Git에 커밋하지 마세요**
- API 키가 노출되면 즉시 재발급하세요
- 프로덕션 환경에서는 반드시 환경변수를 사용하세요

### 설정 방법

1. **개발 환경**
   ```bash
   # .env.example을 복사하여 .env 생성
   cp .env.example .env

   # .env 파일에 실제 API 키 입력
   nano .env
   ```

2. **Google Cloud Console에서 API 키 제한 설정**

   **YouTube API 키 제한:**
   - Application restrictions: HTTP referrers (websites)
   - Website restrictions:
     - `http://localhost:3777/*` (개발)
     - `https://yourdomain.com/*` (프로덕션)
   - API restrictions: YouTube Data API v3만 허용

   **Gemini API 키 제한:**
   - Application restrictions: HTTP referrers (websites)
   - Website restrictions: 동일하게 설정
   - API restrictions: Generative Language API만 허용

3. **프로덕션 배포**

   **Vercel:**
   ```bash
   vercel env add GEMINI_API_KEY
   vercel env add YOUTUBE_API_KEY
   ```

   **Netlify:**
   ```bash
   # Netlify UI에서 Site settings > Environment variables 설정
   ```

   **GitHub Pages (권장하지 않음):**
   - GitHub Pages는 정적 사이트만 지원하므로 API 키가 노출됨
   - 백엔드 프록시 서버 사용 필요

## 🔒 클라이언트 측 보안 제한

### 현재 아키텍처의 한계
이 프로젝트는 클라이언트 사이드 애플리케이션으로, API 키가 브라우저에 노출됩니다.

### 프로덕션 권장 아키텍처
```
[클라이언트] → [백엔드 프록시] → [Google APIs]
             ↑
         API 키 보관
```

### 백엔드 프록시 예시 (Node.js/Express)
```javascript
// server.js
const express = require('express');
const app = express();

app.post('/api/youtube/search', async (req, res) => {
  const { query } = req.body;

  // 서버에서 API 키 사용
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/...?key=${process.env.YOUTUBE_API_KEY}`
  );

  res.json(await response.json());
});
```

## 🛡️ 보안 체크리스트

- [ ] .env 파일이 .gitignore에 포함되어 있는가?
- [ ] .env.example만 Git에 커밋되어 있는가?
- [ ] Google Cloud Console에서 API 키 제한을 설정했는가?
- [ ] API 키 사용량을 정기적으로 모니터링하는가?
- [ ] 프로덕션 환경에서 환경변수를 사용하는가?
- [ ] 에러 메시지에 민감한 정보가 포함되지 않는가?

## 🚨 API 키 노출 시 대응

### 즉시 조치
1. **Google Cloud Console에서 API 키 즉시 삭제**
2. **새로운 API 키 생성 및 제한 설정**
3. **Git 히스토리 정리 (필요시)**
   ```bash
   # .env 파일을 Git 히스토리에서 완전히 제거
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch .env' \
     --prune-empty --tag-name-filter cat -- --all

   # 강제 푸시 (주의: 협업 시 팀원과 협의)
   git push origin --force --all
   ```
4. **사용량 모니터링**으로 비정상적인 활동 확인

## 📊 모니터링

### Google Cloud Console
- [APIs & Services > Dashboard](https://console.cloud.google.com/apis/dashboard)
- 일일 사용량 확인
- 비정상적인 급증 시 알림 설정

### 권장 도구
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [GitGuardian](https://www.gitguardian.com/)
- [TruffleHog](https://github.com/trufflesecurity/trufflehog)

## 📚 참고 자료
- [Google API 보안 모범 사례](https://cloud.google.com/docs/authentication/api-keys)
- [YouTube Data API 할당량](https://developers.google.com/youtube/v3/getting-started#quota)
- [Gemini API 보안](https://ai.google.dev/gemini-api/docs/api-key)
