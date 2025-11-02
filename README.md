<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AI 유튜브 전략 컨설턴트

AI 기반 YouTube 채널 및 키워드 분석 도구입니다.

## 사전 준비

### 필요한 API 키 (2개)

이 애플리케이션은 두 가지 Google API를 사용합니다:

1. **YouTube Data API v3** - 채널/영상 데이터 조회
2. **Gemini API (Generative Language API)** - AI 전략 생성

### API 활성화 방법

#### 1. YouTube Data API v3

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택 또는 생성
3. [YouTube Data API v3 활성화](https://console.developers.google.com/apis/api/youtube.googleapis.com/overview)
4. "사용 설정" 클릭
5. "사용자 인증 정보" > "API 키 만들기"에서 키 생성

#### 2. Gemini API (Generative Language API)

**방법 A: Google AI Studio 사용 (권장)**
1. [Google AI Studio](https://aistudio.google.com/apikey) 접속
2. "Create API Key" 클릭
3. API 키 복사
4. 이 방법은 API가 자동으로 활성화됩니다.

**방법 B: Google Cloud Console 사용**
1. [Generative Language API 활성화](https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview)
2. "사용 설정" 클릭
3. API 키 생성

## 로컬 실행

**필수 요구사항:** Node.js 20 이상

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 API 키를 설정하세요:

```bash
# .env.example을 복사하여 .env.local 생성
cp .env.example .env.local

# .env.local 파일을 편집하여 실제 API 키 입력
GEMINI_API_KEY=your_gemini_api_key_here
YOUTUBE_API_KEY=your_youtube_api_key_here
```

**📝 API 키 관리 방식:**
- **방법 1 (권장)**: `.env.local` 파일에 두 키 모두 설정
  - 일관된 관리 방식
  - 배포 시 환경변수로 쉽게 설정 가능
  - Git에 커밋되지 않음
  
- **방법 2**: YouTube 키만 UI에서 입력
  - YouTube API 키를 `.env.local`에 설정하지 않으면 앱 UI에서 입력 가능
  - 로컬스토리지에 저장됨

**⚠️ 보안 주의사항:**
- `.env.local` 파일은 `.gitignore`에 포함되어 Git에 커밋되지 않습니다.
- 절대로 실제 API 키를 Git에 커밋하지 마세요.
- API 키는 로컬 환경에서만 사용하고 공유하지 마세요.

### 3. 애플리케이션 실행

```bash
npm run dev
```

### 4. YouTube API 키 설정 (선택사항)

`.env.local` 파일에 `YOUTUBE_API_KEY`를 설정했다면 이 단계를 건너뛸 수 있습니다.

UI에서 설정하려면:
1. 브라우저에서 애플리케이션 열기 (기본: http://localhost:3000)
2. 상단 우측 "API 키 설정" 버튼 클릭
3. YouTube Data API v3 키 입력
4. "연결 테스트" 버튼으로 유효성 확인
5. "저장" 클릭

## 문제 해결

### "API가 활성화되지 않았습니다" 오류 (403)

#### Gemini API 오류가 발생하는 경우

**증상**: `Generative Language API has not been used in project XXX before or it is disabled`

**해결 방법 (2가지 중 선택)**

**방법 1: 현재 프로젝트에서 API 활성화**
1. 에러 메시지에 표시된 프로젝트 ID를 확인 (예: `518007520167`)
2. 다음 링크에서 해당 프로젝트의 API를 활성화:
   ```
   https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=YOUR_PROJECT_ID
   ```
3. "사용 설정" 버튼 클릭
4. 활성화 완료 후 **2-3분 대기**
5. 앱에서 다시 시도

**방법 2: Google AI Studio에서 새 키 발급 (권장 - 더 쉬움)**
1. [Google AI Studio](https://aistudio.google.com/apikey) 접속
2. "Create API Key" 클릭
3. 새 API 키가 자동으로 생성됨 (API가 자동 활성화됨)
4. 새 키를 `.env.local` 파일에 저장:
   ```bash
   GEMINI_API_KEY=새로운_API_키_여기
   ```
5. 개발 서버 재시작 (`npm run dev`)

#### YouTube API 오류가 발생하는 경우

- [YouTube Data API v3 활성화](https://console.developers.google.com/apis/api/youtube.googleapis.com/overview) 확인
- 앱의 "API 키 설정"에서 "연결 테스트" 버튼으로 확인

### API 키 테스트 실패

- API 키가 올바른지 확인
- API가 활성화되어 있는지 확인
- API 활성화 후 **2-3분 정도 기다린 후** 다시 시도 (Google Cloud의 전파 시간 필요)

## 기능

- **채널 분석**: 특정 채널의 인기 영상 및 개선 영상 분석
- **키워드 분석**: 특정 키워드에 대한 트렌드 분석
- **AI 전략 생성**: 분석 결과를 바탕으로 한 맞춤형 성장 전략 제안

## 🔒 Git 보안 설정

### 현재 보안 상태
✅ `.env.local` 파일은 `.gitignore`에 포함되어 Git 추적에서 제외됩니다.
✅ `.env.example` 파일만 저장소에 포함됩니다 (실제 키 없음).
✅ `.env.local`은 한 번도 Git에 커밋된 적이 없습니다.

### 추가 보안 권장사항

#### 1. 이미 커밋된 API 키가 있는 경우

만약 실수로 API 키를 커밋했다면 즉시 다음 조치를 취하세요:

```bash
# Git 히스토리에서 파일 제거
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env.local" \
  --prune-empty --tag-name-filter cat -- --all

# 강제 푸시 (주의: 팀과 협의 후 진행)
# git push origin --force --all
```

#### 2. GitHub Secret Scanning

GitHub는 자동으로 API 키와 비밀번호를 스캔합니다. 만약 키가 노출되었다면:
- 해당 키를 즉시 재발급하세요
- GitHub에서 알림을 받으면 즉시 확인하세요

#### 3. 환경변수 관리 베스트 프랙티스

- ✅ `.env.local` 사용 (로컬 개발용)
- ✅ `.env.example` 제공 (템플릿)
- ❌ `.env`를 Git에 커밋하지 않음
- ❌ 실제 API 키를 코드나 문서에 포함하지 않음
- ✅ API 키는 각 개발자별로 개별 발급

