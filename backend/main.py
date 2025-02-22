from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
import yt_dlp
import re
import os
from datetime import datetime
from pathlib import Path
from typing import Dict
import asyncio
from concurrent.futures import ThreadPoolExecutor
import threading
import tkinter as tk
from tkinter import filedialog
import subprocess

app = FastAPI()

# Global dictionary to store download progress
download_progress: Dict[str, dict] = {}

# Thread pool for handling downloads
thread_pool = ThreadPoolExecutor(max_workers=4)

# Lock for thread-safe operations
progress_lock = threading.Lock()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000","http://localhost:3001", "http://127.0.0.1:3001"],
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
    save_path: str = ""  # 用户指定的保存路径，默认为空

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

    @validator('save_path')
    def validate_save_path(cls, v):
        if v:  # 如果提供了保存路径
            try:
                # 转换为 Path 对象进行验证
                path = Path(v)
                # 检查路径是否存在
                if not path.exists():
                    path.mkdir(parents=True, exist_ok=True)
                # 检查是否有写入权限
                if not os.access(str(path), os.W_OK):
                    raise ValueError('No write permission for the specified path')
                # 返回标准化的路径字符串
                return str(path.absolute())
            except Exception as e:
                raise ValueError(f'Invalid save path: {str(e)}')
        return str(DOWNLOAD_DIR.absolute())  # 如果未提供，返回默认下载目录

def get_safe_filename(title: str) -> str:
    """Convert title to safe filename."""
    # Remove invalid characters
    safe_chars = re.sub(r'[<>:"/\\|?*]', '', title)
    # Limit length and remove trailing spaces
    return safe_chars[:100].strip()

def update_progress(filename: str, progress_data: dict):
    with progress_lock:
        if filename in download_progress:
            download_progress[filename].update(progress_data)

