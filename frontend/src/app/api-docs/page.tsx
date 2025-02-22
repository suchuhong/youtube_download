'use client';

import { useEffect } from 'react';
import swaggerConfig from '../../../swagger.config';

// Define proper types for Swagger UI
type SwaggerUIPreset = {
  apis: unknown[];
  SwaggerUIStandalonePreset: unknown[];
};

interface SwaggerUIConfig {
  spec: typeof swaggerConfig;
  dom_id: string;
  deepLinking: boolean;
  presets: unknown[];
  layout?: string;
  supportedSubmitMethods?: string[];
}

interface SwaggerUIBundle {
  (config: SwaggerUIConfig): void;
  presets: SwaggerUIPreset;
}

declare global {
  interface Window {
    SwaggerUIBundle: SwaggerUIBundle;
    ui?: unknown;
  }
}

export default function ApiDocs() {
  useEffect(() => {
    const loadSwaggerUI = async () => {
      // Load Swagger UI script
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js';
      script.async = true;
      
      // Load Swagger UI styles
      const style = document.createElement('link');
      style.href = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css';
      style.rel = 'stylesheet';
      
      // Append elements to head
      document.head.appendChild(style);
      document.head.appendChild(script);
      
      // Initialize Swagger UI when script is loaded
      script.onload = () => {
        const uiConfig: SwaggerUIConfig = {
          spec: swaggerConfig,
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            window.SwaggerUIBundle.presets.apis,
            window.SwaggerUIBundle.presets.SwaggerUIStandalonePreset
          ],
          layout: 'BaseLayout',
          supportedSubmitMethods: ['get', 'post'],
        };
        
        // Use Object.assign instead of util._extend
        window.ui = window.SwaggerUIBundle(Object.assign({}, uiConfig));
      };
      
      return () => {
        document.head.removeChild(script);
        document.head.removeChild(style);
      };
    };
    
    loadSwaggerUI();
  }, []);
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">API 文档</h1>
      <div className="bg-white rounded-lg shadow">
        <div id="swagger-ui" />
      </div>
    </div>
  );
} 