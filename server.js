require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { randomUUID } = require('crypto');
const {
  convertDocToPdf,
  extractVariables,
  renderTemplate,
  setLibreOfficePath
} = require('./utils/converter');
const { config, logger, ValidationError } = require('./utils/config');

const app = express();

setLibreOfficePath(config.libreOfficePath);

// Middleware
app.use(express.json({ limit: `${Math.floor(config.maxFileSize / (1024 * 1024))}mb` }));
app.use(express.urlencoded({ limit: `${Math.floor(config.maxFileSize / (1024 * 1024))}mb` }));

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
app.post('/extract-placeholders', async (req, res, next) => {
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

// Accept batch generation and process asynchronously.
app.post('/generate-pdf-batch', async (req, res, next) => {
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
