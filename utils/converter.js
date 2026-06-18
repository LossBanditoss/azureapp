const libre = require('libreoffice-convert');
const mammoth = require('mammoth');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const path = require('path');

let sofficeBinaryPaths = [];

function setLibreOfficePath(libreOfficePath) {
  if (!libreOfficePath) {
    sofficeBinaryPaths = [];
    return;
  }

  const normalizedPath = libreOfficePath.replace(/\\/g, '/');
  const isBinaryPath = /soffice(\.exe)?$/i.test(normalizedPath) || /libreoffice$/i.test(normalizedPath);

  if (isBinaryPath) {
    sofficeBinaryPaths = [normalizedPath];
    return;
  }

  sofficeBinaryPaths = [
    path.posix.join(normalizedPath, 'soffice'),
    path.posix.join(normalizedPath, 'soffice.exe'),
    path.posix.join(normalizedPath, 'libreoffice')
  ];
}

/**
 * Convert Word document to PDF
 * @param {Buffer} fileBuffer - The Word document buffer
 * @returns {Promise<Buffer>} - The PDF buffer
 */
async function convertDocToPdf(fileBuffer) {
  return new Promise((resolve, reject) => {
    const options = sofficeBinaryPaths.length ? { sofficeBinaryPaths } : undefined;
    
    try {
      libre.convertWithOptions(fileBuffer, 'pdf', undefined, options, (err, result) => {
        if (err) {
          reject(new Error(`LibreOffice conversion error: ${err.message}`));
        } else {
          resolve(result);
        }
      });
    } catch (error) {
      reject(new Error(`Conversion failed: ${error.message}`));
    }
  });
}

/**
 * Extract variable placeholders from Word document
 * Variables are identified by patterns like {{variable_name}} or ${variable_name}
 * @param {Buffer} fileBuffer - The Word document buffer
 * @returns {Promise<Array>} - Array of extracted variables
 */
async function extractVariables(fileBuffer) {
  try {
    // Extract text content from Word document
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    const text = result.value;

    // Extract variables with different patterns
    const variables = new Set();

    // Variable token supports dot-walking paths like a.b.c
    const variableToken = '([a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)*)';

    // Pattern 1: {{variable_name}}
    const pattern1 = new RegExp(`\\{\\{${variableToken}\\}\\}`, 'g');
    let match;
    while ((match = pattern1.exec(text)) !== null) {
      variables.add(match[1]);
    }

    // Pattern 2: ${variable_name}
    const pattern2 = new RegExp(`\\$\\{${variableToken}\\}`, 'g');
    while ((match = pattern2.exec(text)) !== null) {
      variables.add(match[1]);
    }

    // Pattern 3: $variable_name (simple dollar sign)
    const pattern3 = new RegExp(`\\$${variableToken}\\b`, 'g');
    while ((match = pattern3.exec(text)) !== null) {
      variables.add(match[1]);
    }

    // Pattern 4: [variable_name] with capital letters or underscores
    const pattern4 = /\[([A-Z_][A-Z0-9_]*)\]/g;
    while ((match = pattern4.exec(text)) !== null) {
      variables.add(match[1]);
    }

    // Pattern 5: {variable_name} (single curly braces)
    const pattern5 = new RegExp(`\\{${variableToken}\\}`, 'g');
    while ((match = pattern5.exec(text)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables).sort();
  } catch (error) {
    throw new Error(`Variable extraction failed: ${error.message}`);
  }
}

/**
 * Render DOCX template with provided placeholders.
 * Template placeholders should use syntax like {{name}}.
 * @param {Buffer} fileBuffer - DOCX template buffer
 * @param {Object} data - Placeholder values
 * @returns {Buffer} - Rendered DOCX buffer
 */
function renderTemplate(fileBuffer, data) {
  try {
    const zip = new PizZip(fileBuffer);
    const doc = new Docxtemplater(zip, {
      delimiters: {
        start: '{{',
        end: '}}'
      },
      paragraphLoop: true,
      linebreaks: true
    });

    doc.render(data || {});
    return doc.getZip().generate({ type: 'nodebuffer' });
  } catch (error) {
    throw new Error(`Template rendering failed: ${error.message}`);
  }
}

/**
 * Detect file type based on magic bytes
 * @param {Buffer} buffer - File buffer
 * @returns {string} - File extension (doc, docx, etc.)
 */
function detectFileType(buffer) {
  // DOCX magic bytes: 50 4B 03 04 (PK)
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return 'docx';
  }

  // DOC magic bytes: D0 CF 11 E0 (older Office format)
  if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
    return 'doc';
  }

  // Default to docx
  return 'docx';
}

module.exports = {
  convertDocToPdf,
  extractVariables,
  detectFileType,
  renderTemplate,
  setLibreOfficePath
};
