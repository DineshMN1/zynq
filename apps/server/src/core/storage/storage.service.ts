import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucket: string;
  private internalEndpoint: string;
  private publicEndpoint: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get('S3_BUCKET');
    this.internalEndpoint = this.configService.get('S3_ENDPOINT');
    this.publicEndpoint =
      this.configService.get('S3_PUBLIC_ENDPOINT') || this.internalEndpoint;

    this.s3Client = new S3Client({
      endpoint: this.internalEndpoint,
      region: this.configService.get('S3_REGION'),
      credentials: {
        accessKeyId: this.configService.get('S3_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('S3_SECRET_ACCESS_KEY'),
      },
      forcePathStyle: this.configService.get('S3_FORCE_PATH_STYLE') === 'true',
    });
  }

  private toPublicUrl(url: string): string {
    // Replace internal endpoint with public endpoint for browser access
    return url.replace(this.internalEndpoint, this.publicEndpoint);
  }

  async getPresignedUploadUrl(
    fileName: string,
    mimeType: string,
  ): Promise<{ uploadUrl: string; storagePath: string }> {
    const storagePath = `${uuidv4()}-${fileName}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
      ContentType: mimeType,
    });

    const internalUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });

    return { uploadUrl: this.toPublicUrl(internalUrl), storagePath };
  }

  async getPresignedDownloadUrl(storagePath: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
    });

    const internalUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });

    return this.toPublicUrl(internalUrl);
  }

  async deleteObject(storagePath: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
    });

    await this.s3Client.send(command);
  }
}
