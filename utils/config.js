/**
 * Advanced Configuration and Error Handling
 */

const path = require('path');
const os = require('os');

/**
 * Detect LibreOffice installation path
 * @returns {string} - Path to LibreOffice executable
 */
function detectLibreOfficePath() {
  const platform = os.platform();

  switch (platform) {
    case 'win32':
      // Windows paths
      const windowsPaths = [
        'C:\\Program Files\\LibreOffice\\program',
        'C:\\Program Files (x86)\\LibreOffice\\program',
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
      ];
      return windowsPaths[0];

    case 'darwin':
      // macOS paths
      return '/Applications/LibreOffice.app/Contents/MacOS';

    case 'linux':
    default:
      // Linux paths
      return '/usr/bin';
  }
}

/**
 * Configuration object
 */
const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  maxFileSize: Number(process.env.MAX_FILE_SIZE_MB || 50) * 1024 * 1024,
  libreOfficePath: process.env.LIBREOFFICE_PATH || detectLibreOfficePath(),
  logLevel: process.env.LOG_LEVEL || 'info',
  corsEnabled: true,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  callbackTimeoutMs: Number(process.env.CALLBACK_TIMEOUT_MS || 15000),
  extractionAuthToken: process.env.EXTRACTION_AUTH_TOKEN || '',
  basicAuthUser: process.env.BASIC_AUTH_USER || '',
  basicAuthPass: process.env.BASIC_AUTH_PASS || ''
};

/**
 * Custom error class for conversion errors
 */
class ConversionError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'ConversionError';
    this.statusCode = statusCode;
  }
}

/**
 * Custom error class for validation errors
 */
class ValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = statusCode;
  }
}

/**
 * Logger utility
 */
const logger = {
  info: (message) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`),
  error: (message, error) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error),
  warn: (message) => console.warn(`[WARN] ${new Date().toISOString()} - ${message}`),
  debug: (message) => {
    if (config.logLevel === 'debug') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`);
    }
  }
};

module.exports = {
  config,
  ConversionError,
  ValidationError,
  logger,
  detectLibreOfficePath
};
