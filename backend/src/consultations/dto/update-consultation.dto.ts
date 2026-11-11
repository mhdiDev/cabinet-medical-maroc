import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateConsultationDto } from './create-consultation.dto';

export class UpdateConsultationDto extends PartialType(
  OmitType(CreateConsultationDto, ['constantesId'] as const),
) {}
