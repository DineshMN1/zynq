import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  errorCode: string;
  requestId: string;
  timestamp: string;
  path: string;
  stack?: string;
}

// Map common error types to error codes
const ERROR_CODES: Record<string, string> = {
  BadRequestException: 'BAD_REQUEST',
  UnauthorizedException: 'UNAUTHORIZED',
  ForbiddenException: 'FORBIDDEN',
  NotFoundException: 'NOT_FOUND',
  ConflictException: 'CONFLICT',
  PayloadTooLargeException: 'PAYLOAD_TOO_LARGE',
  ThrottlerException: 'RATE_LIMIT_EXCEEDED',
  InternalServerErrorException: 'INTERNAL_ERROR',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Generate or use existing request ID
    const requestId = (request.headers['x-request-id'] as string) || uuidv4();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorName = 'InternalServerErrorException';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      errorName = exception.constructor.name;

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string) || message;
        if (Array.isArray(responseObj.message)) {
          message = responseObj.message.join(', ');
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      errorName = exception.constructor.name;
    }

    const errorCode = ERROR_CODES[errorName] || 'UNKNOWN_ERROR';

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error: errorName
        .replace('Exception', '')
        .replace(/([A-Z])/g, ' $1')
        .trim(),
      errorCode,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development' && exception instanceof Error) {
      errorResponse.stack = exception.stack;
    }

    // Log the error
    const logContext = {
      requestId,
      path: request.url,
      method: request.method,
      statusCode: status,
      errorCode,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
        JSON.stringify(logContext),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `${request.method} ${request.url} - ${status} - ${message}`,
        JSON.stringify(logContext),
      );
    }

    // Set request ID in response header
    response.setHeader('X-Request-ID', requestId);

    response.status(status).json(errorResponse);
  }
}
