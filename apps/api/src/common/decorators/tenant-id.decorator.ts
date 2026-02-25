import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Extracts tenantId from the JWT payload (set by JwtStrategy) */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId as string;
  },
);
