// index.js – Entry point for local development **and** Vercel Serverless Function
const app = require('./src/app');
const PORT = process.env.PORT || 3000;

// When running locally (not in Vercel), start a traditional server
if (!process.env.VERCEL) {
  app.listen(PORT, () =>
    console.log(`🚀 Server listening on http://localhost:${PORT}`)
  );
}

// Export the Express app for the @vercel/node runtime
module.exports = app;