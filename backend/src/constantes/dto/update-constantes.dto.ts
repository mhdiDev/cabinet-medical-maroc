import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateConstantesDto } from './create-constantes.dto';

// Le patient et la consultation d'une prise ne changent pas ; une valeur à null vide le champ
export class UpdateConstantesDto extends PartialType(
  OmitType(CreateConstantesDto, ['patientId', 'consultationId'] as const),
) {}
