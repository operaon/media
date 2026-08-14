'use strict';

const { Client } = require('minio');
const env = require('../config/env');

class ObjectStore {
  constructor() {
    this.client = new Client({
      endPoint: env.storage.endpoint,
      port: env.storage.port,
      useSSL: env.storage.useSSL,
      accessKey: env.storage.accessKey,
      secretKey: env.storage.secretKey,
      region: env.storage.region,
    });
    this.bucket = env.storage.bucket;
    this.publicEndpoint = env.storage.publicEndpoint.replace(/\/$/, '');
    this.readyBuckets = new Set();
  }

  async bucketExists(bucket) {
    return this.client.bucketExists(bucket);
  }

  async ensureBucket(bucket = this.bucket) {
    if (this.readyBuckets.has(bucket)) return;
    const exists = await this.client.bucketExists(bucket);
    if (!exists) await this.client.makeBucket(bucket, env.storage.region);
    if (bucket === this.bucket) {
      const policy = {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/logo/*`, `arn:aws:s3:::${bucket}/site/*`],
        }],
      };
      await this.client.setBucketPolicy(bucket, JSON.stringify(policy));
    }
    this.readyBuckets.add(bucket);
  }

  async putObject(objectKey, buffer, contentType, bucket = this.bucket) {
    await this.ensureBucket(bucket);
    await this.client.putObject(bucket, objectKey, buffer, buffer.length, {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=0, no-cache',
    });
    return { bucket, objectKey };
  }

  async getPresignedUrl(objectKey, expirySeconds = env.storage.presignExpirySeconds, bucket = this.bucket) {
    await this.ensureBucket(bucket);
    const internalUrl = await this.client.presignedGetObject(bucket, objectKey, expirySeconds);
    return this.publicEndpoint === '/minio'
      ? internalUrl.replace(/^https?:\/\/[^/]+/, this.publicEndpoint)
      : internalUrl.replace(/^https?:\/\/[^/]+/, this.publicEndpoint);
  }

  publicUrl(objectKey, bucket = this.bucket) {
    return `${this.publicEndpoint}/${bucket}/${objectKey}`;
  }

  async getObjectStream(objectKey, bucket = this.bucket) {
    await this.ensureBucket(bucket);
    return this.client.getObject(bucket, objectKey);
  }

  async getObjectBuffer(objectKey, bucket = this.bucket) {
    const stream = await this.getObjectStream(objectKey, bucket);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  async statObject(objectKey, bucket = this.bucket) {
    await this.ensureBucket(bucket);
    return this.client.statObject(bucket, objectKey);
  }

  async removeObject(objectKey, bucket = this.bucket) {
    await this.ensureBucket(bucket);
    await this.client.removeObject(bucket, objectKey);
  }

  isNotFound(error) {
    const code = error?.code || error?.name;
    const message = String(error?.message || '');
    return ['NoSuchKey', 'NoSuchObject', 'NotFound'].includes(code)
      || /specified key does not exist|object does not exist|no such key/i.test(message);
  }
}

module.exports = new ObjectStore();
