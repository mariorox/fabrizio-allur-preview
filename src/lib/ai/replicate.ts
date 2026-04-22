/**
 * Replicate AI Adapter
 * Uses the IDM-VTON model on Replicate for virtual try-on.
 * Model: cuuupid/idm-vton
 *
 * Setup:
 *   AI_PROVIDER=replicate
 *   AI_API_KEY=r8_xxxxxxxxxxxxxxxxxxxx
 */
import fs from 'fs';
import https from 'https';
import type { AIAdapter, TryOnParams, TryOnResult } from './adapter';

const MODEL_VERSION = 'cuuupid/idm-vton:c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4';

export class ReplicateAdapter implements AIAdapter {
  constructor(private apiKey: string) {}

  async generateTryOn(params: TryOnParams): Promise<TryOnResult> {
    const { clientPhotoPath, fabricTexturePath, garmentType, outputPath } = params;

    // Convert images to base64 data URIs
    const personBase64 = fs.readFileSync(clientPhotoPath).toString('base64');
    const garmentBase64 = fs.readFileSync(fabricTexturePath).toString('base64');
    const personDataUri = `data:image/jpeg;base64,${personBase64}`;
    const garmentDataUri = `data:image/jpeg;base64,${garmentBase64}`;

    const garmentDesc = `${garmentType} suit fabric texture`;

    // Start prediction
    const prediction = await this.createPrediction({
      human_img: personDataUri,
      garm_img: garmentDataUri,
      garment_des: garmentDesc,
      is_checked: true,
      is_checked_crop: false,
      denoise_steps: 30,
      seed: 42,
    });

    // Poll until done
    const result = await this.pollPrediction((prediction as Record<string, unknown>).id as string);

    // Download result image
    const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    const imageBuffer = await this.downloadImage(imageUrl);
    fs.writeFileSync(outputPath, imageBuffer);

    return { resultImagePath: outputPath };
  }

  private async createPrediction(input: Record<string, unknown>) {
    const body = JSON.stringify({ version: MODEL_VERSION, input });
    return this.request('POST', '/v1/predictions', body);
  }

  private async pollPrediction(id: string, maxWait = 120000): Promise<Record<string, unknown>> {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      await new Promise((r) => setTimeout(r, 2000));
      const result = await this.request('GET', `/v1/predictions/${id}`);
      const status = result.status as string;
      if (status === 'succeeded') return result;
      if (status === 'failed' || status === 'canceled') {
        throw new Error(`Replicate prediction ${status}: ${result.error}`);
      }
    }
    throw new Error('Replicate prediction timed out');
  }

  private request(method: string, path: string, body?: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.replicate.com',
        path,
        method,
        headers: {
          Authorization: `Token ${this.apiKey}`,
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
