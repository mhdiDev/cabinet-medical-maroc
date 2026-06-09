import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private service: DocumentsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Uploader un document (image ou PDF)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        patientId: { type: 'string' },
        consultationId: { type: 'string' },
      },
      required: ['file', 'patientId'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { patientId: string; consultationId?: string },
  ) {
    if (!file) throw new BadRequestException('Aucun fichier reçu');
    if (!body.patientId) throw new BadRequestException('patientId requis');
    return this.service.upload(file, body.patientId, body.consultationId);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Documents d\'un patient' })
  findByPatient(@Param('patientId') patientId: string) {
    return this.service.findByPatient(patientId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un document' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
