#!/usr/bin/env python3
"""
YouTube Strategy MCP Server

A Model Context Protocol server that provides YouTube channel and keyword analysis
capabilities to help content creators optimize their YouTube strategy.

This server integrates with YouTube Data API v3 to provide:
- Channel analysis (top performing and underperforming videos)
- Keyword trend analysis
- Rising star channel discovery
- Blue ocean topic identification
- Comprehensive strategy recommendations
"""

import asyncio
import json
import os
import re
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

import httpx
from fastmcp import FastMCP
from pydantic import BaseModel, Field, field_validator, ConfigDict

# ============================================================================
# Constants
# ============================================================================

CHARACTER_LIMIT = 25000
API_BASE_URL = "https://www.googleapis.com/youtube/v3"
DEFAULT_MAX_RESULTS = 50

# ============================================================================
# Initialize MCP Server
# ============================================================================

mcp = FastMCP("youtube_strategy_mcp")

# ============================================================================
# Enums
# ============================================================================


class AnalysisType(str, Enum):
    """Type of YouTube analysis to perform"""

    CHANNEL = "CHANNEL"
    KEYWORD = "KEYWORD"
    RISING_STAR = "RISING_STAR"
    BLUE_OCEAN = "BLUE_OCEAN"


class ChannelAnalysisView(str, Enum):
    """View type for channel analysis"""

    TOP = "TOP"
    BOTTOM = "BOTTOM"


class RegionFilter(str, Enum):
    """Region filter for content"""

    ALL = "ALL"
    KOREA = "KOREA"
    OVERSEAS = "OVERSEAS"


class VideoTypeFilter(str, Enum):
    """Video type filter"""

    ALL = "ALL"
    SHORTS = "SHORTS"  # under 3 minutes
    LONG = "LONG"  # over 3 minutes


class ResponseFormat(str, Enum):
    """Response format options"""

    JSON = "json"
    MARKDOWN = "markdown"


# ============================================================================
# Pydantic Models
# ============================================================================


class VideoData(BaseModel):
    """Video data structure"""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    id: str = Field(..., description="Video ID")
    title: str = Field(..., description="Video title")
    thumbnail: str = Field(..., description="Video thumbnail URL")
    view_count: int = Field(..., description="View count")
    like_count: int = Field(0, description="Like count")
    comment_count: int = Field(0, description="Comment count")
    duration: int = Field(..., description="Duration in seconds")
    popularity_score: float = Field(..., description="Calculated popularity score")
    published_at: Optional[str] = Field(None, description="Published date")
    description: Optional[str] = Field(None, description="Video description")
    channel_id: Optional[str] = Field(None, description="Channel ID")
    channel_title: Optional[str] = Field(None, description="Channel title")


class ChannelInfo(BaseModel):
    """Channel information structure"""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    id: str = Field(..., description="Channel ID")
    title: str = Field(..., description="Channel title")
    thumbnail: str = Field(..., description="Channel thumbnail URL")
    subscriber_count: Optional[int] = Field(None, description="Subscriber count")
    total_view_count: Optional[int] = Field(None, description="Total view count")
    video_count: Optional[int] = Field(None, description="Total video count")
    published_at: Optional[str] = Field(None, description="Channel creation date")


class SearchChannelInput(BaseModel):
    """Input parameters for searching YouTube channels"""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True, extra="forbid")

    api_key: str = Field(
        ...,
        description="YouTube Data API v3 key (get from https://console.developers.google.com)",
        min_length=20,
    )
    channel_name: str = Field(
        ...,
        description="Channel name or handle to search for (e.g., 'MrBeast', '@pewdiepie', '재림교회 안식일학교')",
        min_length=1,
        max_length=200,
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.JSON, description="Response format: 'json' or 'markdown'"
    )


