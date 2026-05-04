try {
  require('dotenv').config();
} catch (_e) {
  // dotenv is optional; environment variables can also be set directly.
}

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: './blog.sqlite',
    logging: console.log,
  },
  test: {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
  },
  production: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'blog_db',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: false,
  },
};
