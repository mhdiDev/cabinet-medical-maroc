import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsOptional()
  @IsString()
  consultationId?: string;
}
