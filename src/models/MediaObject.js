'use strict';

const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class MediaObject extends Model {}

MediaObject.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    tenantId: { type: DataTypes.UUID, allowNull: false },
    organizationId: { type: DataTypes.UUID, allowNull: true },
    ownerType: { type: DataTypes.STRING(60), allowNull: false },
    ownerId: { type: DataTypes.UUID, allowNull: true },
    category: { type: DataTypes.STRING(80), allowNull: false },
    bucket: { type: DataTypes.STRING(120), allowNull: false },
    objectKey: { type: DataTypes.STRING(500), allowNull: false },
    originalName: { type: DataTypes.STRING(255), allowNull: false },
    contentType: { type: DataTypes.STRING(160), allowNull: false },
    sizeBytes: { type: DataTypes.BIGINT, allowNull: false },
    checksumSha256: { type: DataTypes.STRING(64), allowNull: false },
    visibility: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'private',
      validate: { isIn: [['private', 'public']] },
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
      validate: { isIn: [['active', 'deleted', 'orphaned']] },
    },
    uploadedByUserId: { type: DataTypes.UUID, allowNull: true },
    sourceSystem: { type: DataTypes.STRING(80), allowNull: true },
    sourceId: { type: DataTypes.STRING(180), allowNull: true },
    idempotencyKey: { type: DataTypes.STRING(220), allowNull: true },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    deletedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'MediaObject',
    tableName: 'media_objects',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['bucket', 'objectKey'] },
      { fields: ['tenantId', 'organizationId', 'status'] },
      { fields: ['tenantId', 'ownerType', 'ownerId'] },
      { fields: ['tenantId', 'category', 'createdAt'] },
      { fields: ['sourceSystem', 'sourceId'], unique: true },
      { fields: ['idempotencyKey'], unique: true },
    ],
  },
);

module.exports = MediaObject;
