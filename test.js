/**
 * Test Requests for Word to PDF Converter & Variable Extractor
 * 
 * Stažení: npm install axios
 * Spuštění: node test.js
 */

const fs = require('fs');
const path = require('path');

// Mock axios pro demonstration
async function testWithFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Soubor nenalezen: ${filePath}`);
    console.log('Vytvořte test Word soubor (document.docx) v kořenovém adresáři');
    return;
  }

  try {
    const axios = require('axios');
    const fileBuffer = fs.readFileSync(filePath);
    const base64File = fileBuffer.toString('base64');

    const baseUrl = 'http://localhost:3000';

    console.log('🔄 Testování API...\n');

    // Test 1: Health check
    console.log('1️⃣ Health Check');
    try {
      const healthRes = await axios.get(`${baseUrl}/health`);
      console.log('✅ Status:', healthRes.data.status);
    } catch (error) {
      console.log('❌ Server není spuštěn');
      return;
    }

    console.log('\n---\n');

    // Test 2: Extract variables
    console.log('2️⃣ Extrakce Proměnných');
    try {
      const extractRes = await axios.post(`${baseUrl}/extract-variables`, {
        file: base64File
      });
      console.log('✅ Extrahované proměnné:', extractRes.data.data.variables);
      console.log('📊 Počet:', extractRes.data.data.count);
    } catch (error) {
      console.log('❌ Chyba:', error.response?.data?.error || error.message);
    }

    console.log('\n---\n');

    // Test 3: Convert to PDF
    console.log('3️⃣ Konverze do PDF');
    try {
      const pdfRes = await axios.post(`${baseUrl}/convert-to-pdf`, {
        file: base64File
      });
      console.log('✅ PDF vytvořen');
      console.log('📊 Velikost:', pdfRes.data.data.pdfSize, 'bajtů');

      // Uložte PDF
      const pdfBuffer = Buffer.from(pdfRes.data.data.pdfBase64, 'base64');
      const outputPath = path.join(__dirname, 'output.pdf');
      fs.writeFileSync(outputPath, pdfBuffer);
      console.log('💾 Uloženo:', outputPath);
    } catch (error) {
      console.log('❌ Chyba:', error.response?.data?.error || error.message);
    }

    console.log('\n---\n');

    // Test 4: Convert and Extract
    console.log('4️⃣ Konverze a Extrakce (kombinované)');
    try {
      const comboRes = await axios.post(`${baseUrl}/convert-and-extract`, {
        file: base64File
      });
      console.log('✅ Úspěšně zpracováno');
      console.log('📝 Proměnné:', comboRes.data.data.variables);
      console.log('📊 PDF Velikost:', comboRes.data.data.pdfSize, 'bajtů');

      // Uložte PDF
      const pdfBuffer = Buffer.from(comboRes.data.data.pdfBase64, 'base64');
      const outputPath = path.join(__dirname, 'output_combined.pdf');
      fs.writeFileSync(outputPath, pdfBuffer);
      console.log('💾 PDF uloženo:', outputPath);
    } catch (error) {
      console.log('❌ Chyba:', error.response?.data?.error || error.message);
    }

  } catch (error) {
    console.error('Chyba:', error.message);
  }
}

// Hledejte document.docx v aktuálním adresáři
const testFile = path.join(__dirname, 'document.docx');

console.log('📋 Testy Word to PDF Converter & Variable Extractor\n');
console.log('⚠️  Ujistěte se, že je server spuštěn: npm start\n');

testWithFile(testFile);
