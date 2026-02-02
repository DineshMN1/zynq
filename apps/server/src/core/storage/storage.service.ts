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
  private s3PublicClient: S3Client;
  private bucket: string;
  private internalEndpoint: string;
  private publicEndpoint: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get('S3_BUCKET');
    this.internalEndpoint = this.configService.get('S3_ENDPOINT');
    this.publicEndpoint =
      this.configService.get('S3_PUBLIC_ENDPOINT') || this.internalEndpoint;

    console.log('[Storage] Initializing with config:');
    console.log('  Bucket:', this.bucket);
    console.log('  Internal Endpoint:', this.internalEndpoint);
    console.log('  Public Endpoint:', this.publicEndpoint);

    const credentials = {
      accessKeyId: this.configService.get('S3_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('S3_SECRET_ACCESS_KEY'),
    };

    const region = this.configService.get('S3_REGION');
    const forcePathStyle = this.configService.get('S3_FORCE_PATH_STYLE') === 'true';

    console.log('  Region:', region);
    console.log('  Force Path Style:', forcePathStyle);

    // Client for internal operations (server-to-S3)
    this.s3Client = new S3Client({
      endpoint: this.internalEndpoint,
      region,
      credentials,
      forcePathStyle,
    });

    // Client for generating presigned URLs (browser-to-S3)
    this.s3PublicClient = new S3Client({
      endpoint: this.publicEndpoint,
      region,
      credentials,
      forcePathStyle,
    });
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

    // Use public client so the signature matches the public endpoint
    const uploadUrl = await getSignedUrl(this.s3PublicClient, command, {
      expiresIn: 3600,
    });

    return { uploadUrl, storagePath };
  }

  async getPresignedDownloadUrl(storagePath: string): Promise<string> {
    console.log('[Storage] Generating presigned download URL for:', storagePath);
    console.log('[Storage] Using public endpoint:', this.publicEndpoint);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
    });

    // Use public client so the signature matches the public endpoint
    const downloadUrl = await getSignedUrl(this.s3PublicClient, command, {
      expiresIn: 3600,
    });

    console.log('[Storage] Generated download URL:', downloadUrl);
    return downloadUrl;
  }

  async deleteObject(storagePath: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
    });

    await this.s3Client.send(command);
  }
}
