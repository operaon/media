'use strict';

const { Sequelize } = require('sequelize');
const env = require('./env');

const options = {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {},
  pool: {
    max: Number(process.env.LEGACY_DB_POOL_MAX || 4),
    min: 0,
    acquire: Number(process.env.LEGACY_DB_POOL_ACQUIRE || 30000),
    idle: Number(process.env.LEGACY_DB_POOL_IDLE || 10000),
  },
};

const sequelize = env.legacyDatabase.url
  ? new Sequelize(env.legacyDatabase.url, options)
  : new Sequelize(env.legacyDatabase.name, env.legacyDatabase.user, env.legacyDatabase.password, {
      ...options,
      host: env.legacyDatabase.host,
      port: env.legacyDatabase.port,
    });

module.exports = sequelize;
