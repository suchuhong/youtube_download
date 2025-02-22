# YouTube Video Downloader

A web application built with Next.js and FastAPI that allows users to download YouTube videos.

## Features

- Simple and modern user interface
- Video information preview (thumbnail, title, author, duration, views)
- High-quality video downloads
- Error handling and loading states

## Prerequisites

- Python 3.8 or higher
- Node.js 14.0 or higher
- npm or yarn

## Setup

### Backend Setup

1. Create a virtual environment (optional but recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Run the FastAPI server:
```bash
cd backend
uvicorn main:app --reload
```

The backend will be running at http://localhost:8000

### Frontend Setup

1. Install Node.js dependencies:
```bash
cd frontend
npm install
# or
yarn install
```

2. Run the development server:
```bash
npm run dev
# or
yarn dev
```

The frontend will be running at http://localhost:3000

## Usage

1. Open your browser and navigate to http://localhost:3000
2. Paste a YouTube video URL into the input field
3. Click the "Download" button
4. Once the video information loads, click the "Download Video" button to start the download

## Tech Stack

- Frontend:
  - Next.js
  - TypeScript
  - Tailwind CSS
  - React Hooks
- Backend:
  - FastAPI
  - yt-dlp
  - pydantic

## Notes

- Make sure both the backend and frontend servers are running simultaneously
- The application requires an active internet connection
- Some videos might not be available for download due to YouTube's restrictions 