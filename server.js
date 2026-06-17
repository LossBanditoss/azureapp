require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { randomUUID } = require('crypto');
const {
  convertDocToPdf,
  extractVariables,
  renderTemplate,
  setLibreOfficePath,
  detectFileType
} = require('./utils/converter');
const { config, logger, ValidationError } = require('./utils/config');

const app = express();

setLibreOfficePath(config.libreOfficePath);

// Middleware
app.use(express.json({ limit: `${Math.floor(config.maxFileSize / (1024 * 1024))}mb` }));
app.use(express.urlencoded({ extended: true, limit: `${Math.floor(config.maxFileSize / (1024 * 1024))}mb` }));

function decodeBase64File(file) {
  if (!file || typeof file !== 'string') {
    throw new ValidationError('No file provided. Expected base64 encoded file in "file" field.');
  }

  const cleanedBase64 = file.includes(',') ? file.split(',').pop() : file;
  const buffer = Buffer.from(cleanedBase64, 'base64');

  if (!buffer.length) {
    throw new ValidationError('Invalid base64 file content.');
  }

  return buffer;
}

function isValidTemplateFileName(fileName) {
  // Letters, numbers, spaces, underscores, hyphens and dots only.
  return /^[A-Za-z0-9 _.-]+$/.test(fileName || '');
}

function createPbiError(res, conversionId, statusCode, errorCode, message) {
  return res.status(statusCode).json({
    conversionId,
    status: 'failed',
    errorCode,
    message
  });
}

function isValidBasicAuth(authorization) {
  if (!authorization || !authorization.startsWith('Basic ')) {
    return false;
  }

  const token = authorization.slice(6);
  let decoded = '';
  try {
    decoded = Buffer.from(token, 'base64').toString('utf8');
  } catch (error) {
    return false;
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex < 0) {
    return false;
  }

  const user = decoded.slice(0, separatorIndex);
  const pass = decoded.slice(separatorIndex + 1);
  return user === config.basicAuthUser && pass === config.basicAuthPass;
}

function requireExtractionAuth(req, res, next) {
  const hasBasicAuth = Boolean(config.basicAuthUser && config.basicAuthPass);
  const hasBearerAuth = Boolean(config.extractionAuthToken);

  if (!hasBasicAuth && !hasBearerAuth) {
    return next();
  }

  const authorization = req.headers.authorization || '';

  if (hasBasicAuth) {
    if (!isValidBasicAuth(authorization)) {
      return res.status(401).json({
        status: 'failed',
        errorCode: 'UNAUTHORIZED',
        message: 'Missing or invalid basic authorization credentials.'
      });
    }

    return next();
  }

  const expected = `Bearer ${config.extractionAuthToken}`;
  if (authorization !== expected) {
    return res.status(401).json({
      status: 'failed',
      errorCode: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization token.'
    });
  }

  return next();
}

async function sendPdfToCallback({ callbackUrl, callbackHeaders, jobId, index, total, pdfBuffer, placeholders }) {
  await axios.post(
    callbackUrl,
    {
      jobId,
      index,
      total,
      pdfBase64: pdfBuffer.toString('base64'),
      pdfSize: pdfBuffer.length,
      placeholders
    },
    {
      headers: {
        'Content-Type': 'application/json',
        ...(callbackHeaders || {})
      },
      timeout: config.callbackTimeoutMs
    }
  );
}

async function processBatchJob({ jobId, fileBuffer, items, callbackUrl, callbackHeaders }) {
  logger.info(`Job ${jobId} started. PDFs to create: ${items.length}`);

  for (let i = 0; i < items.length; i += 1) {
    const current = i + 1;

    try {
      const renderedDocx = renderTemplate(fileBuffer, items[i]);
      const pdfBuffer = await convertDocToPdf(renderedDocx);

      await sendPdfToCallback({
        callbackUrl,
        callbackHeaders,
        jobId,
        index: current,
        total: items.length,
        pdfBuffer,
        placeholders: items[i]
      });

      logger.info(`Job ${jobId}: sent PDF ${current}/${items.length}`);
    } catch (error) {
      logger.error(`Job ${jobId}: failed for item ${current}`, error);
    }
  }

  logger.info(`Job ${jobId} finished.`);
}