class DownloadProgress:
    def __init__(self):
        self.progress = 0
        self.speed = ""
        self.eta = "calculating..."
        self.status = "starting"
        self.filename = ""

    def __call__(self, d):
        if d['status'] == 'downloading':
            try:
                # Calculate progress
                total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
                downloaded_bytes = d.get('downloaded_bytes', 0)
                
                if total_bytes > 0:
                    self.progress = round((downloaded_bytes / total_bytes) * 100, 2)
                
                # Format speed
                speed_bytes = d.get('speed', 0)
                if speed_bytes:
                    if speed_bytes > 1024 * 1024:  # MB/s
                        self.speed = f"{(speed_bytes / (1024 * 1024)):.1f} MB/s"
                    else:  # KB/s
                        self.speed = f"{(speed_bytes / 1024):.1f} KB/s"
                else:
                    self.speed = "calculating..."
                
                # Format ETA
                eta_seconds = d.get('eta')
                if eta_seconds is not None and eta_seconds > 0:
                    minutes = int(eta_seconds // 60)
                    seconds = int(eta_seconds % 60)
                    self.eta = f"{minutes}:{seconds:02d}"
                else:
                    self.eta = "calculating..."
                
                self.status = "downloading"
                
                # Update global progress tracker
                if self.filename:
                    update_progress(self.filename, {
                        "download_progress": self.progress,
                        "download_speed": self.speed,
                        "download_eta": self.eta,
                        "download_status": self.status
                    })
            except Exception as e:
                print(f"Error updating progress: {str(e)}")
                self.status = "error"
                if self.filename:
                    update_progress(self.filename, {
                        "download_progress": 0,
                        "download_speed": "0 KB/s",
                        "download_eta": "--:--",
                        "download_status": "error",
                        "error_message": str(e)
                    })
        
        elif d['status'] == 'finished':
            self.progress = 100
            self.status = "processing"  # 表示正在处理（如果需要后处理）
            self.speed = "完成"  # 使用中文更友好
            self.eta = "--:--"
            
            if self.filename:
                update_progress(self.filename, {
                    "download_progress": 100,
                    "download_speed": "完成",
                    "download_eta": "--:--",
                    "download_status": "processing"
                })
        
        elif d['status'] == 'error':
            self.status = "error"
            if self.filename:
                update_progress(self.filename, {
                    "download_progress": 0,
                    "download_speed": "0 KB/s",
                    "download_eta": "--:--",
                    "download_status": "error"
                })

def extract_video_info(url: str, format: str, quality: str) -> tuple:
    """Extract video information without downloading."""
    # 基本选项
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,  # 获取完整信息
    }

    try:
        # 首先获取基本视频信息
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
                if not info:
                    raise ValueError("Could not extract video information")
            except yt_dlp.utils.DownloadError as e:
                print(f"Download error in extract_info: {str(e)}")
                raise ValueError(f"Failed to extract video info: {str(e)}")
            except Exception as e:
                print(f"Unexpected error in extract_info: {str(e)}")
                raise ValueError(f"Error extracting video info: {str(e)}")

        # 获取所有可用的格式
        formats = info.get('formats', [])
        if not formats:
            raise ValueError("No available formats found")

        # 将质量字符串转换为数字（用于比较）
        target_height = 0
        if quality != 'best':
            target_height = int(quality[:-1])  # 去掉'p'后转换为整数

        # 按照分辨率和格式过滤和排序视频
        suitable_formats = []
        for f in formats:
            # 检查格式是否匹配
            if format == 'mp3':
                if f.get('acodec') != 'none' and f.get('vcodec') == 'none':
                    suitable_formats.append(f)
            else:
                # 视频格式必须匹配且包含视频流
                if f.get('ext') == format and f.get('vcodec') != 'none':
                    height = f.get('height', 0)
                    # 对于特定质量，只选择小于等于目标高度的视频
                    if quality == 'best' or (height and height <= target_height):
                        suitable_formats.append(f)

        if not suitable_formats:
            print(f"No suitable formats found for {format} and {quality}, falling back to best available")
            # 如果没有完全匹配的格式，尝试找到最接近的
            for f in formats:
                if format == 'mp3':
                    if f.get('acodec') != 'none':
                        suitable_formats.append(f)
                elif f.get('vcodec') != 'none':
                    suitable_formats.append(f)

        if not suitable_formats:
            raise ValueError(f"No suitable format found for {format} {quality}")

        # 选择最佳匹配
        if format == 'mp3':
            # 音频选择最高比特率
            best_format = max(suitable_formats, key=lambda f: f.get('abr', 0) or 0)
        else:
            # 视频按分辨率排序
            suitable_formats.sort(key=lambda f: (f.get('height', 0) or 0, f.get('tbr', 0) or 0), reverse=True)
            
            if quality == 'best':
                best_format = suitable_formats[0]  # 最高质量
            else:
                # 找到不超过目标分辨率的最高质量
                target_formats = [f for f in suitable_formats if f.get('height', 0) <= target_height]
                best_format = target_formats[0] if target_formats else suitable_formats[-1]

        # 设置下载格式规范
        if format == 'mp3':
            format_spec = 'bestaudio[ext=mp3]/bestaudio'
        else:
            if quality == 'best':
                format_spec = f'best[ext={format}]/best'
            else:
                format_spec = f'bestvideo[height<={target_height}][ext={format}]+bestaudio[ext=m4a]/best[height<={target_height}][ext={format}]'

        # 更新ydl选项
        ydl_opts['format'] = format_spec
        
        print(f"Selected format: {best_format.get('format_id')} - {best_format.get('height')}p")
        return info, best_format

    except Exception as e:
        print(f"Error in extract_video_info: {str(e)}")
        raise ValueError(f"Failed to process video: {str(e)}")

