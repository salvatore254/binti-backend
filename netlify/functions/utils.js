/**
 * Netlify Functions Utilities
 * Shared helpers for all serverless functions
 */

// CORS headers for all responses
const getCorsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json'
});

/**
 * Handle CORS preflight requests
 */
const handleCors = (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: ''
    };
  }
};

/**
 * Wrap handler with error handling and CORS
 */
const withCors = (handler) => {
  return async (event, context) => {
    // Handle preflight
    const corsResponse = handleCors(event);
    if (corsResponse) return corsResponse;

    try {
      const response = await handler(event, context);
      return {
        ...response,
        headers: {
          ...getCorsHeaders(),
          ...(response.headers || {})
        }
      };
    } catch (error) {
      console.error('Function error:', error);
      return {
        statusCode: 500,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          success: false,
          message: error.message || 'Internal Server Error'
        })
      };
    }
  };
};

/**
 * Parse JSON body safely
 */
const parseBody = (body) => {
  try {
    return body ? JSON.parse(body) : {};
  } catch (e) {
    return {};
  }
};

module.exports = {
  getCorsHeaders,
  handleCors,
  withCors,
  parseBody
};