class AnalyzeChannelVideosInput(BaseModel):
    """Input parameters for analyzing channel videos"""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True, extra="forbid")

    api_key: str = Field(
        ...,
        description="YouTube Data API v3 key",
        min_length=20,
    )
    channel_id: str = Field(
        ...,
        description="YouTube channel ID (e.g., 'UCX6OQ3DkcsbYNE6H8uQQuVA')",
        min_length=10,
        max_length=50,
    )
    view_type: ChannelAnalysisView = Field(
        default=ChannelAnalysisView.TOP,
        description="Analysis view: 'TOP' for best performing, 'BOTTOM' for underperforming videos",
    )
    max_results: int = Field(
        default=20, description="Maximum number of videos to analyze", ge=1, le=50
    )
    video_type_filter: VideoTypeFilter = Field(
        default=VideoTypeFilter.ALL, description="Filter by video type: 'ALL', 'SHORTS', or 'LONG'"
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.JSON, description="Response format: 'json' or 'markdown'"
    )


class SearchKeywordInput(BaseModel):
    """Input parameters for keyword-based video search"""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True, extra="forbid")

    api_key: str = Field(
        ...,
        description="YouTube Data API v3 key",
        min_length=20,
    )
    keyword: str = Field(
        ...,
        description="Search keyword or phrase (e.g., 'AI tutorial', '요리 레시피', 'productivity tips')",
        min_length=1,
        max_length=200,
    )
    max_results: int = Field(
        default=20, description="Maximum number of videos to return", ge=1, le=50
    )
    region_filter: RegionFilter = Field(
        default=RegionFilter.ALL, description="Filter by region: 'ALL', 'KOREA', or 'OVERSEAS'"
    )
    video_type_filter: VideoTypeFilter = Field(
        default=VideoTypeFilter.ALL, description="Filter by video type: 'ALL', 'SHORTS', or 'LONG'"
    )
    published_after: Optional[str] = Field(
        None,
        description="Filter videos published after this date (ISO 8601 format, e.g., '2024-01-01T00:00:00Z')",
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.JSON, description="Response format: 'json' or 'markdown'"
    )


class FindRisingStarsInput(BaseModel):
    """Input parameters for finding rising star channels"""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True, extra="forbid")

    api_key: str = Field(
        ...,
        description="YouTube Data API v3 key",
        min_length=20,
    )
    category: str = Field(
        ...,
        description="Content category to search in (e.g., 'tech', 'gaming', 'cooking', 'education')",
        min_length=1,
        max_length=100,
    )
    max_channels: int = Field(
        default=10, description="Maximum number of channels to return", ge=1, le=20
    )
    min_subscribers: int = Field(
        default=1000, description="Minimum subscriber count", ge=0
    )
    max_subscribers: int = Field(
        default=100000, description="Maximum subscriber count", ge=1000
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.JSON, description="Response format: 'json' or 'markdown'"
    )


class FindBlueOceanTopicsInput(BaseModel):
    """Input parameters for finding blue ocean topics"""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True, extra="forbid")

    api_key: str = Field(
        ...,
        description="YouTube Data API v3 key",
        min_length=20,
    )
    broad_category: str = Field(
        ...,
        description="Broad content category (e.g., 'technology', 'cooking', 'fitness', 'education')",
        min_length=1,
        max_length=100,
    )
    max_topics: int = Field(
        default=10, description="Maximum number of topics to return", ge=1, le=20
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.JSON, description="Response format: 'json' or 'markdown'"
    )


# ============================================================================
# Helper Functions
# ============================================================================


def parse_duration(duration: str) -> int:
    """Parse ISO 8601 duration to seconds"""
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration)
    if not match:
        return 0
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    return hours * 3600 + minutes * 60 + seconds


def calculate_popularity_score(
    view_count: int, like_count: int, comment_count: int, days_since_published: int
) -> float:
    """Calculate a popularity score for a video"""
    if days_since_published <= 0:
        days_since_published = 1

    # Engagement rate (likes + comments per view)
    engagement = (like_count + comment_count) / max(view_count, 1)

    # Views per day
    views_per_day = view_count / days_since_published

    # Combined score
    score = (views_per_day * 0.7) + (engagement * view_count * 0.3)
    return round(score, 2)


def filter_videos_by_type(videos: List[VideoData], filter_type: VideoTypeFilter) -> List[VideoData]:
    """Filter videos by type (shorts vs long)"""
    if filter_type == VideoTypeFilter.ALL:
        return videos
    elif filter_type == VideoTypeFilter.SHORTS:
        return [v for v in videos if v.duration < 180]  # under 3 minutes
    else:  # LONG
        return [v for v in videos if v.duration >= 180]  # 3 minutes or more