def download_in_background(url: str, ydl_opts: dict, filename: str):
    try:
        # 记录初始状态
        print(f"Starting download for {filename}")
        print(f"Download options: {ydl_opts}")
        
        update_progress(filename, {
            "download_status": "preparing",
            "download_progress": 0,
            "download_speed": "准备中...",
            "download_eta": "--:--"
        })

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                # 确保 URL 不为空
                if not url:
                    raise ValueError("URL is empty")
                
                # 先尝试获取视频信息
                print(f"Extracting info for URL: {url}")
                info = ydl.extract_info(url, download=False)
                if not info:
                    raise ValueError("Failed to extract video info")
                
                # 检查格式信息
                formats = info.get('formats')
                if not formats:
                    print("Warning: No formats found in video info")
                
                # 开始下载
                print(f"Starting actual download for {url}")
                ydl.download([url])
                
                # 更新最终状态
                update_progress(filename, {
                    "download_status": "completed",
                    "download_progress": 100,
                    "download_speed": "完成",  # 使用中文更友好
                    "download_eta": "--:--"
                })
                return True
                
            except yt_dlp.utils.DownloadError as e:
                print(f"Download error: {str(e)}")
                error_message = str(e)
                if "Video unavailable" in error_message:
                    error_message = "视频不可用，可能是私有或已删除"
                elif "This video is only available for registered users" in error_message:
                    error_message = "此视频需要登录才能观看，请尝试其他视频"
                update_progress(filename, {
                    "download_status": "error",
                    "download_progress": 0,
                    "download_speed": "0 KB/s",
                    "download_eta": "--:--",
                    "error_message": error_message
                })
                return False
            
    except Exception as e:
        print(f"Unexpected error in download: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        
        update_progress(filename, {
            "download_status": "error",
            "download_progress": 0,
            "download_speed": "0 KB/s",
            "download_eta": "--:--",
            "error_message": f"下载失败: {str(e)}"
        })
        return False

@app.get("/")
def read_root():
    return {"message": "YouTube Downloader API"}

@app.post("/download")
async def download_video(video_url: VideoURL):
    try:
        # Extract video information first
        try:
            info, best_video = extract_video_info(video_url.url, video_url.format, video_url.quality)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        # Generate safe filename
        safe_title = get_safe_filename(info.get('title', 'video'))
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{safe_title}_{timestamp}.{video_url.format}"
        
        # 使用用户指定的保存路径或默认路径
        filepath = Path(video_url.save_path) / filename

        # Initialize progress tracker
        download_progress[filename] = {
            "download_progress": 0,
            "download_speed": "准备中...",
            "download_eta": "--:--",
            "download_status": "preparing",
            "save_path": str(filepath)  # 添加保存路径信息
        }

        # Prepare video information response
        video_info = {
            "title": info.get('title', 'Unknown Title'),
            "author": info.get('uploader', 'Unknown Author'),
            "length": info.get('duration', 0),
            "views": info.get('view_count', 0),
            "thumbnail_url": info.get('thumbnail', ''),
            "download_url": best_video.get('url', ''),
            "is_short": '/shorts/' in video_url.url,
            "resolution": f"{best_video.get('height', 'Unknown')}p",  # 修正分辨率显示
            "filesize": best_video.get('filesize', 0),
            "ext": video_url.format,
            "download_progress": 0,
            "download_speed": "准备中...",
            "download_eta": "--:--",
            "download_status": "preparing",
            "local_filename": filename,
            "save_path": str(filepath)
        }

        # Configure download options
        progress_tracker = DownloadProgress()
        progress_tracker.filename = filename

        # 设置下载格式规范
        target_height = int(video_url.quality[:-1]) if video_url.quality != 'best' else 0
        if video_url.format == 'mp3':
            format_spec = 'bestaudio[ext=mp3]/bestaudio'
        else:
            if video_url.quality == 'best':
                format_spec = f'best[ext={video_url.format}]/best'
            else:
                format_spec = f'bestvideo[height<={target_height}][ext={video_url.format}]+bestaudio[ext=m4a]/best[height<={target_height}][ext={video_url.format}]'

        # 设置后处理器
        postprocessors = []
        if video_url.format == 'mp3':
            postprocessors.append({
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192'
            })
        elif video_url.format in ['webm', '3gp']:
            postprocessors.append({
                'key': 'FFmpegVideoConvertor',
                'preferedformat': video_url.format
            })

        ydl_opts = {
            'format': format_spec,
            'progress_hooks': [progress_tracker],
            'quiet': True,
            'no_warnings': True,
            'outtmpl': str(filepath),
            'postprocessors': postprocessors,
        }

        print(f"Using format specification: {format_spec}")
        print(f"Selected video height: {best_video.get('height')}p")

        # Start download in background thread
        loop = asyncio.get_event_loop()
        loop.run_in_executor(
            thread_pool,
            download_in_background,
            video_url.url,
            ydl_opts,
            filename
        )

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

@app.get("/progress/{filename}")
async def get_progress(filename: str):
    if filename not in download_progress:
        raise HTTPException(status_code=404, detail="Download not found")
    return download_progress[filename]

@app.get("/select_directory")
async def select_directory():
    try:
        if os.name == 'nt':  # Windows
            # 使用 PowerShell 打开文件夹选择对话框
            command = '''
            Add-Type -AssemblyName System.Windows.Forms
            $folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
            $folderBrowser.Description = "选择保存目录"
            $folderBrowser.ShowNewFolderButton = $true
            if ($folderBrowser.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                $folderBrowser.SelectedPath
            }
            '''
            result = subprocess.run(["powershell", "-Command", command], capture_output=True, text=True)
            selected_path = result.stdout.strip()
            
            if selected_path:
                return {"path": selected_path}
            else:
                return {"path": ""}
        else:  # 其他系统使用 tkinter
            root = tk.Tk()
            root.withdraw()  # 隐藏主窗口
            directory = filedialog.askdirectory()
            root.destroy()
            return {"path": directory if directory else ""}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open directory picker: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 