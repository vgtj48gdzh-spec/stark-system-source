import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const frontendDistPath = join(__dirname, '..', '..', 'frontend', 'dist');
  const frontendIndexPath = join(frontendDistPath, 'index.html');
  const frontendDevServerUrl =
    process.env.FRONTEND_DEV_SERVER_URL ?? 'http://127.0.0.1:5173';
  const shouldServeFrontendDist =
    process.env.NODE_ENV === 'production' ||
    process.env.SERVE_FRONTEND_DIST === 'true';

  if (shouldServeFrontendDist && existsSync(frontendIndexPath)) {
    app.useStaticAssets(frontendDistPath);

    const httpAdapter = app.getHttpAdapter().getInstance();
    httpAdapter.get(/^(?!\/api).*/, (_req: unknown, res: { sendFile: (path: string) => void }) => {
      res.sendFile(frontendIndexPath);
    });
  } else if (process.env.NODE_ENV !== 'production') {
    const httpAdapter = app.getHttpAdapter().getInstance();
    httpAdapter.get(
      /^(?!\/api).*/,
      (
        req: { originalUrl?: string; url?: string },
        res: { redirect: (status: number, url: string) => void },
      ) => {
        const requestedPath = req.originalUrl ?? req.url ?? '/';
        const normalizedDevServerUrl = frontendDevServerUrl.replace(/\/+$/, '');
        const normalizedPath = requestedPath.startsWith('/')
          ? requestedPath
          : `/${requestedPath}`;
        res.redirect(302, `${normalizedDevServerUrl}${normalizedPath}`);
      },
    );
  }

  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? '0.0.0.0');
}

bootstrap();
