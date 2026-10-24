import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateEventDto {
  @IsUUID()
  actionId: string;

  @IsString() @IsNotEmpty()
  eventType: string;

  /** Validated per eventType (see event-payload.validators.ts). */
  @IsObject()
  payload: Record<string, unknown>;
}

export class ListEventsQueryDto {
  @IsOptional() @IsUUID()
  actionId?: string;
}
