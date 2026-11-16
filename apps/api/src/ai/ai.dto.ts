import { AiTaskType, AiTone, ImageAspectRatio } from '@lemon/ai-neurons';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const ASPECT_RATIOS: ImageAspectRatio[] = ['16:9', '1:1', '9:16', '4:3', '3:4'];
const AI_TONES: AiTone[] = ['professional', 'creative', 'concise', 'academic'];
const AI_TASK_TYPES: AiTaskType[] = [
  'TEXT_GENERATE',
  'NOTE_GENERATE',
  'QUICK_ADD_PARSE',
  'PROMPT_SYNTHESIS',
  'IMAGE_GENERATE',
  'IMAGE_REMIX',
  'VISION_ANALYZE',
  'AUDIO_TRANSCRIBE',
];

export class SetAiApiKeyDto {
  @IsString()
  @IsNotEmpty()
  apiKey: string;
}

export class GenerateTextDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsOptional()
  @IsString()
  systemInstruction?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsString()
  combinatorFlowId?: string;
}

export class GenerateNoteDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(AI_TONES)
  tone?: AiTone;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  dateStr?: string;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsString()
  noteType?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsString()
  combinatorFlowId?: string;
}

export class ParseQuickAddDto {
  @IsString()
  @IsNotEmpty()
  rawText: string;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsString()
  combinatorFlowId?: string;
}

export class GenerateImagesDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsOptional()
  @IsString()
  style?: string;

  @IsOptional()
  @IsIn(ASPECT_RATIOS)
  aspectRatio?: ImageAspectRatio;

  @IsOptional()
  @IsString()
  folderPath?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  count?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsString()
  combinatorFlowId?: string;
}

export class RemixImageDto {
  @IsString()
  @IsNotEmpty()
  sourceAssetId: string;

  @IsString()
  @IsNotEmpty()
  instruction: string;

  @IsOptional()
  @IsString()
  style?: string;

  @IsOptional()
  @IsIn(ASPECT_RATIOS)
  aspectRatio?: ImageAspectRatio;

  @IsOptional()
  @IsString()
  folderPath?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  count?: number;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsString()
  combinatorFlowId?: string;
}

export class AnalyzeImageDto {
  @IsString()
  @IsNotEmpty()
  sourceAssetId: string;

  @IsOptional()
  @IsString()
  instruction?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsString()
  combinatorFlowId?: string;
}

export class CreateAiClientDto {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsArray()
  @IsIn(AI_TASK_TYPES, { each: true })
  allowedTasks?: AiTaskType[];

  @IsOptional()
  @IsInt()
  @Min(1)
  dailyLimit?: number;
}
