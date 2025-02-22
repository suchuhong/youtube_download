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
  const [formatOptions, setFormatOptions] = useState<FormatOptions>({
    formats: [],
    qualities: []
  });

  // Add polling mechanism for download progress
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (videoInfo?.download_status === 'downloading' || videoInfo?.download_status === 'preparing') {
      intervalId = setInterval(async () => {
        try {
          const response = await fetch(`/api/progress?filename=${encodeURIComponent(videoInfo.local_filename)}`);
          const data = await response.json();
          
          if (response.ok) {
            setVideoInfo(prev => prev ? { ...prev, ...data } : null);
            
            // Clear interval if download is complete or failed
            if (data.download_status !== 'downloading' && data.download_status !== 'preparing') {
              clearInterval(intervalId);
            }
          }
        } catch (error) {
          console.error('Error fetching progress:', error);
        }
      }, 10000); // Poll every second
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

    // Client-side validation
    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      setLoading(false);
      return;
    }

    if (!validateYouTubeUrl(url)) {
      setError('Please enter a valid YouTube URL');
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
          quality
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to fetch video information');
      }

      setVideoInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
          YouTube Video Downloader
        </h1>
        
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter YouTube URL (e.g., https://www.youtube.com/watch?v=... or shorts/...)"
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

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 whitespace-nowrap"
              >
                {loading ? 'Loading...' : 'Download'}
              </button>
            </div>
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
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-semibold">{videoInfo.title}</h2>
                  {videoInfo.is_short && (
                    <span className="bg-red-100 text-red-600 px-2 py-1 rounded-md text-sm font-medium">
                      Short
                    </span>
                  )}
                </div>
                <p className="text-gray-600 mb-2">By {videoInfo.author}</p>
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span>Duration: {formatDuration(videoInfo.length)}</span>
                  <span>Views: {formatViews(videoInfo.views)}</span>
                  <span>Quality: {videoInfo.resolution}</span>
                  <span>Size: {formatFileSize(videoInfo.filesize)}</span>
                  <span>Format: {videoInfo.ext.toUpperCase()}</span>
                </div>
                {videoInfo.download_status && (
                  <DownloadProgress
                    progress={videoInfo.download_progress || 0}
                    speed={videoInfo.download_speed || '0 KB/s'}
                    eta={videoInfo.download_eta || 'calculating...'}
                    status={videoInfo.download_status}
                  />
                )}
                <div className="mt-4 flex gap-4">
                  <a
                    href={videoInfo.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Download Video
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(videoInfo.download_url);
                    }}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Copy URL
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
