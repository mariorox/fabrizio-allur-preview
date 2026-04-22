/**
 * Fashn.ai Adapter
 * Specialized virtual try-on API for fashion.
 *
 * Setup:
 *   AI_PROVIDER=fashn
 *   AI_API_KEY=fa-xxxxxxxxxxxxxxxxxxxx
 */
import fs from 'fs';
import https from 'https';
import type { AIAdapter, TryOnParams, TryOnResult } from './adapter';
import type { GarmentType } from '@/types';

const FASHN_CATEGORY: Record<GarmentType, string> = {
  terno: 'tops',
  blazer: 'tops',
  camisa: 'tops',
  polo: 'tops',
  calca: 'bottoms',
};

export class FashnAdapter implements AIAdapter {
  constructor(private apiKey: string) {}

  async generateTryOn(params: TryOnParams): Promise<TryOnResult> {
    const { clientPhotoPath, fabricTexturePath, garmentType, outputPath } = params;

    const personBase64 = fs.readFileSync(clientPhotoPath).toString('base64');
    const garmentBase64 = fs.readFileSync(fabricTexturePath).toString('base64');

    const body = JSON.stringify({
      model_image: `data:image/jpeg;base64,${personBase64}`,
      garment_image: `data:image/jpeg;base64,${garmentBase64}`,
      category: FASHN_CATEGORY[garmentType],
    });

    const startResp = await this.request('POST', '/v1/run', body);
    const predictionId = (startResp as Record<string, unknown>).id as string;

    // Poll status
    const result = await this.pollStatus(predictionId);
    const output = (result as Record<string, unknown>).output as string;

    const imageBuffer = await this.downloadImage(output);
    fs.writeFileSync(outputPath, imageBuffer);

    return { resultImagePath: outputPath };
  }

  private async pollStatus(id: string, maxWait = 120000): Promise<unknown> {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      await new Promise((r) => setTimeout(r, 2000));
      const result = await this.request('GET', `/v1/status/${id}`);
      const status = (result as Record<string, unknown>).status as string;
      if (status === 'completed') return result;
      if (status === 'failed') {
        throw new Error(`Fashn.ai failed: ${JSON.stringify(result)}`);
      }
    }
    throw new Error('Fashn.ai timed out');
  }

  private request(method: string, path: string, body?: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.fashn.ai',
        path,
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { reject(new Error(`Invalid JSON: ${data}`)); }
        });
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  private downloadImage(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    });
  }
}
