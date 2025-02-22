'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import DownloadProgress from './components/DownloadProgress'; // Import the new component

interface VideoInfo {
  title: string;
  author: string;
  length: number;
  views: number;
  thumbnail_url: string;
  download_url: string;
  is_short: boolean;
  resolution: string;
  filesize: number;
  ext: string;
  download_progress: number;
  download_speed: string;
  download_eta: string;
  download_status: string;
  local_filename: string;
  save_path: string;  // 添加保存路径字段
}

interface FormatOptions {
  formats: string[];
  qualities: string[];
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('1080p');
  const [savePath, setSavePath] = useState('');
  const [pathError, setPathError] = useState('');  // 添加路径错误状态
  const [formatOptions, setFormatOptions] = useState<FormatOptions>({
    formats: [],
    qualities: []
  });

  // 从本地存储加载上次使用的路径
  useEffect(() => {
    const lastPath = localStorage.getItem('lastSavePath');
    if (lastPath) {
      setSavePath(lastPath);
    }
  }, []);

  // 保存路径到本地存储
  const updateSavePath = (path: string) => {
    setSavePath(path);
    localStorage.setItem('lastSavePath', path);
  };

  // 验证路径
  const validatePath = (path: string): boolean => {
    if (!path) return true; // 空路径允许，将使用默认路径
    
    try {
      // Windows路径基本验证
      const invalidChars = /[<>"|?*\x00-\x1F]/g;
      if (invalidChars.test(path)) {
        setPathError('路径包含无效字符 (<>"|?*)');
        return false;
      }

      // Windows完整路径格式验证
      const windowsPathRegex = /^([a-zA-Z]:[\\\/]|\\\\[^\\\/]+[\\\/][^\\\/]+[\\\/])(?:[^<>:"|?*\x00-\x1F]*[\\\/]?)*$/;
      if (!windowsPathRegex.test(path)) {
        setPathError('无效的Windows路径格式 (例如: C:\\Downloads 或 C:/Downloads)');
        return false;
      }

      setPathError('');
      return true;
    } catch {
      setPathError('路径验证错误');
      return false;
    }
  };

  // 处理选择文件夹
  const handleSelectDirectory = async () => {
    try {
      const response = await fetch('/api/select_directory');
      const data = await response.json();
      
      if (data.error) {
        setPathError(data.error);
        return;
      }
      
      if (data.path) {
        // 标准化路径分隔符
        const normalizedPath = data.path.replace(/\//g, '\\');
        updateSavePath(normalizedPath);
        validatePath(normalizedPath);
      }
    } catch {
      setPathError('选择文件夹失败');
    }
  };

  // Add polling mechanism for download progress
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (videoInfo?.download_status === 'downloading' || videoInfo?.download_status === 'preparing' || videoInfo?.download_status === 'processing') {
      intervalId = setInterval(async () => {
        try {
          const encodedFilename = encodeURIComponent(videoInfo.local_filename);
          const response = await fetch(`/api/progress/${encodedFilename}`);
          const data = await response.json();
          
          if (response.ok) {
            setVideoInfo(prev => prev ? { ...prev, ...data } : null);
            
            // Clear interval if download is complete, failed, or completed processing
            if (data.download_status === 'completed' || data.download_status === 'error') {
              clearInterval(intervalId);
            }
          }
        } catch (error) {
          console.error('Error fetching progress:', error);
        }
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [videoInfo?.download_status, videoInfo?.local_filename]);

  useEffect(() => {
    // Fetch available formats when component mounts
    fetch('/api/formats')
      .then(res => res.json())
      .then(data => setFormatOptions(data))
      .catch(err => console.error('Error fetching formats:', err));
  }, []);

  const validateYouTubeUrl = (url: string) => {
    const patterns = [
      /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/(?:www\.)?youtube\.com\/v\/[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(?:www\.)?youtube\.com\/embed\/[\w-]+/,
      /^https?:\/\/(?:www\.)?youtube\.com\/shorts\/[\w-]+/
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setVideoInfo(null);

    // 验证输入
    if (!url.trim()) {
      setError('请输入YouTube视频链接');
      setLoading(false);
      return;
    }

    if (!validateYouTubeUrl(url)) {
      setError('请输入有效的YouTube视频链接');
      setLoading(false);
      return;
    }

    // 验证保存路径
    if (!validatePath(savePath)) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: url.trim(),
          format,
          quality,
          save_path: savePath.trim()
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || '无法获取视频信息');
      }

      setVideoInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生错误');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatViews = (views: number) => {
    return new Intl.NumberFormat('en-US').format(views);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <main className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          YouTube视频下载器
        </h1>
        
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="输入YouTube视频链接 (例如: https://www.youtube.com/watch?v=... 或 shorts/...)"
              className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <div className="flex flex-col sm:flex-row gap-4">
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="flex-1 p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {formatOptions.formats.map(fmt => (
                  <option key={fmt} value={fmt}>
                    {fmt.toUpperCase()}
                  </option>
                ))}
              </select>

              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="flex-1 p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {formatOptions.qualities.map(q => (
                  <option key={q} value={q}>
                    {q.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* 改进的保存路径输入区域 */}
            <div className="flex flex-col gap-2">
              <label htmlFor="savePath" className="text-sm text-gray-600">
                保存路径 (可选，默认保存在&ldquo;下载/YouTube Downloads&rdquo;文件夹)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="savePath"
                  value={savePath}
                  onChange={(e) => {
                    const path = e.target.value;
                    updateSavePath(path);
                    validatePath(path);
                  }}
                  placeholder="例如: C:\Users\YourName\Downloads\YouTube Downloads"
                  className={`flex-1 p-3 rounded-lg border ${
                    pathError ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                  } focus:outline-none focus:ring-2`}
                />
                <button
                  type="button"
                  onClick={handleSelectDirectory}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                >
                  选择文件夹
                </button>
              </div>
              {pathError && (
                <p className="text-sm text-red-600 mt-1">{pathError}</p>
              )}
              {savePath && !pathError && (
                <p className="text-sm text-green-600 mt-1">
                  ✓ 有效的保存路径
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !!pathError}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
            >
              {loading ? '加载中...' : '下载'}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-4 mb-6 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {videoInfo && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="relative w-full md:w-64 h-48 md:h-36">
                <Image
                  src={videoInfo.thumbnail_url}
                  alt={videoInfo.title}
                  fill
                  className="rounded-lg object-cover"
                  unoptimized
                  priority
                />
                {videoInfo.is_short && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-md text-sm font-medium">
                    Short
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-2">{videoInfo.title}</h2>
                <p className="text-gray-600 mb-2">作者: {videoInfo.author}</p>
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span>时长: {formatDuration(videoInfo.length)}</span>
                  <span>观看次数: {formatViews(videoInfo.views)}</span>
                  <span>质量: {videoInfo.resolution}</span>
                  <span>大小: {formatFileSize(videoInfo.filesize)}</span>
                  <span>格式: {videoInfo.ext.toUpperCase()}</span>
                </div>
                {/* 显示保存路径 */}
                <div className="mt-2 text-sm text-gray-600">
                  保存位置: {videoInfo.save_path}
                </div>
                {videoInfo.download_status && (
                  <DownloadProgress
                    progress={videoInfo.download_progress || 0}
                    speed={videoInfo.download_speed || '0 KB/s'}
                    eta={videoInfo.download_eta || 'calculating...'}
                    status={videoInfo.download_status}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
