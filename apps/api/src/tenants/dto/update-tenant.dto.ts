import { IsString, MinLength, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Acme Corp Updated' })
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;
}
