require('dotenv').config();

export const development = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // AJOUT CRUCIAL : Active le SSL si on ne pointe pas sur localhost
    ssl: process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1'
      ? { rejectUnauthorized: false }
      : false
  },
  migrations: {
    directory: './migrations'
  }
};
export const production = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  // Toujours SSL en production (Railway)
  ssl: { rejectUnauthorized: false },
  migrations: {
    directory: './migrations'
  }
};