import { createOpenAI } from '@ai-sdk/openai';

// Centralized AI provider configuration for OpenRouter
export const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
  headers: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'UniHub Workshop System',
  },
});

// Default model to use throughout the application
// Using Gemini 2.0 Flash via OpenRouter for high speed and good quality
export const aiModel = openrouter('nvidia/nemotron-3-super-120b-a12b:free');