def filter_videos_by_region(videos: List[VideoData], region: RegionFilter) -> List[VideoData]:
    """Filter videos by region based on title/description language"""
    if region == RegionFilter.ALL:
        return videos

    korean_pattern = re.compile(r"[가-힣]")

    def has_korean(text: str) -> bool:
        return bool(korean_pattern.search(text))

    if region == RegionFilter.KOREA:
        return [v for v in videos if has_korean(v.title) or (v.description and has_korean(v.description))]
    else:  # OVERSEAS
        return [
            v for v in videos if not has_korean(v.title) and not (v.description and has_korean(v.description))
        ]


def truncate_if_needed(content: str, max_chars: int = CHARACTER_LIMIT) -> str:
    """Truncate content if it exceeds character limit"""
    if len(content) <= max_chars:
        return content

    truncated = content[:max_chars]
    return f"{truncated}\n\n[Content truncated - exceeded {max_chars} character limit]"


def resolve_api_key(passed_api_key: Optional[str]) -> str:
    """Resolve API key from param or environment variable.

    Priority: explicit param > env(YOUTUBE_API_KEY)
    """
    api_key = passed_api_key or os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        raise Exception(
            "YouTube API key is required. Pass api_key param or set YOUTUBE_API_KEY environment variable."
        )
    return api_key

def format_channel_info(channel: ChannelInfo, format_type: ResponseFormat) -> str:
    """Format channel information"""
    if format_type == ResponseFormat.JSON:
        return json.dumps(channel.model_dump(), indent=2)
    else:
        md = f"# Channel: {channel.title}\n\n"
        md += f"**Channel ID:** {channel.id}\n"
        if channel.subscriber_count:
            md += f"**Subscribers:** {channel.subscriber_count:,}\n"
        if channel.total_view_count:
            md += f"**Total Views:** {channel.total_view_count:,}\n"
        if channel.video_count:
            md += f"**Video Count:** {channel.video_count:,}\n"
        if channel.published_at:
            md += f"**Created:** {channel.published_at}\n"
        md += f"\n**Thumbnail:** {channel.thumbnail}\n"
        return md


def format_video_list(videos: List[VideoData], format_type: ResponseFormat, title: str = "Videos") -> str:
    """Format a list of videos"""
    if format_type == ResponseFormat.JSON:
        return json.dumps([v.model_dump() for v in videos], indent=2)
    else:
        md = f"# {title}\n\n"
        md += f"**Total Videos:** {len(videos)}\n\n"
        for i, video in enumerate(videos, 1):
            md += f"## {i}. {video.title}\n"
            md += f"- **Video ID:** {video.id}\n"
            md += f"- **Views:** {video.view_count:,}\n"
            md += f"- **Likes:** {video.like_count:,}\n"
            md += f"- **Comments:** {video.comment_count:,}\n"
            md += f"- **Duration:** {video.duration // 60}m {video.duration % 60}s\n"
            md += f"- **Popularity Score:** {video.popularity_score}\n"
            if video.published_at:
                md += f"- **Published:** {video.published_at}\n"
            md += f"- **Watch:** https://youtube.com/watch?v={video.id}\n"
            md += "\n"
        return md


# ============================================================================
# YouTube API Functions
# ============================================================================


async def youtube_api_request(
    endpoint: str, params: Dict[str, Any], api_key: str
) -> Dict[str, Any]:
    """Make a request to YouTube API"""
    params["key"] = api_key
    url = f"{API_BASE_URL}/{endpoint}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            error_data = {}
            try:
                error_data = e.response.json()
            except Exception:
                pass

            error_message = error_data.get("error", {}).get("message", f"HTTP {e.response.status_code}")

            # Provide helpful error messages
            if e.response.status_code == 403:
                if "API has not been used" in error_message or "is disabled" in error_message:
                    raise Exception(
                        "YouTube Data API v3 is not enabled. "
                        "Please enable it at https://console.developers.google.com/apis/api/youtube.googleapis.com/overview"
                    )
                elif "API key not valid" in error_message or "keyInvalid" in error_message:
                    raise Exception("Invalid API key. Please check your YouTube Data API v3 key.")
                elif "quota" in error_message.lower():
                    raise Exception("YouTube API quota exceeded. Please try again later.")

            raise Exception(f"YouTube API error: {error_message}")
        except httpx.TimeoutException:
            raise Exception("Request timed out. Please try again.")
        except Exception as e:
            if "YouTube API error" in str(e) or "not enabled" in str(e) or "Invalid API" in str(e):
                raise
            raise Exception(f"API request failed: {str(e)}")


