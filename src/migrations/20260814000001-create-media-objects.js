'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hasTable = async (tableName) => queryInterface.tableExists(tableName);

    if (!(await hasTable('media_objects'))) {
      await queryInterface.createTable('media_objects', {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        tenantId: { type: Sequelize.UUID, allowNull: false },
        organizationId: { type: Sequelize.UUID, allowNull: true },
        ownerType: { type: Sequelize.STRING(60), allowNull: false },
        ownerId: { type: Sequelize.UUID, allowNull: true },
        category: { type: Sequelize.STRING(80), allowNull: false },
        bucket: { type: Sequelize.STRING(120), allowNull: false },
        objectKey: { type: Sequelize.STRING(500), allowNull: false },
        originalName: { type: Sequelize.STRING(255), allowNull: false },
        contentType: { type: Sequelize.STRING(160), allowNull: false },
        sizeBytes: { type: Sequelize.BIGINT, allowNull: false },
        checksumSha256: { type: Sequelize.STRING(64), allowNull: false },
        visibility: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'private' },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'active' },
        uploadedByUserId: { type: Sequelize.UUID, allowNull: true },
        sourceSystem: { type: Sequelize.STRING(80), allowNull: true },
        sourceId: { type: Sequelize.STRING(180), allowNull: true },
        idempotencyKey: { type: Sequelize.STRING(220), allowNull: true },
        metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
    }

    await queryInterface.addIndex('media_objects', ['bucket', 'objectKey'], {
      unique: true,
      name: 'media_objects_bucket_object_key_unique',
    }).catch(() => {});
    await queryInterface.addIndex('media_objects', ['tenantId', 'organizationId', 'status'], {
      name: 'media_objects_tenant_org_status_idx',
    }).catch(() => {});
    await queryInterface.addIndex('media_objects', ['tenantId', 'ownerType', 'ownerId'], {
      name: 'media_objects_owner_scope_idx',
    }).catch(() => {});
    await queryInterface.addIndex('media_objects', ['tenantId', 'category', 'createdAt'], {
      name: 'media_objects_tenant_category_created_idx',
    }).catch(() => {});
    await queryInterface.addIndex('media_objects', ['sourceSystem', 'sourceId'], {
      unique: true,
      name: 'media_objects_source_system_source_id_unique',
    }).catch(() => {});
    await queryInterface.addIndex('media_objects', ['idempotencyKey'], {
      unique: true,
      name: 'media_objects_idempotency_key_unique',
    }).catch(() => {});
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('media_objects').catch(() => {});
  },
};
