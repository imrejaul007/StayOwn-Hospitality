import logger from './utils/logger';

import { env } from '../../config/env';
import crypto from 'crypto';

/**
 * S3 Image Upload Service.
 * In dev mode, returns a mock URL.
 * In production, uploads to AWS S3.
 */
export class S3UploadService {
  /**
   * Upload a buffer to S3 and return the URL.
   */
  static async uploadImage(buffer: Buffer, hotelId: string, mimeType: string = 'image/jpeg'): Promise<string> {
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const key = `hotels/${hotelId}/${crypto.randomUUID()}.${ext}`;

    if (!env.AWS_ACCESS_KEY || env.NODE_ENV === 'development') {
      // Dev mode: return mock URL
      const mockUrl = `https://${env.AWS_S3_BUCKET || 'ota-dev'}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
      logger.info(`[S3] Mock upload: ${mockUrl}`);
      return mockUrl;
    }

    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

    const s3 = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY,
        secretAccessKey: env.AWS_SECRET_KEY,
      },
    });

    await s3.send(new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ACL: 'public-read',
    }));

    return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  }

  /**
   * Upload a user receipt image (stay registration).
   */
  static async uploadReceipt(buffer: Buffer, userId: string, mimeType: string = 'image/jpeg'): Promise<string> {
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const key = `receipts/${userId}/${crypto.randomUUID()}.${ext}`;

    if (!env.AWS_ACCESS_KEY || env.NODE_ENV === 'development') {
      const mockUrl = `https://${env.AWS_S3_BUCKET || 'ota-dev'}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
      logger.info(`[S3] Mock upload: ${mockUrl}`);
      return mockUrl;
    }

    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

    const s3 = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY,
        secretAccessKey: env.AWS_SECRET_KEY,
      },
    });

    await s3.send(new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }));

    return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  }
}
