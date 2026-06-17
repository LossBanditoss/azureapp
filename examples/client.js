/**
 * JavaScript/Node.js Client Example
 * 
 * Instalace: npm install axios
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000';

class WordConverterClient {
  /**
   * Extract variables from Word document
   * @param {string} filePath - Path to Word document
   * @returns {Promise<Array>} - Extracted variables
   */
  async extractVariables(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const base64File = fileBuffer.toString('base64');

    const response = await axios.post(`${API_URL}/extract-variables`, {
      file: base64File
    });

    return response.data.data.variables;
  }

  /**
   * Convert Word to PDF
   * @param {string} inputPath - Path to Word document
   * @param {string} outputPath - Output PDF path
   * @returns {Promise<void>}
   */
  async convertToPdf(inputPath, outputPath) {
    const fileBuffer = fs.readFileSync(inputPath);
    const base64File = fileBuffer.toString('base64');

    const response = await axios.post(`${API_URL}/convert-to-pdf`, {
      file: base64File
    });

    const pdfBuffer = Buffer.from(response.data.data.pdfBase64, 'base64');
    fs.writeFileSync(outputPath, pdfBuffer);
  }

  /**
   * Convert and extract variables
   * @param {string} inputPath - Path to Word document
   * @param {string} pdfOutputPath - Output PDF path
   * @returns {Promise<{variables: Array, pdfPath: string}>}
   */
  async convertAndExtract(inputPath, pdfOutputPath) {
    const fileBuffer = fs.readFileSync(inputPath);
    const base64File = fileBuffer.toString('base64');

    const response = await axios.post(`${API_URL}/convert-and-extract`, {
      file: base64File
    });

    // Save PDF
    const pdfBuffer = Buffer.from(response.data.data.pdfBase64, 'base64');
    fs.writeFileSync(pdfOutputPath, pdfBuffer);

    return {
      variables: response.data.data.variables,
      pdfPath: pdfOutputPath
    };
  }
}

// Usage Example
async function main() {
  const client = new WordConverterClient();

  try {
    console.log('🔄 Zpracovávání dokumentu...\n');

    // Extract variables only
    const variables = await client.extractVariables('document.docx');
    console.log('📝 Extrahované proměnné:', variables);

    // Convert and extract
    const result = await client.convertAndExtract('document.docx', 'output.pdf');
    console.log('\n✅ Hotovo!');
    console.log('📊 Proměnné:', result.variables);
    console.log('💾 PDF: ', result.pdfPath);
  } catch (error) {
    console.error('❌ Chyba:', error.message);
  }
}

// Uncomment to run:
// main();

module.exports = WordConverterClient;