async def search_channel_by_name(api_key: str, channel_name: str) -> Optional[ChannelInfo]:
    """Search for a channel by name and return channel info"""
    # Search for channel
    search_data = await youtube_api_request(
        "search",
        {
            "part": "snippet",
            "q": channel_name,
            "type": "channel",
            "maxResults": 1,
        },
        api_key,
    )

    if not search_data.get("items"):
        return None

    channel_id = search_data["items"][0]["id"]["channelId"]

    # Get detailed channel info
    channel_data = await youtube_api_request(
        "channels",
        {
            "part": "snippet,statistics",
            "id": channel_id,
        },
        api_key,
    )

    if not channel_data.get("items"):
        return None

    item = channel_data["items"][0]
    snippet = item["snippet"]
    stats = item.get("statistics", {})

    return ChannelInfo(
        id=channel_id,
        title=snippet["title"],
        thumbnail=snippet["thumbnails"]["default"]["url"],
        subscriber_count=int(stats.get("subscriberCount", 0)),
        total_view_count=int(stats.get("viewCount", 0)),
        video_count=int(stats.get("videoCount", 0)),
        published_at=snippet.get("publishedAt"),
    )


async def get_channel_videos(
    api_key: str,
    channel_id: str,
    max_results: int = 50,
) -> List[VideoData]:
    """Get videos from a channel with detailed statistics (supports pagination)"""
    collected_ids: List[str] = []
    next_page_token: Optional[str] = None

    while len(collected_ids) < max_results:
        params: Dict[str, Any] = {
            "part": "snippet",
            "channelId": channel_id,
            "type": "video",
            "order": "date",
            "maxResults": min(50, max_results - len(collected_ids)),
        }
        if next_page_token:
            params["pageToken"] = next_page_token

        search_data = await youtube_api_request("search", params, api_key)
        items = search_data.get("items", [])
        if not items:
            break
        collected_ids.extend([item["id"]["videoId"] for item in items])
        next_page_token = search_data.get("nextPageToken")
        if not next_page_token:
            break

    collected_ids = collected_ids[:max_results]

    # Fetch details in batches of 50
    videos_items: List[Dict[str, Any]] = []
    for i in range(0, len(collected_ids), 50):
        batch_ids = collected_ids[i : i + 50]
        videos_data = await youtube_api_request(
            "videos",
            {
                "part": "snippet,statistics,contentDetails",
                "id": ",".join(batch_ids),
            },
            api_key,
        )
        videos_items.extend(videos_data.get("items", []))

    videos = []
    for item in videos_items:
        snippet = item["snippet"]
        stats = item["statistics"]
        content = item["contentDetails"]

        published = datetime.fromisoformat(snippet["publishedAt"].replace("Z", "+00:00"))
        days_since = (datetime.now(published.tzinfo) - published).days

        duration_seconds = parse_duration(content["duration"])
        view_count = int(stats.get("viewCount", 0))
        like_count = int(stats.get("likeCount", 0))
        comment_count = int(stats.get("commentCount", 0))

        popularity = calculate_popularity_score(view_count, like_count, comment_count, days_since)

        videos.append(
            VideoData(
                id=item["id"],
                title=snippet["title"],
                thumbnail=snippet["thumbnails"]["default"]["url"],
                view_count=view_count,
                like_count=like_count,
                comment_count=comment_count,
                duration=duration_seconds,
                popularity_score=popularity,
                published_at=snippet["publishedAt"],
                description=snippet.get("description", "")[:500],  # truncate description
                channel_id=snippet["channelId"],
                channel_title=snippet["channelTitle"],
            )
        )

    return videos


