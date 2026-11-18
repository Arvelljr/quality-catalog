const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { manifest } = require('./manifest');
const { handleCatalog } = require('./catalog');

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async (args) => {
  try {
    return await handleCatalog(args);
  } catch (err) {
    console.error(`[catalog] ${args.id}:`, err.message);
    return { metas: [] };
  }
});

const port = parseInt(process.env.PORT, 10) || 7000;
serveHTTP(builder.getInterface(), { port });
console.log(`Quality Catalog running: http://127.0.0.1:${port}/configure`);
