require('dotenv').config();
const app = require('./app');

// Connection d'affichage (optionnel)
try {
  require('./db/index');
} catch (e) {
  // ignore
}

// Server
console.log("🚀 NODE_ENV:", process.env.NODE_ENV);
console.log("🚀 DATABASE_URL:", process.env.DATABASE_URL);
console.log("🚀 PORT:", process.env.PORT);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 NexaTank API running on port ${PORT}`);
});