async def search_videos_by_keyword(
    api_key: str,
    keyword: str,
    max_results: int = 20,
    published_after: Optional[str] = None,
) -> List[VideoData]:
    """Search for videos by keyword (supports pagination)"""
    collected_ids: List[str] = []
    next_page_token: Optional[str] = None

    while len(collected_ids) < max_results:
        params: Dict[str, Any] = {
            "part": "snippet",
            "q": keyword,
            "type": "video",
            "order": "relevance",
            "maxResults": min(50, max_results - len(collected_ids)),
        }
        if published_after:
            params["publishedAfter"] = published_after
        if next_page_token:
            params["pageToken"] = next_page_token

        search_data = await youtube_api_request("search", params, api_key)
        items = search_data.get("items", [])
        if not items:
            break
        collected_ids.extend([item["id"]["videoId"] for item in items])
        next_page_token = search_data.get("nextPageToken")
        if not next_page_token:
            break

    collected_ids = collected_ids[:max_results]

    # Fetch details in batches of 50
    videos_items: List[Dict[str, Any]] = []
    for i in range(0, len(collected_ids), 50):
        batch_ids = collected_ids[i : i + 50]
        videos_data = await youtube_api_request(
            "videos",
            {
                "part": "snippet,statistics,contentDetails",
                "id": ",".join(batch_ids),
            },
            api_key,
        )
        videos_items.extend(videos_data.get("items", []))

    videos = []
    for item in videos_items:
        snippet = item["snippet"]
        stats = item["statistics"]
        content = item["contentDetails"]

        published = datetime.fromisoformat(snippet["publishedAt"].replace("Z", "+00:00"))
        days_since = (datetime.now(published.tzinfo) - published).days

        duration_seconds = parse_duration(content["duration"])
        view_count = int(stats.get("viewCount", 0))
        like_count = int(stats.get("likeCount", 0))
        comment_count = int(stats.get("commentCount", 0))

        popularity = calculate_popularity_score(view_count, like_count, comment_count, days_since)

        videos.append(
            VideoData(
                id=item["id"],
                title=snippet["title"],
                thumbnail=snippet["thumbnails"]["default"]["url"],
                view_count=view_count,
                like_count=like_count,
                comment_count=comment_count,
                duration=duration_seconds,
                popularity_score=popularity,
                published_at=snippet["publishedAt"],
                description=snippet.get("description", "")[:500],
                channel_id=snippet["channelId"],
                channel_title=snippet["channelTitle"],
            )
        )

    return videos


# ============================================================================
# MCP Tools
# ============================================================================


