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

/** Uma peça a aplicar: textura + tipo de roupa. */
export interface TryOnGarment {
  fabricTexturePath: string;
  garmentType: GarmentType;
  fabricName?: string;
}

/**
 * Aplica VÁRIAS peças numa ÚNICA passada, sempre a partir da foto base
 * (a foto original/pristina). Evita a degradação de "cópia de cópia" e o
 * desvio de enquadramento que ocorrem ao reeditar imagens já geradas.
 */
export interface MultiTryOnParams {
  clientPhotoPath: string;    // foto base (original) — absoluto
  garments: TryOnGarment[];   // todas aplicadas de uma vez sobre a base
  outputPath: string;         // onde salvar — absoluto
}

export interface AIAdapter {
  generateTryOn(params: TryOnParams): Promise<TryOnResult>;
  /** Opcional — se ausente, a orquestração encadeia generateTryOn (degrada). */
  generateMultiTryOn?(params: MultiTryOnParams): Promise<TryOnResult>;
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
