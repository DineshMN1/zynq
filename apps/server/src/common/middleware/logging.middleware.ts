import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();

    // Attach request ID to request object for use in other parts of the application
    req.headers['x-request-id'] = requestId;

    // Get request details
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';

    // Log incoming request
    this.logger.log(
      `→ ${method} ${originalUrl} - IP: ${ip} - UserAgent: ${userAgent.substring(0, 50)}`,
    );

    // Capture response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const responseContentLength = res.get('content-length') || '0';

      const logMessage = `← ${method} ${originalUrl} - ${statusCode} - ${duration}ms - ${responseContentLength}B`;

      // Log based on status code
      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    // Set request ID in response header
    res.setHeader('X-Request-ID', requestId);

    next();
  }
}
