import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { extname } from "node:path";
import OpenAI, { toFile } from "openai";
import type { ImageEditParamsNonStreaming, ImageGenerateParamsNonStreaming } from "openai/resources/images";
import type { ImageGenerationRequest, ImageGenerationResult } from "../../../shared/types";
import type { ImageProvider } from "./ImageProvider";

const mimeTypes: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

export class OpenAIImageProvider implements ImageProvider {
  readonly model: string;
  private readonly client: OpenAI;

  constructor(apiKey: string, model: string) {
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured. Copy .env.example to .env and add your key.");
    this.model = model;
    this.client = new OpenAI({ apiKey });
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const common = {
      model: this.model,
      prompt: request.prompt,
      size: request.size ?? "auto",
      quality: request.quality ?? "auto",
      stream: false as const,
    };
    const response = request.referenceImages.length
      ? await this.client.images.edit({
          ...common,
          image: await Promise.all(request.referenceImages.map((path) => toFile(createReadStream(path), null, { type: mimeTypes[extname(path).toLowerCase()] }))),
        } satisfies ImageEditParamsNonStreaming)
      : await this.client.images.generate(common satisfies ImageGenerateParamsNonStreaming);
    const result = response.data?.[0];
    if (!result?.b64_json) throw new Error("OpenAI returned no image data.");
    await writeFile(request.outputPath, Buffer.from(result.b64_json, "base64"), { mode: 0o600 });
    return {
      id: response._request_id ?? `openai-${Date.now()}`,
      localPath: request.outputPath,
      createdAt: new Date().toISOString(),
      model: this.model,
    };
  }
}
