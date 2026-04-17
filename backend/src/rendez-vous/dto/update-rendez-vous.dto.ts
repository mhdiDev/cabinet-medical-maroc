import { PartialType } from '@nestjs/swagger';
import { CreateRendezVousDto } from './create-rendez-vous.dto';

export class UpdateRendezVousDto extends PartialType(CreateRendezVousDto) {}
