/**
 * HuggingFace Gradio Adapter — IDM-VTON (gratuito)
 *
 * Usa o espaço público IDM-VTON no HuggingFace Spaces via Gradio API 4.x.
 * Sem custo, mas pode ser lento nas horas de pico (fila pública).
 *
 * Setup:
 *   AI_PROVIDER=huggingface
 *   AI_API_KEY=hf_xxxxxxxxxxxx   ← token HuggingFace (conta gratuita em hf.co)
 *                                   Opcional: sem token usa a fila pública (mais lento)
 *
 * Modelo: https://huggingface.co/spaces/yisol/IDM-VTON
 */
import fs from 'fs';
import https from 'https';
import http from 'http';
import FormData from 'form-data';
import type { AIAdapter, TryOnParams, TryOnResult } from './adapter';
import type { GarmentType } from '@/types';

const SPACE_HOST = 'yisol-idm-vton.hf.space';

const GARMENT_DESC: Record<GarmentType, string> = {
  terno:  'a full suit with matching jacket and trousers',
  blazer: 'a blazer jacket',
  camisa: 'a dress shirt',
  polo:   'a polo shirt',
  calca:  'dress trousers',
};

export class HuggingFaceAdapter implements AIAdapter {
  constructor(private apiToken?: string) {}

  async generateTryOn(params: TryOnParams): Promise<TryOnResult> {
    const { clientPhotoPath, fabricTexturePath, garmentType, outputPath } = params;

    console.log('[HF] Iniciando geração —', garmentType);

    // ── Step 1: Upload both images ──
    console.log('[HF] Step 1: upload das imagens...');
    const [personRef, garmentRef] = await Promise.all([
      this.uploadFile(clientPhotoPath, 'person.jpg'),
      this.uploadFile(fabricTexturePath, 'garment.jpg'),
    ]);
    console.log('[HF] Upload OK — person:', personRef.path, '| garment:', garmentRef.path);

    // ── Step 2: Submit prediction ──
    console.log('[HF] Step 2: submetendo predição...');
    const eventId = await this.submitPrediction(personRef, garmentRef, garmentType);
    console.log('[HF] Predição submetida — event_id:', eventId);

    // ── Step 3: Poll SSE stream for result ──
    console.log('[HF] Step 3: aguardando resultado via SSE...');
    const resultUrl = await this.pollResult(eventId);

    // ── Step 4: Download result image ──
    const imageBuffer = await this.downloadUrl(resultUrl);
    fs.writeFileSync(outputPath, imageBuffer);

    return { resultImagePath: outputPath };
  }

  private uploadFile(filePath: string, filename: string): Promise<GradioFile> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('files', fs.createReadStream(filePath), { filename });

