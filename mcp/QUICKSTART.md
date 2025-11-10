# 🚀 YouTube Strategy MCP Server - 빠른 설치 가이드

## 1️⃣ 사전 준비

### YouTube Data API v3 키 발급
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 생성 (또는 기존 프로젝트 선택)
3. [YouTube Data API v3 활성화](https://console.developers.google.com/apis/api/youtube.googleapis.com/overview)
4. "사용자 인증 정보" → "API 키 만들기" 클릭
5. 생성된 API 키 복사 및 저장

## 2️⃣ 설치

### 옵션 A: pip 사용
```bash
pip install fastmcp httpx pydantic
```

### 옵션 B: uv 사용 (권장)
```bash
# uv 설치 (아직 없다면)
curl -LsSf https://astral.sh/uv/install.sh | sh

# 의존성 설치
uv pip install fastmcp httpx pydantic
```

### 옵션 C: requirements.txt 사용
```bash
pip install -r requirements.txt
```

## 3️⃣ Claude Desktop에 연결

### macOS 설정 파일 위치
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

### Windows 설정 파일 위치
```
%APPDATA%\Claude\claude_desktop_config.json
```

### 설정 파일 내용

**Python 직접 실행:**
```json
{
  "mcpServers": {
    "youtube-strategy": {
      "command": "python",
      "args": [
        "/Users/soonjaekim/Desktop/Developer/youtube-strategy-mcp/youtube_strategy_mcp.py"
      ],
      "env": {}
    }
  }
}
```

**uv 사용 (권장):**
```json
{
  "mcpServers": {
    "youtube-strategy": {
      "command": "uv",
      "args": [
        "run",
        "/Users/soonjaekim/Desktop/Developer/youtube-strategy-mcp/youtube_strategy_mcp.py"
      ],
      "env": {}
    }
  }
}
```

⚠️ **중요**: 위 경로를 실제 `youtube_strategy_mcp.py` 파일의 절대 경로로 변경하세요!

## 4️⃣ Claude Desktop 재시작

설정 파일을 저장한 후 Claude Desktop을 완전히 종료하고 다시 시작합니다.

## 5️⃣ 사용 예시

Claude Desktop에서 다음과 같이 질문해보세요:

### 예시 1: 채널 검색
```
YouTube Strategy MCP 서버를 사용해서 "MrBeast" 채널을 찾고 
구독자 수와 총 비디오 개수를 알려줘.
```

### 예시 2: 채널 비디오 분석
```
"Veritasium" 채널의 상위 10개 인기 동영상을 분석해줘. 
Long-form 비디오만 보고 싶어.
```

### 예시 3: 키워드 검색
```
"AI tutorial" 키워드로 최근 한 달 동영상을 검색해줘. 
한국어 콘텐츠만 필터링해서 보여줘.
```

### 예시 4: 라이징 스타 찾기
```
"요리" 카테고리에서 구독자 1만~5만 사이의 떠오르는 채널을 찾아줘.
```

### 예시 5: 블루오션 토픽
```
"피트니스" 카테고리에서 경쟁이 적은 블루오션 토픽을 찾아줘.
```

## 🔧 문제 해결

### "API가 활성화되지 않았습니다" 오류
→ [API 활성화 페이지](https://console.developers.google.com/apis/api/youtube.googleapis.com/overview)에서 활성화

### "Invalid API key" 오류
→ API 키가 올바른지, YouTube Data API v3용인지 확인

### "할당량 초과" 오류
→ 일일 할당량이 소진되었습니다. 다음 날 재시도하거나 할당량을 늘리세요

### MCP 서버가 나타나지 않음
→ Claude Desktop을 완전히 종료하고 재시작
→ 설정 파일 경로가 올바른지 확인
→ JSON 문법이 올바른지 확인

## 📊 제공되는 5가지 도구

1. **youtube_search_channel** - 채널 검색 및 정보 조회
2. **youtube_analyze_channel_videos** - 채널 비디오 성과 분석
3. **youtube_search_keyword** - 키워드 기반 비디오 검색
4. **youtube_find_rising_stars** - 라이징 스타 채널 발견
5. **youtube_find_blue_ocean_topics** - 블루오션 토픽 발견

## 🎯 MCP 서버의 장점

- ✅ YouTube 앱과 분리된 독립 실행 (API 독립성)
- ✅ Claude Desktop에서 바로 사용 가능
- ✅ 다른 MCP 서버들과 조합 가능
- ✅ 확장 가능한 아키텍처
- ✅ 표준 MCP 프로토콜 준수

## 📚 추가 리소스

- [MCP 공식 문서](https://modelcontextprotocol.io/)
- [FastMCP 문서](https://gofastmcp.com/)
- [YouTube Data API 문서](https://developers.google.com/youtube/v3)

---

궁금한 점이 있으시면 README.md를 참고하세요!
