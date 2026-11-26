import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : Array.isArray((exceptionResponse as { message?: string | string[] }).message)
            ? (exceptionResponse as { message: string[] }).message[0]
            : (exceptionResponse as { message?: string }).message ?? exception.message;
      const rawCode =
        typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? (exceptionResponse as { code?: unknown }).code
          : undefined;
      const code =
        typeof rawCode === 'string' &&
        /^home_climate_[a-z0-9_]{1,83}$/.test(rawCode)
          ? rawCode
          : undefined;

      response.status(status).json({
        success: false,
        message,
        ...(code ? { code } : {}),
        data: null,
      });
      return;
    }

    console.error('[UnhandledException]', exception);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '服务器内部错误',
      data: null,
    });
  }
}
