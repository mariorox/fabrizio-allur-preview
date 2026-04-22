import type { GarmentType } from '@/types';

export interface TryOnParams {
  clientPhotoPath: string;    // absolute filesystem path
  fabricTexturePath: string;  // absolute filesystem path
  garmentType: GarmentType;
  outputPath: string;         // absolute filesystem path where result should be saved
  fabricName?: string;        // nome do tecido — usado para montar o prompt da IA
}

export interface TryOnResult {
  resultImagePath: string;    // absolute filesystem path
}

export interface AIAdapter {
  generateTryOn(params: TryOnParams): Promise<TryOnResult>;
}

export function getAIAdapter(): AIAdapter {
  const provider = process.env.AI_PROVIDER ?? 'mock';

  switch (provider) {
    case 'replicate': {
      const { ReplicateAdapter } = require('./replicate');
      return new ReplicateAdapter(process.env.AI_API_KEY ?? '');
    }
    case 'fashn': {
      const { FashnAdapter } = require('./fashn');
      return new FashnAdapter(process.env.AI_API_KEY ?? '');
    }
    case 'huggingface': {
      const { HuggingFaceAdapter } = require('./huggingface');
      return new HuggingFaceAdapter(process.env.AI_API_KEY || undefined);
    }
    case 'gemini': {
      const { GeminiAdapter } = require('./gemini');
      return new GeminiAdapter(process.env.AI_API_KEY ?? '');
    }
    case 'mock':
    default: {
      const { MockAdapter } = require('./mock');
      return new MockAdapter();
    }
  }
}
