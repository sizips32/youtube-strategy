# YouTube Strategy MCP Server

YouTube 채널 및 키워드 분석을 위한 Model Context Protocol (MCP) 서버입니다.

## 📋 기능

이 MCP 서버는 다음 5가지 주요 도구를 제공합니다:

### 1. `youtube_search_channel`
채널 이름으로 YouTube 채널을 검색하고 상세 정보를 조회합니다.
- 구독자 수, 총 조회수, 비디오 개수
- 채널 생성일, 썸네일 등

### 2. `youtube_analyze_channel_videos`
채널의 비디오를 분석하여 인기도 점수를 계산합니다.
- 상위 성과 비디오 또는 저성과 비디오 식별
- Shorts vs Long-form 필터링
- 인기도 점수 기반 정렬

### 3. `youtube_search_keyword`
키워드로 비디오를 검색하고 트렌드를 분석합니다.
- 지역 필터 (한국 vs 해외)
- 비디오 타입 필터 (Shorts vs Long)
- 날짜 범위 필터

### 4. `youtube_find_rising_stars`
특정 카테고리에서 떠오르는 스타 채널을 찾습니다.
- 구독자 범위 설정 가능
- 참여도 기반 정렬
- 협업 기회 발견

### 5. `youtube_find_blue_ocean_topics`
경쟁이 적은 블루오션 토픽을 식별합니다.
- 넓은 카테고리 내 틈새 기회 발견
- 경쟁 분석
- 콘텐츠 기회 제안

## 🚀 설치 및 실행

### 1. 의존성 설치

```bash
pip install -r requirements.txt
```

또는 uv 사용:

```bash
uv pip install -r requirements.txt
```

### 2. Python으로 직접 실행

```bash
python youtube_strategy_mcp.py
```

**주의**: MCP 서버는 stdio를 통해 통신하므로 직접 실행하면 프로세스가 대기 상태가 됩니다.

### 3. Claude Desktop에 연결

Claude Desktop의 설정 파일을 수정하여 MCP 서버를 추가합니다.

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "youtube-strategy": {
      "command": "python",
      "args": [
        "/home/claude/youtube_strategy_mcp.py"
      ],
      "env": {}
    }
  }
}
```

**uv 사용 시**:

```json
{
  "mcpServers": {
    "youtube-strategy": {
      "command": "uv",
      "args": [
        "run",
        "/home/claude/youtube_strategy_mcp.py"
      ],
      "env": {}
    }
  }
}
```

## 🔑 API 키 준비

이 MCP 서버를 사용하려면 **YouTube Data API v3 키**가 필요합니다.

### API 키 발급 방법:

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택 또는 생성
3. [YouTube Data API v3 활성화](https://console.developers.google.com/apis/api/youtube.googleapis.com/overview)
4. "사용자 인증 정보" > "API 키 만들기"에서 키 생성
5. 키를 복사하여 저장

## 💡 사용 예시

### Claude Desktop에서 사용:

```
안녕 Claude! YouTube Strategy MCP 서버를 사용해서 
"MrBeast" 채널을 분석하고 상위 10개 인기 동영상을 보여줘.
```

### 예시 대화:

**사용자**: "AI 튜토리얼" 키워드로 최근 한 달간 업로드된 
Long-form 비디오를 검색해줘. 한국 콘텐츠만 보고 싶어.

**Claude**: youtube_search_keyword 도구를 사용하여...

## 📊 응답 형식

모든 도구는 두 가지 형식으로 응답을 제공합니다:

### JSON 형식 (기본)
```json
{
  "success": true,
  "channel": {
    "id": "UCX6OQ3DkcsbYNE6H8uQQuVA",
    "title": "MrBeast",
    "subscriber_count": 239000000,
    ...
  }
}
```

### Markdown 형식
```markdown
# Channel: MrBeast

**Channel ID:** UCX6OQ3DkcsbYNE6H8uQQuVA
**Subscribers:** 239,000,000
**Total Views:** 50,000,000,000
...
```

## 🎯 인기도 점수 계산 방식

각 비디오의 인기도 점수는 다음 요소를 고려하여 계산됩니다:

- **일일 조회수**: 조회수 / 게시 후 경과 일수
- **참여도**: (좋아요 + 댓글) / 조회수
- **가중 평균**: 일일 조회수 70% + 참여도 기반 점수 30%

> 참고: 웹앱(프런트엔드)에서는 간단한 참여율 기반 공식
> `(좋아요×0.6 + 댓글×0.4) ÷ 조회수 × 1000` 을 사용합니다. 
> MCP는 "최근성"을 반영하기 위해 일일 조회수(views/day)를 추가로 고려합니다. 목적에 따라 두 산식 중 하나를 선택하세요.

## 🔧 고급 기능

### 1. 비디오 타입 필터링
- **SHORTS**: 3분 미만 비디오
- **LONG**: 3분 이상 비디오
- **ALL**: 모든 비디오

### 2. 지역 필터링
한글 문자 감지를 통한 자동 분류(단순 휴리스틱):
- **KOREA**: 한글이 포함된 콘텐츠
- **OVERSEAS**: 한글이 없는 콘텐츠
- **ALL**: 모든 콘텐츠

> 유의: 간단한 정규식 기반 판별로 100% 정확하지 않을 수 있습니다. 제목/설명 외의 신호(채널 국가, 자막/언어 코드 등)를 추가하면 정확도를 향상할 수 있습니다.

### 3. Character Limit
응답이 25,000자를 초과하면 자동으로 잘립니다.

## 🐛 문제 해결

### API 키 관련 오류

**"YouTube Data API v3 is not enabled"**
- [API 활성화 페이지](https://console.developers.google.com/apis/api/youtube.googleapis.com/overview)에서 API를 활성화하세요.

**"Invalid API key"**
- API 키가 올바른지 확인하세요.
- YouTube Data API v3용 키인지 확인하세요.

**"YouTube API quota exceeded"**
- 할당량이 초과되었습니다. 다음 날까지 기다리거나 할당량을 늘리세요.

### 연결 문제

**"No videos found"**
- 채널 ID가 올바른지 확인하세요.
- 채널에 비디오가 있는지 확인하세요.

## 📝 라이선스

이 MCP 서버는 YouTube Strategy 앱과 함께 사용하도록 설계되었습니다.

## 🤝 기여

버그 리포트나 기능 제안은 GitHub Issues를 통해 제출해주세요.

## 📞 지원

문제가 발생하면 다음을 확인하세요:
1. Python 버전 (3.8 이상 권장)
2. 의존성 설치 완료
3. API 키 유효성
4. API 활성화 상태