      const options: https.RequestOptions = {
        hostname: SPACE_HOST,
        path: '/upload',
        method: 'POST',
        headers: {
          ...form.getHeaders(),
          ...(this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {}),
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const files: GradioFile[] = JSON.parse(body);
            if (!files?.[0]) throw new Error(`Upload retornou vazio: ${body.slice(0, 200)}`);
            resolve(files[0]);
          } catch {
            reject(new Error(`Upload parse error: ${body.slice(0, 200)}`));
          }
        });
      });
      req.setTimeout(90_000, () => {
        req.destroy(new Error('Timeout no upload para HuggingFace (90s). O Space pode estar dormindo.'));
      });
      req.on('error', reject);
      form.pipe(req);
    });
  }

  private submitPrediction(
    person: GradioFile,
    garment: GradioFile,
    garmentType: GarmentType
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // human_img is an ImageEditor component — must be wrapped as EditorData
      const humanEditorData = {
        background: person,
        layers: [],
        composite: null,
      };

      const body = JSON.stringify({
        data: [
          humanEditorData,              // human_img (ImageEditor → EditorData)
          garment,                      // garm_img
          GARMENT_DESC[garmentType],    // garment_des
          true,                         // is_checked (auto-mask)
          false,                        // is_checked_crop
          30,                           // denoise_steps
          42,                           // seed
        ],
      });

      const options: https.RequestOptions = {
        hostname: SPACE_HOST,
        path: '/call/tryon',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...(this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {}),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (!parsed.event_id) throw new Error(`No event_id in response: ${data.slice(0, 200)}`);
            resolve(parsed.event_id as string);
          } catch (e) {
            reject(e);
          }
        });
      });
      req.setTimeout(30_000, () => {
        req.destroy(new Error('Timeout ao submeter para HuggingFace (30s).'));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private pollResult(eventId: string, maxWait = 300_000): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (fn: () => void) => { if (!settled) { settled = true; fn(); } };

      // Hard timeout — garante que a Promise sempre resolve/rejeita
      const timer = setTimeout(() => {
        req.destroy();
        done(() => reject(new Error('HuggingFace timeout após 5 minutos. Tente novamente.')));
      }, maxWait);

      const options: https.RequestOptions = {
        hostname: SPACE_HOST,
        path: `/call/tryon/${eventId}`,
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          ...(this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {}),
        },
      };

      const req = https.request(options, (res) => {
        let buffer = '';
        const receivedEvents: string[] = [];
        const statusCode = res.statusCode ?? 0;

        // Se o servidor retornou erro HTTP, captura o corpo para diagnóstico
        if (statusCode < 200 || statusCode >= 300) {
          let errBody = '';
          res.on('data', (c: Buffer) => (errBody += c.toString()));
          res.on('end', () => {
            clearTimeout(timer);
            done(() => reject(new Error(`HuggingFace SSE HTTP ${statusCode}: ${errBody.slice(0, 300)}`)));
          });
          return;
        }

        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (!raw) continue;

            receivedEvents.push(raw.slice(0, 150));

            try {
              const event = JSON.parse(raw) as SSEEvent;

              if (event.msg === 'process_completed') {
                const ev = event as SSEEvent & { success?: boolean };
                if (ev.success === false) {
                  clearTimeout(timer);
                  req.destroy();
                  const errMsg = (ev as {error?: string}).error ?? 'Erro no processamento';
                  done(() => reject(new Error(`HuggingFace erro: ${errMsg}`)));
                  return;
                }
                clearTimeout(timer);
                req.destroy();
                const outputData = event.output?.data;
                if (!Array.isArray(outputData) || !outputData[0]) {
                  done(() => reject(new Error('Sem dados na resposta do HuggingFace')));
                  return;
                }
                const img = outputData[0] as GradioFile;
                const url = img.url ?? (img.path ? `https://${SPACE_HOST}/file=${img.path}` : null);
                if (!url) {
                  done(() => reject(new Error('Sem URL na imagem resultado')));
                  return;
                }
                done(() => resolve(url.startsWith('http') ? url : `https://${SPACE_HOST}${url}`));
              } else if (event.msg === 'queue_full') {
                clearTimeout(timer);
                req.destroy();
                done(() => reject(new Error('Fila do HuggingFace cheia. Tente em alguns minutos.')));
              }
            } catch {
              // ignora linhas SSE não-JSON (heartbeats, etc.)
            }
          }
        });

        res.on('error', (e) => { clearTimeout(timer); done(() => reject(e)); });
        res.on('end', () => {
          clearTimeout(timer);
          const eventsLog = receivedEvents.length
            ? `Eventos recebidos: ${receivedEvents.join(' | ')}`
            : 'Nenhum evento recebido';
          done(() => reject(new Error(`SSE encerrou sem resultado. ${eventsLog}`)));
        });
      });

      req.on('error', (e) => { clearTimeout(timer); done(() => reject(e)); });
      req.end();
    });
  }

  private downloadUrl(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    });
  }
}

interface GradioFile {
  path?: string;
  url?: string;
  orig_name?: string;
  size?: number;
  mime_type?: string;
  is_stream?: boolean;
  meta?: { _type: string };
}

interface SSEEvent {
  msg: string;
  output?: { data: unknown[] };
  error?: string;
}
