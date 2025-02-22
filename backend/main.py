from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
import yt_dlp
import re
import os
from datetime import datetime
from pathlib import Path

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Create downloads directory if it doesn't exist
DOWNLOAD_DIR = Path("downloads")
DOWNLOAD_DIR.mkdir(exist_ok=True)

class VideoURL(BaseModel):
    url: str
    format: str = "mp4"  # Default format
    quality: str = "1080p"  # Default quality

    @validator('url')
    def validate_youtube_url(cls, v):
        # YouTube URL patterns
        youtube_patterns = [
            r'^https?://(?:www\.)?youtube\.com/watch\?v=[\w-]+',
            r'^https?://(?:www\.)?youtube\.com/v/[\w-]+',
            r'^https?://youtu\.be/[\w-]+',
            r'^https?://(?:www\.)?youtube\.com/embed/[\w-]+',
            r'^https?://(?:www\.)?youtube\.com/shorts/[\w-]+'
        ]
        
        if not any(re.match(pattern, v) for pattern in youtube_patterns):
            raise ValueError('Invalid YouTube URL format')
        return v

    @validator('format')
    def validate_format(cls, v):
        allowed_formats = ['mp4', 'webm', 'mp3', '3gp']
        if v not in allowed_formats:
            raise ValueError(f'Format must be one of {allowed_formats}')
        return v

    @validator('quality')
    def validate_quality(cls, v):
        allowed_qualities = ['360p', '480p', '720p', '1080p', 'best']
        if v not in allowed_qualities:
            raise ValueError(f'Quality must be one of {allowed_qualities}')
        return v

def get_safe_filename(title: str) -> str:
    """Convert title to safe filename."""
    # Remove invalid characters
    safe_chars = re.sub(r'[<>:"/\\|?*]', '', title)
    # Limit length and remove trailing spaces
    return safe_chars[:100].strip()

class DownloadProgress:
    def __init__(self):
        self.progress = 0
        self.speed = ""
        self.eta = ""
        self.status = "starting"

    def __call__(self, d):
        if d['status'] == 'downloading':
            self.progress = float(d.get('downloaded_bytes', 0) / d.get('total_bytes', 1)) * 100
            self.speed = d.get('speed', 0)
            self.eta = d.get('eta', 0)
            self.status = "downloading"
        elif d['status'] == 'finished':
            self.progress = 100
            self.status = "finished"
        elif d['status'] == 'error':
            self.status = "error"

@app.get("/")
def read_root():
    return {"message": "YouTube Downloader API"}

@app.post("/download")
async def download_video(video_url: VideoURL):
    try:
        # Configure yt-dlp options
        progress_tracker = DownloadProgress()
        
        format_spec = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' if video_url.format == 'mp4' else 'best'
        if video_url.quality != 'best':
            format_spec = f'bestvideo[height<={video_url.quality[:-1]}][ext=mp4]+bestaudio[ext=m4a]/best[height<={video_url.quality[:-1]}][ext=mp4]/best'

        ydl_opts = {
            'format': format_spec,
            'progress_hooks': [progress_tracker],
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,
        }

        # First get video information
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url.url, download=False)
            
            if not info:
                raise HTTPException(
                    status_code=400,
                    detail="Could not extract video information"
                )

            # Get download options for the best quality
            formats = info.get('formats', [])
            best_video = None
            for f in formats:
                if f.get('ext') == video_url.format and f.get('format_note') == video_url.quality:
                    best_video = f
                    break
            
            if not best_video:
                for f in formats:
                    if f.get('ext') == video_url.format and f.get('format_note', '').endswith('p'):
                        best_video = f
                        break

            if not best_video:
                best_video = formats[-1]

            # Generate safe filename
            safe_title = get_safe_filename(info.get('title', 'video'))
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{safe_title}_{timestamp}.{video_url.format}"
            filepath = DOWNLOAD_DIR / filename

            # Update download options with output template
            ydl_opts.update({
                'outtmpl': str(filepath),
                'extract_flat': False,
            })

            # Prepare video information
            video_info = {
                "title": info.get('title', 'Unknown Title'),
                "author": info.get('uploader', 'Unknown Author'),
                "length": info.get('duration', 0),
                "views": info.get('view_count', 0),
                "thumbnail_url": info.get('thumbnail', ''),
                "download_url": best_video.get('url', ''),
                "is_short": '/shorts/' in video_url.url,
                "resolution": best_video.get('format_note', 'Unknown'),
                "filesize": best_video.get('filesize', 0),
                "ext": video_url.format,
                "download_progress": 0,
                "download_speed": "",
                "download_eta": "",
                "download_status": "preparing",
                "local_filename": filename
            }

            # Start download in background
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([video_url.url])
                video_info["download_status"] = "completed"
                video_info["download_progress"] = 100
            except Exception as e:
                video_info["download_status"] = "error"
                video_info["error_message"] = str(e)

            return video_info

    except yt_dlp.utils.DownloadError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Download error: {str(e)}"
        )
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error processing video: {str(e)}"
        )

@app.get("/formats")
def get_available_formats():
    return {
        "formats": ["mp4", "webm", "mp3", "3gp"],
        "qualities": ["360p", "480p", "720p", "1080p", "best"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 