app.get('/health', (req, res) => {
  logger.debug('Health check requested');
  res.status(200).json({
    status: 'OK',
    libreOfficePath: config.libreOfficePath,
    environment: config.nodeEnv
  });
});

// Extract placeholders from base64 Word file.
app.post('/extract-placeholders', requireExtractionAuth, async (req, res, next) => {
  try {
    const { file } = req.body;
    const fileBuffer = decodeBase64File(file);
    const placeholders = await extractVariables(fileBuffer);

    logger.info(`Placeholder extraction successful: ${placeholders.length} found`);

    res.status(200).json({
      success: true,
      data: {
        placeholders,
        count: placeholders.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// PBI endpoint: extract variables from DOCX template payload sent by ServiceNow.
app.post('/api/template/extract-variables', requireExtractionAuth, async (req, res) => {
  const {
    conversionId,
    recordSysId,
    attachmentSysId,
    fileName,
    encodedWord
  } = req.body || {};

  if (!conversionId || !recordSysId || !attachmentSysId || !fileName || !encodedWord) {
    return createPbiError(
      res,
      conversionId || null,
      400,
      'INVALID_REQUEST',
      'Required fields: conversionId, recordSysId, attachmentSysId, fileName, encodedWord.'
    );
  }

  if (!String(fileName).toLowerCase().endsWith('.docx')) {
    return createPbiError(
      res,
      conversionId,
      400,
      'INVALID_FILE_TYPE',
      'Only .docx files are supported for template extraction.'
    );
  }

  if (!isValidTemplateFileName(String(fileName))) {
    return createPbiError(
      res,
      conversionId,
      400,
      'INVALID_FILE_NAME',
      'File name contains unsupported characters.'
    );
  }

  try {
    const fileBuffer = decodeBase64File(encodedWord);
    const detectedType = detectFileType(fileBuffer);
    if (detectedType !== 'docx') {
      return createPbiError(
        res,
        conversionId,
        400,
        'INVALID_DOCX_CONTENT',
        'Decoded content is not a valid DOCX document.'
      );
    }

    const variables = await extractVariables(fileBuffer);

    return res.status(200).json({
      conversionId,
      status: 'success',
      variables
    });
  } catch (error) {
    logger.error(`Extraction failed for conversionId ${conversionId}`, error);
    return createPbiError(
      res,
      conversionId,
      500,
      'DOCX_PROCESSING_FAILED',
      'The uploaded Word document could not be processed.'
    );
  }
});

// Accept batch generation and process asynchronously.
app.post('/generate-pdf-batch', requireExtractionAuth, async (req, res, next) => {
  try {
    const { file, data, callbackUrl, callbackHeaders } = req.body;
    const fileBuffer = decodeBase64File(file);

    if (!callbackUrl || typeof callbackUrl !== 'string') {
      throw new ValidationError('Missing callbackUrl.');
    }

    const items = Array.isArray(data) ? data : [data];
    if (!items.length || !items[0] || typeof items[0] !== 'object') {
      throw new ValidationError('Missing data object or data array for placeholders.');
    }

    const jobId = randomUUID();

    setImmediate(() => {
      processBatchJob({
        jobId,
        fileBuffer,
        items,
        callbackUrl,
        callbackHeaders
      }).catch((error) => {
        logger.error(`Job ${jobId} crashed`, error);
      });
    });

    res.status(202).json({ status: 'accepted' });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

app.listen(config.port, () => {
  logger.info(`Server is running on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`LibreOffice path: ${config.libreOfficePath}`);
  logger.info('Available endpoints:');
  logger.info('  POST /extract-placeholders - Extract placeholders from base64 Word document');
  logger.info('  POST /generate-pdf-batch - Accept batch job and callback generated PDFs');
  logger.info('  GET /health - Health check');
});
