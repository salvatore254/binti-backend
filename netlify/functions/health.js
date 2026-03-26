/**
 * Netlify Function: GET /api/health
 * Health check endpoint
 */

const { withCors } = require('./utils');

const handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      platform: 'Netlify'
    })
  };
};

exports.handler = withCors(handler);
