'use client';

import { useEffect } from 'react';
import swaggerConfig from '../../../swagger.config';

interface SwaggerUIBundle {
  (config: {
    spec: typeof swaggerConfig;
    dom_id: string;
    deepLinking: boolean;
    presets: any[];
  }): void;
  presets: {
    apis: any[];
  };
  SwaggerUIStandalonePreset: any[];
}

declare global {
  interface Window {
    SwaggerUIBundle: SwaggerUIBundle;
    ui?: any;
  }
}

export default function ApiDocs() {
  useEffect(() => {
    // Load Swagger UI script and styles
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js';
    script.async = true;
    
    const style = document.createElement('link');
    style.href = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css';
    style.rel = 'stylesheet';
    
    document.head.appendChild(script);
    document.head.appendChild(style);
    
    script.onload = () => {
      window.ui = window.SwaggerUIBundle({
        spec: swaggerConfig,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          window.SwaggerUIBundle.presets.apis,
          window.SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
      });
    };
    
    return () => {
      document.head.removeChild(script);
      document.head.removeChild(style);
    };
  }, []);
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">API Documentation</h1>
      <div className="bg-white rounded-lg shadow">
        <div id="swagger-ui" />
      </div>
    </div>
  );
} 