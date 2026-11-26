import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { REQUIRE_FORMAL_ACTOR_IDENTITY_KEY } from '../../common/decorators/require-formal-actor-identity.decorator';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { User } from '../users/entities/user.entity';

const FORMAL_ACTOR_SECRET_EXAMPLE =
  'replace-with-a-random-secret-of-at-least-32-characters';

@Injectable()
export class CurrentUserGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      socket?: { remoteAddress?: string | null };
      currentUser?: CurrentUser;
    }>();

    const resolvedIdentity = this.resolveIdentity(request.headers, request.socket?.remoteAddress);
    const user = await this.userRepository.findOne({
      where:
        resolvedIdentity.kind === 'trusted_proxy'
          ? { username: resolvedIdentity.username, status: 1 }
          : { id: resolvedIdentity.userId, status: 1 },
      relations: {
        userRoles: {
          role: true,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('当前用户不存在或已禁用');
    }

    const currentUser: CurrentUser = {
      id: user.id,
      username: user.username,
      realName: user.realName,
      roleCodes: (user.userRoles ?? [])
        .map((userRole) => userRole.role?.code)
        .filter((code): code is string => Boolean(code)),
      identitySource: resolvedIdentity.kind,
    };

    request.currentUser = currentUser;

    const requiresFormalIdentity = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_FORMAL_ACTOR_IDENTITY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiresFormalIdentity && currentUser.identitySource !== 'trusted_proxy') {
      throw new ForbiddenException(
        '[formal_actor_identity_required] 该写操作必须由可信代理绑定正式人员身份',
      );
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (
      currentUser.roleCodes.includes('admin') ||
      requiredRoles.some((role) => currentUser.roleCodes.includes(role))
    ) {
      return true;
    }

    throw new ForbiddenException('当前用户无权执行该操作');
  }

  private resolveIdentity(
    headers: Record<string, string | string[] | undefined>,
    remoteAddress?: string | null,
  ):
    | { kind: 'trusted_proxy'; username: string }
    | { kind: 'development_override' | 'default_user'; userId: number } {
    const formalUsername = this.firstHeader(headers['x-stark-actor-username'])?.trim();
    const formalSecret = this.firstHeader(headers['x-stark-actor-secret']);

    if (formalUsername || formalSecret) {
      if (!formalUsername || !formalSecret) {
        throw new UnauthorizedException('[formal_actor_identity_incomplete] 正式身份头不完整');
      }
      if (!/^[A-Za-z0-9._-]{1,50}$/.test(formalUsername)) {
        throw new UnauthorizedException('[formal_actor_username_invalid] 正式身份用户名格式无效');
      }
      this.assertTrustedProxy(remoteAddress);
      this.assertFormalSecret(formalSecret);
      return { kind: 'trusted_proxy', username: formalUsername };
    }

    // A deployed server must never turn a missing login into the default admin.
    if (!['development', 'test'].includes(process.env.NODE_ENV ?? 'development')) {
      throw new UnauthorizedException('[formal_actor_identity_required] 请通过受保护入口登录');
    }
    const allowOverride = process.env.ALLOW_REQUEST_USER_OVERRIDE === 'true';
    const normalizedHeaderValue = this.firstHeader(headers['x-user-id']);

    if (allowOverride && normalizedHeaderValue) {
      const userId = Number(normalizedHeaderValue);
      if (!Number.isInteger(userId) || userId < 1) {
        throw new UnauthorizedException('当前用户配置无效');
      }
      return { kind: 'development_override', userId };
    }

    const userId = Number(process.env.APP_DEFAULT_USER_ID ?? 1);
    if (!Number.isInteger(userId) || userId < 1) {
      throw new UnauthorizedException('当前用户配置无效');
    }
    return { kind: 'default_user', userId };
  }

  private firstHeader(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }

  private assertTrustedProxy(remoteAddress?: string | null) {
    const normalizedRemote = this.normalizeAddress(remoteAddress);
    const trusted = (process.env.FORMAL_ACTOR_IDENTITY_TRUSTED_PROXIES ?? '127.0.0.1,::1')
      .split(',')
      .map((item) => this.normalizeAddress(item))
      .filter(Boolean);

    if (!normalizedRemote || !trusted.includes(normalizedRemote)) {
      throw new UnauthorizedException(
        '[formal_actor_proxy_untrusted] 正式身份只能由受信任的直连代理注入',
      );
    }
  }

  private assertFormalSecret(provided: string) {
    const expected = process.env.FORMAL_ACTOR_IDENTITY_SHARED_SECRET ?? '';
    if (
      expected.length < 32 ||
      expected === FORMAL_ACTOR_SECRET_EXAMPLE ||
      provided.length !== expected.length
    ) {
      throw new UnauthorizedException('[formal_actor_secret_invalid] 正式身份凭据无效');
    }

    const providedBuffer = Buffer.from(provided, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('[formal_actor_secret_invalid] 正式身份凭据无效');
    }
  }

  private normalizeAddress(value?: string | null) {
    const normalized = value?.trim().toLowerCase() ?? '';
    return normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized;
  }
}
