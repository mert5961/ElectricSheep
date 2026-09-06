import type { ImageGenerationRequest, ImageGenerationResult } from "../../../shared/types";

export interface ImageProvider {
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
  readonly model: string;
}
