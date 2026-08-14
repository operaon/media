require('dotenv').config();

const base = {
  username: process.env.DB_USER || 'dbadmin',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'operaon_media',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  dialect: 'postgres',
};

module.exports = {
  development: { ...base },
  test: { ...base, database: process.env.DB_NAME || 'operaon_media_test' },
  production: process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL, dialect: 'postgres', dialectOptions: process.env.DB_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: true } } : {} }
    : { ...base, dialectOptions: process.env.DB_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: true } } : {} },
};
