const swaggerConfig = {
  openapi: '3.0.0',
  info: {
    title: 'YouTube Downloader API',
    version: '1.0.0',
    description: 'API documentation for YouTube Downloader application',
  },
  servers: [
    {
      url: 'http://localhost:3000/api',
      description: 'Development server',
    },
  ],
  paths: {
    '/download': {
      post: {
        summary: 'Download a YouTube video',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  url: {
                    type: 'string',
                    description: 'YouTube video URL',
                    example: 'https://www.youtube.com/watch?v=example',
                  },
                  format: {
                    type: 'string',
                    description: 'Video format',
                    enum: ['mp4', 'webm', 'mp3', '3gp'],
                    default: 'mp4',
                  },
                  quality: {
                    type: 'string',
                    description: 'Video quality',
                    enum: ['360p', '480p', '720p', '1080p', 'best'],
                    default: '1080p',
                  },
                },
                required: ['url'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Video information and download details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    author: { type: 'string' },
                    length: { type: 'number' },
                    views: { type: 'number' },
                    thumbnail_url: { type: 'string' },
                    download_url: { type: 'string' },
                    is_short: { type: 'boolean' },
                    resolution: { type: 'string' },
                    filesize: { type: 'number' },
                    ext: { type: 'string' },
                    download_progress: { type: 'number' },
                    download_speed: { type: 'string' },
                    download_eta: { type: 'string' },
                    download_status: { type: 'string' },
                    local_filename: { type: 'string' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Invalid request or download error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    detail: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/progress/{filename}': {
      get: {
        summary: 'Get download progress',
        parameters: [
          {
            name: 'filename',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'The filename of the downloading video',
          },
        ],
        responses: {
          200: {
            description: 'Download progress information',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    download_progress: { type: 'number' },
                    download_speed: { type: 'string' },
                    download_eta: { type: 'string' },
                    download_status: { type: 'string' },
                  },
                },
              },
            },
          },
          404: {
            description: 'Download not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    detail: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/formats': {
      get: {
        summary: 'Get available formats and qualities',
        responses: {
          200: {
            description: 'List of available formats and qualities',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    formats: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    qualities: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export default swaggerConfig; 