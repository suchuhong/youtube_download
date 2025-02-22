// frontend/src/app/components/DownloadProgress.tsx

import React from 'react';

interface DownloadProgressProps {
  progress: number;
  speed: string;
  eta: string;
  status: string;
}

const getStatusText = (status: string): string => {
  switch (status) {
    case 'preparing':
      return '准备中';
    case 'downloading':
      return '下载中';
    case 'processing':
      return '处理中';
    case 'completed':
      return '已完成';
    case 'error':
      return '出错';
    default:
      return status;
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'preparing':
      return 'bg-yellow-500';
    case 'downloading':
      return 'bg-blue-500';
    case 'processing':
      return 'bg-purple-500';
    case 'completed':
      return 'bg-green-500';
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const DownloadProgress: React.FC<DownloadProgressProps> = ({ progress, speed, eta, status }) => {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 text-white text-sm rounded ${getStatusColor(status)}`}>
            {getStatusText(status)}
          </span>
          <span className="text-sm text-gray-600">
            {status === 'downloading' && `${speed} • 剩余时间: ${eta}`}
            {status === 'completed' && '下载完成'}
            {status === 'error' && '下载失败'}
          </span>
        </div>
        <span className="text-sm font-medium">{progress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${getStatusColor(status)}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default DownloadProgress;