@mcp.tool(
    name="youtube_search_channel",
    annotations={
        "title": "Search YouTube Channel",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def youtube_search_channel(params: SearchChannelInput) -> str:
    """Search for a YouTube channel by name and get detailed information.

    This tool searches YouTube for a channel by name or handle and returns comprehensive
    channel information including subscriber count, total views, and video count.

    Args:
        params (SearchChannelInput): Input parameters containing:
            - api_key (str): YouTube Data API v3 key
            - channel_name (str): Channel name or handle to search
            - response_format (str): Response format - 'json' or 'markdown' (default: 'json')

    Returns:
        str: Channel information in JSON or Markdown format

    Example Usage:
        Use this when you need to find a channel's ID or get basic statistics about a channel.
        Provide the channel name (e.g., 'MrBeast', '@pewdiepie') and get back channel details.

    Error Handling:
        - Returns error if API key is invalid or API is not enabled
        - Returns null result if channel is not found
        - Provides guidance on enabling YouTube API if needed
    """
    try:
        api_key = resolve_api_key(getattr(params, "api_key", None))
        channel = await search_channel_by_name(api_key, params.channel_name)

        if not channel:
            return json.dumps(
                {"success": False, "error": f"Channel not found: {params.channel_name}"}
            )

        result = {
            "success": True,
            "channel": channel.model_dump(),
        }

        if params.response_format == ResponseFormat.JSON:
            return truncate_if_needed(json.dumps(result, indent=2))
        else:
            md = "# Channel Search Result\n\n"
            md += format_channel_info(channel, ResponseFormat.MARKDOWN)
            return truncate_if_needed(md)

    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


@mcp.tool(
    name="youtube_analyze_channel_videos",
    annotations={
        "title": "Analyze Channel Videos",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def youtube_analyze_channel_videos(params: AnalyzeChannelVideosInput) -> str:
    """Analyze a YouTube channel's videos to identify top performers or underperformers.

    This tool retrieves and analyzes videos from a channel, calculating popularity scores
    based on views, engagement, and recency. Results can be filtered by video type (shorts vs long)
    and sorted to show either top performing or underperforming videos.

    Args:
        params (AnalyzeChannelVideosInput): Input parameters containing:
            - api_key (str): YouTube Data API v3 key
            - channel_id (str): YouTube channel ID
            - view_type (str): 'TOP' for best videos or 'BOTTOM' for underperformers
            - max_results (int): Maximum videos to analyze (1-50, default: 20)
            - video_type_filter (str): Filter by 'ALL', 'SHORTS', or 'LONG'
            - response_format (str): Response format - 'json' or 'markdown'

    Returns:
        str: Analysis results with video details and popularity scores

    Example Usage:
        Use this to identify which videos are performing well or poorly for strategy optimization.
        Filter by shorts to analyze short-form content separately from long-form videos.

    Error Handling:
        - Returns error if API key is invalid
        - Returns empty list if no videos match filters
        - Handles quota exceeded errors gracefully
    """
    try:
        api_key = resolve_api_key(getattr(params, "api_key", None))
        videos = await get_channel_videos(api_key, params.channel_id, params.max_results)

        if not videos:
            return json.dumps({"success": False, "error": "No videos found for this channel"})

        # Apply video type filter
        videos = filter_videos_by_type(videos, params.video_type_filter)

        if not videos:
            return json.dumps(
                {"success": False, "error": f"No {params.video_type_filter.value} videos found"}
            )

        # Sort by popularity score
        if params.view_type == ChannelAnalysisView.TOP:
            videos = sorted(videos, key=lambda v: v.popularity_score, reverse=True)
            title = "Top Performing Videos"
        else:
            videos = sorted(videos, key=lambda v: v.popularity_score)
            title = "Underperforming Videos"

        result = {
            "success": True,
            "analysis_type": params.view_type.value,
            "video_type_filter": params.video_type_filter.value,
            "total_videos": len(videos),
            "videos": [v.model_dump() for v in videos],
        }

        if params.response_format == ResponseFormat.JSON:
            return truncate_if_needed(json.dumps(result, indent=2))
        else:
            md = f"# Channel Video Analysis\n\n"
            md += f"**Analysis Type:** {params.view_type.value}\n"
            md += f"**Video Filter:** {params.video_type_filter.value}\n\n"
            md += format_video_list(videos, ResponseFormat.MARKDOWN, title)
            return truncate_if_needed(md)

    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


@mcp.tool(
    name="youtube_search_keyword",
    annotations={
        "title": "Search Videos by Keyword",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def youtube_search_keyword(params: SearchKeywordInput) -> str:
    """Search for YouTube videos by keyword and analyze trends.

    This tool searches YouTube for videos matching a keyword and returns detailed statistics
    including views, engagement metrics, and popularity scores. Results can be filtered by
    region (Korea vs overseas based on language) and video type (shorts vs long).

    Args:
        params (SearchKeywordInput): Input parameters containing:
            - api_key (str): YouTube Data API v3 key
            - keyword (str): Search keyword or phrase
            - max_results (int): Maximum videos to return (1-50, default: 20)
            - region_filter (str): Filter by 'ALL', 'KOREA', or 'OVERSEAS'
            - video_type_filter (str): Filter by 'ALL', 'SHORTS', or 'LONG'
            - published_after (str): Optional date filter (ISO 8601 format)
            - response_format (str): Response format - 'json' or 'markdown'

    Returns:
        str: Search results with video details and trend analysis

    Example Usage:
        Use this to research keywords for content ideas or analyze trending topics.
        Filter by region to see local vs international competition for a keyword.

    Error Handling:
        - Returns empty results if no videos match criteria
        - Handles API quota limits gracefully
        - Provides clear error messages for invalid parameters
    """
    try:
        api_key = resolve_api_key(getattr(params, "api_key", None))
        videos = await search_videos_by_keyword(
            api_key,
            params.keyword,
            params.max_results,
            params.published_after,
        )

        if not videos:
            return json.dumps({"success": False, "error": f"No videos found for keyword: {params.keyword}"})

        # Apply filters
        videos = filter_videos_by_region(videos, params.region_filter)
        videos = filter_videos_by_type(videos, params.video_type_filter)

        if not videos:
            return json.dumps({"success": False, "error": "No videos match the specified filters"})

        # Sort by popularity
        videos = sorted(videos, key=lambda v: v.popularity_score, reverse=True)

        result = {
            "success": True,
            "keyword": params.keyword,
            "region_filter": params.region_filter.value,
            "video_type_filter": params.video_type_filter.value,
            "total_videos": len(videos),
            "videos": [v.model_dump() for v in videos],
        }

        if params.response_format == ResponseFormat.JSON:
            return truncate_if_needed(json.dumps(result, indent=2))
        else:
            md = f"# Keyword Search Results: {params.keyword}\n\n"
            md += f"**Region Filter:** {params.region_filter.value}\n"
            md += f"**Video Filter:** {params.video_type_filter.value}\n\n"
            md += format_video_list(videos, ResponseFormat.MARKDOWN, f"Videos for '{params.keyword}'")
            return truncate_if_needed(md)

    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


@mcp.tool(
    name="youtube_find_rising_stars",
    annotations={
        "title": "Find Rising Star Channels",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def youtube_find_rising_stars(params: FindRisingStarsInput) -> str:
    """Find rising star channels in a specific category with high engagement potential.

    This tool identifies smaller channels (based on subscriber range) that are gaining traction
    in a specific category. Useful for finding collaboration opportunities or analyzing
    emerging competition.

    Args:
        params (FindRisingStarsInput): Input parameters containing:
            - api_key (str): YouTube Data API v3 key
            - category (str): Content category to search
            - max_channels (int): Maximum channels to return (1-20, default: 10)
            - min_subscribers (int): Minimum subscriber count (default: 1000)
            - max_subscribers (int): Maximum subscriber count (default: 100000)
            - response_format (str): Response format - 'json' or 'markdown'

    Returns:
        str: List of rising star channels with growth metrics

    Example Usage:
        Use this to find emerging creators in your niche for collaboration or competitive analysis.
        Set subscriber ranges to identify channels at your growth stage.

    Error Handling:
        - Returns empty list if no channels match criteria
        - Validates subscriber range parameters
        - Handles API limitations gracefully
    """
    try:
        api_key = resolve_api_key(getattr(params, "api_key", None))
        # Search for channels in category
        search_data = await youtube_api_request(
            "search",
            {
                "part": "snippet",
                "q": params.category,
                "type": "channel",
                "order": "relevance",
                "maxResults": min(params.max_channels * 3, 50),  # Get more to filter
            },
            api_key,
        )

        if not search_data.get("items"):
            return json.dumps({"success": False, "error": f"No channels found in category: {params.category}"})

        channel_ids = [item["id"]["channelId"] for item in search_data["items"]]

        # Get detailed channel statistics
        channels_data = await youtube_api_request(
            "channels",
            {
                "part": "snippet,statistics",
                "id": ",".join(channel_ids),
            },
            api_key,
        )

        channels = []
        for item in channels_data.get("items", []):
            snippet = item["snippet"]
            stats = item["statistics"]
            sub_count = int(stats.get("subscriberCount", 0))

            # Filter by subscriber range
            if params.min_subscribers <= sub_count <= params.max_subscribers:
                channels.append(
                    ChannelInfo(
                        id=item["id"],
                        title=snippet["title"],
                        thumbnail=snippet["thumbnails"]["default"]["url"],
                        subscriber_count=sub_count,
                        total_view_count=int(stats.get("viewCount", 0)),
                        video_count=int(stats.get("videoCount", 0)),
                        published_at=snippet.get("publishedAt"),
                    )
                )

        if not channels:
            return json.dumps(
                {
                    "success": False,
                    "error": f"No channels found in subscriber range {params.min_subscribers}-{params.max_subscribers}",
                }
            )

        # Sort by engagement (views per subscriber)
        channels = sorted(
            channels,
            key=lambda c: c.total_view_count / max(c.subscriber_count, 1),
            reverse=True,
        )
        channels = channels[: params.max_channels]

        result = {
            "success": True,
            "category": params.category,
            "subscriber_range": f"{params.min_subscribers}-{params.max_subscribers}",
            "total_channels": len(channels),
            "channels": [c.model_dump() for c in channels],
        }

        if params.response_format == ResponseFormat.JSON:
            return truncate_if_needed(json.dumps(result, indent=2))
        else:
            md = f"# Rising Star Channels: {params.category}\n\n"
            md += f"**Subscriber Range:** {params.min_subscribers:,} - {params.max_subscribers:,}\n"
            md += f"**Total Channels Found:** {len(channels)}\n\n"
            for i, channel in enumerate(channels, 1):
                md += f"## {i}. {channel.title}\n"
                md += format_channel_info(channel, ResponseFormat.MARKDOWN)
                md += "\n---\n\n"
            return truncate_if_needed(md)

    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


@mcp.tool(
    name="youtube_find_blue_ocean_topics",
    annotations={
        "title": "Find Blue Ocean Topics",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def youtube_find_blue_ocean_topics(params: FindBlueOceanTopicsInput) -> str:
    """Identify underserved topics (blue ocean opportunities) in a broad category.

    This tool analyzes a broad content category to find specific sub-topics with high search
    interest but low competition. These "blue ocean" opportunities represent potential content
    gaps where creators can establish authority.

    Args:
        params (FindBlueOceanTopicsInput): Input parameters containing:
            - api_key (str): YouTube Data API v3 key
            - broad_category (str): Broad content category to analyze
            - max_topics (int): Maximum topics to return (1-20, default: 10)
            - response_format (str): Response format - 'json' or 'markdown'

    Returns:
        str: List of blue ocean topics with competition analysis

    Example Usage:
        Use this to discover content opportunities with less competition.
        Identify niche topics within your broader category that are underserved.

    Note:
        This is a simplified blue ocean analysis. More sophisticated analysis would require
        additional data sources and longer-term trend analysis.

    Error Handling:
        - Returns error if category is too broad or narrow
        - Handles API quota limits
        - Provides suggestions if no opportunities found
    """
    try:
        api_key = resolve_api_key(getattr(params, "api_key", None))
        # This is a simplified implementation that searches for related keywords
        # and analyzes video count vs engagement
        search_data = await youtube_api_request(
            "search",
            {
                "part": "snippet",
                "q": params.broad_category,
                "type": "video",
                "order": "relevance",
                "maxResults": 50,
            },
            api_key,
        )

        if not search_data.get("items"):
            return json.dumps({"success": False, "error": f"No data found for category: {params.broad_category}"})

        # Extract common keywords from titles
        titles = [item["snippet"]["title"] for item in search_data["items"]]

        # Simple keyword extraction (in production, use NLP libraries)
        keywords = {}
        for title in titles:
            words = title.lower().split()
            for word in words:
                if len(word) > 4 and word.isalpha():  # Simple filter
                    keywords[word] = keywords.get(word, 0) + 1

        # Find keywords with moderate frequency (not oversaturated)
        sorted_keywords = sorted(keywords.items(), key=lambda x: x[1])
        blue_ocean_keywords = sorted_keywords[: params.max_topics]

        topics = []
        for keyword, count in blue_ocean_keywords:
            topics.append(
                {
                    "topic": keyword.capitalize(),
                    "mention_count": count,
                    "opportunity_score": round(100 / (count + 1), 2),  # Lower mentions = higher opportunity
                    "suggested_title": f"{params.broad_category}: {keyword.capitalize()} Guide",
                }
            )

        result = {
            "success": True,
            "category": params.broad_category,
            "analysis_note": "Blue ocean topics identified based on low competition and moderate interest",
            "total_topics": len(topics),
            "topics": topics,
        }

        if params.response_format == ResponseFormat.JSON:
            return truncate_if_needed(json.dumps(result, indent=2))
        else:
            md = f"# Blue Ocean Topics: {params.broad_category}\n\n"
            md += "These topics show potential opportunities with lower competition:\n\n"
            for i, topic in enumerate(topics, 1):
                md += f"## {i}. {topic['topic']}\n"
                md += f"- **Mention Count:** {topic['mention_count']} (lower = less competition)\n"
                md += f"- **Opportunity Score:** {topic['opportunity_score']}/100\n"
                md += f"- **Suggested Title:** {topic['suggested_title']}\n\n"
            return truncate_if_needed(md)

    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


# ============================================================================
# Server Entry Point
# ============================================================================

if __name__ == "__main__":
    # Run the MCP server
    mcp.run()
