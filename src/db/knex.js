const path = require('path');
const env = process.env.NODE_ENV || 'development';
const knexConfig = require(path.join(__dirname, '..', '..', 'knexfile'))[env];
const knex = require('knex')(knexConfig);

module.exports = knex;
