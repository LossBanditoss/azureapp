# Word to PDF Converter & Variable Extractor

Node.js aplikace pro konverzi Word dokumentů do PDF a extrakci variable placeholders.

## Features

- ✅ Konverze Word (.doc, .docx) do PDF
- ✅ Extrakce variable placeholders z dokumentů
- ✅ Podpora více vzorů proměnných ({{var}}, ${var}, $var, [VAR])
- ✅ Base64 vstup a výstup
- ✅ JSON response formát
- ✅ REST API s Express

## Instalace

### Požadavky
- Node.js 14+
- LibreOffice (pro konverzi)

### Windows
```bash
# Nainstalujte LibreOffice ze: https://www.libreoffice.org/download/

# Klonujte/vytvořte projekt a nainstalujte závislosti
npm install
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-get install libreoffice libreoffice-writer
npm install
```

### macOS
```bash
brew install libreoffice
npm install
```

## Spuštění

```bash
# Produkční režim
npm start

# Vývojový režim (s auto-reloaderem)
npm run dev
```

Server bude spuštěn na `http://localhost:3000`

## API Endpoints

### 1. `/health` (GET)
Zdravotnostní check.

**Response:**
```json
{
  "status": "OK"
}
```

---

### 2. `/convert-and-extract` (POST)
Konvertuje Word do PDF a extrahuje proměnné.

**Request:**
```json
{
  "file": "base64_encoded_file_content"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "variables": ["variable1", "variable2", "USER_NAME"],
    "pdfBase64": "JVBERi0xLjQK...",
    "pdfSize": 45632
  }
}
```

---

### 3. `/extract-variables` (POST)
Extrahuje jen proměnné z dokumentu.

**Request:**
```json
{
  "file": "base64_encoded_file_content"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "variables": ["variable1", "variable2"],
    "count": 2
  }
}
```

---

### 4. `/convert-to-pdf` (POST)
Konvertuje Word do PDF (bez extrakce proměnných).

**Request:**
```json
{
  "file": "base64_encoded_file_content"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pdfBase64": "JVBERi0xLjQK...",
    "pdfSize": 45632
  }
}
```

---

## Příklady Použití

### Node.js / JavaScript
```javascript
const fs = require('fs');
const axios = require('axios');

async function convertFile() {
  // Přečtěte Word soubor
  const fileBuffer = fs.readFileSync('document.docx');
  const base64File = fileBuffer.toString('base64');

  try {
    const response = await axios.post('http://localhost:3000/convert-and-extract', {
      file: base64File
    });

    console.log('Extrahované proměnné:', response.data.data.variables);
    
    // Uložte PDF
    const pdfBuffer = Buffer.from(response.data.data.pdfBase64, 'base64');
    fs.writeFileSync('output.pdf', pdfBuffer);
  } catch (error) {
    console.error('Chyba:', error.message);
  }
}

convertFile();
```

### cURL
```bash
# Konverze a extrakce
curl -X POST http://localhost:3000/convert-and-extract \
  -H "Content-Type: application/json" \
  -d '{"file":"'$(base64 document.docx)'"}' \
  | jq '.data.variables'
```

### Python
```python
import requests
import base64
import json

with open('document.docx', 'rb') as f:
    file_base64 = base64.b64encode(f.read()).decode('utf-8')

response = requests.post(
    'http://localhost:3000/convert-and-extract',
    json={'file': file_base64}
)

data = response.json()
print("Extrahované proměnné:", data['data']['variables'])

# Uložte PDF
pdf_data = base64.b64decode(data['data']['pdfBase64'])
with open('output.pdf', 'wb') as f:
    f.write(pdf_data)
```

---

## Vzory Proměnných

Aplikace detekuje tyto vzory proměnných:

| Vzor | Příklad | Popis |
|------|---------|-------|
| `{{var}}` | `{{user_name}}` | Handlebars/Mustache styl |
| `${var}` | `${email}` | Template literal styl |
| `$var` | `$firstName` | Jednoduchý dolar prefix |
| `[VAR]` | `[USER_ID]` | Hranaté závorky s velkými písmeny |

---

## Chybové Zprávy

```json
{
  "success": false,
  "error": "Popis chyby"
}
```

Možné chyby:
- `No file provided` - Chybí parametr "file"
- `LibreOffice conversion error` - LibreOffice není nainstalován nebo neprůběh
- `Variable extraction failed` - Chyba při parsování dokumentu

---

## Troubleshooting

### LibreOffice není nalezena
Zkontrolujte cestu k LibreOffice:

```javascript
// V converter.js upravte:
libre.setLibreOfficePath('/path/to/libreoffice');
```

**Windows default:** `C:\Program Files\LibreOffice\program`
**Linux:** `/usr/bin`
**macOS:** `/Applications/LibreOffice.app/Contents/MacOS`

### Velkých souborů (>50MB)
Límit je nastaven v `server.js`. Pokud potřebujete větší soubory, upravte:

```javascript
app.use(express.json({ limit: '100mb' }));
```

---

## Struktura Projektu

```
wordapplication/
├── server.js              # Hlavní Express server
├── package.json          # Závislosti a scripts
├── .env                  # Konfigurace
├── .gitignore           # Git ignore pravidla
├── README.md            # Tato dokumentace
└── utils/
    └── converter.js     # Konverzní a extrakční logika
```

---

## Licence

MIT

---

## Podpora

Máte-li otázky nebo problémy, vytvořte GitHub issue.
