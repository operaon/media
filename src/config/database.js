const { Sequelize } = require('sequelize');
const env = require('./env');

const options = {
  dialect: 'postgres',
  logging: false,
  dialectOptions: env.database.ssl ? { ssl: { require: true, rejectUnauthorized: true } } : {},
  pool: {
    max: Number(process.env.DB_POOL_MAX || 10),
    min: Number(process.env.DB_POOL_MIN || 0),
    acquire: Number(process.env.DB_POOL_ACQUIRE || 30000),
    idle: Number(process.env.DB_POOL_IDLE || 10000),
  },
};

const sequelize = env.database.url
  ? new Sequelize(env.database.url, options)
  : new Sequelize(env.database.name, env.database.user, env.database.password, {
      ...options,
      host: env.database.host,
      port: env.database.port,
    });

module.exports = sequelize;
