// frontend/src/app/components/DownloadProgress.tsx

import React from 'react';

interface DownloadProgressProps {
  progress: number;
  speed: string;
  eta: string;
  status: string;
}

const DownloadProgress: React.FC<DownloadProgressProps> = ({ progress, speed, eta, status }) => {
  return (
    <div className="mt-4">
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="flex justify-between mt-2 text-sm text-gray-600">
        <span>{progress.toFixed(1)}%</span>
        <span>{speed}</span>
        <span>ETA: {eta}</span>
      </div>
      <div className="text-gray-600 mt-1">{status}</div>
    </div>
  );
};

export default DownloadProgress;