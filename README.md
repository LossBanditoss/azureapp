# Word to PDF Converter & Variable Extractor

Node.js aplikace pro extrakci placeholders z Word dokumentu a asynchronni generovani PDF z DOCX sablony.

## Features

- ✅ Konverze Word (.doc, .docx) do PDF pres LibreOffice
- ✅ Extrakce variable placeholders z dokumentu
- ✅ Asynchronni batch generovani PDF z JSON dat
- ✅ Callback odeslani vygenerovanych PDF na dalsi REST endpoint
- ✅ Podpora vice vzoru promennych ({{var}}, ${var}, $var, [VAR], {var})
- ✅ Base64 vstup a JSON response format
- ✅ Pripraveno pro Windows i Azure Container Apps

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

### Azure / Docker

Docker image uz obsahuje LibreOffice. V Azure Container Apps tedy neni potreba LibreOffice instalovat rucne na hostiteli, musi byt jen soucasti image buildu z Dockerfile.

Doporucene environment variables v Azure:

```text
NODE_ENV=production
PORT=3000
LIBREOFFICE_PATH=/usr/bin/soffice
MAX_FILE_SIZE_MB=50
CALLBACK_TIMEOUT_MS=15000
```

Doporucene auth promene pro test:

```text
BASIC_AUTH_USER=testuser
BASIC_AUTH_PASS=test1234
```

## API Endpoints

### 1. `/health` (GET)
Zdravotnostni check.

**Response:**
```json
{
  "status": "OK"
}
```

---

### 2. `/api/template/extract-variables` (POST)
PBI endpoint pro ServiceNow. Prijme Base64 DOCX a vrati seznam extrahovanych promennych.

Authorization (test):
- Basic Auth (`BASIC_AUTH_USER` / `BASIC_AUTH_PASS`)

Authorization (alternativa):
- Bearer token (`EXTRACTION_AUTH_TOKEN`)

**Request:**
```json
{
  "conversionId": "generated_conversion_id",
  "recordSysId": "mass_mailing_sys_id",
  "attachmentSysId": "word_template_attachment_sys_id",
  "fileName": "CoverLetterTemplate.docx",
  "encodedWord": "base64_encoded_docx"
}
```

**Response success:**
```json
{
  "conversionId": "generated_conversion_id",
  "status": "success",
  "variables": [
    "System_Account_Manager",
    "u_relevant_partner",
    "u_new_target_system.u_sys_srs_status"
  ]
}
```

**Response error:**
```json
{
  "conversionId": "generated_conversion_id",
  "status": "failed",
  "errorCode": "DOCX_PROCESSING_FAILED",
  "message": "The uploaded Word document could not be processed."
}
```

---

### 3. `/extract-placeholders` (POST)
Jednoduchy helper endpoint pro lokalni test extrakce mimo PBI payload.

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
    "placeholders": ["invoiceNumber", "name", "USER_ID"],
    "count": 3
  }
}
```

---

### 4. `/generate-pdf-batch` (POST)
Prijme DOCX sablonu, data objekt nebo pole objektu a callback URL. Pro kazdou polozku vyrenderuje PDF a posle ho na callback.

**Request:**
```json
{
  "file": "base64_encoded_file_content",
  "data": [
    {
      "name": "Jan Novak",
      "invoiceNumber": "INV-001"
    },
    {
      "name": "Eva Svobodova",
      "invoiceNumber": "INV-002"
    }
  ],
  "callbackUrl": "https://example.service-now.com/api/x_scope/pdf/callback",
  "callbackHeaders": {
    "Authorization": "Bearer token"
  }
}
```

**Response:**
```json
{
  "status": "accepted"
}
```

---

## Příklady Použití

### ServiceNow / PBI request (cURL)
```bash
curl -X POST http://localhost:3000/api/template/extract-variables \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic dGVzdHVzZXI6dGVzdDEyMzQ=" \
  -d '{
    "conversionId":"generated_conversion_id",
    "recordSysId":"mass_mailing_sys_id",
    "attachmentSysId":"word_template_attachment_sys_id",
    "fileName":"CoverLetterTemplate.docx",
    "encodedWord":"base64_encoded_docx"
  }'
```

### Node.js / JavaScript (helper endpoint)
```javascript
const fs = require('fs');
const axios = require('axios');

async function convertFile() {
  // Přečtěte Word soubor
  const fileBuffer = fs.readFileSync('document.docx');
  const base64File = fileBuffer.toString('base64');

  try {
    const response = await axios.post('http://localhost:3000/extract-placeholders', {
      file: base64File
    });

    console.log('Extrahovane placeholders:', response.data.data.placeholders);
  } catch (error) {
    console.error('Chyba:', error.message);
  }
}

convertFile();
```

### cURL
```bash
# Extrakce placeholders (helper endpoint)
curl -X POST http://localhost:3000/extract-placeholders \
  -H "Content-Type: application/json" \
  -d '{"file":"'$(base64 document.docx)'"}' \
  | jq '.data.placeholders'
```

### Python
```python
import requests
import base64
import json

with open('document.docx', 'rb') as f:
    file_base64 = base64.b64encode(f.read()).decode('utf-8')

response = requests.post(
  'http://localhost:3000/extract-placeholders',
    json={'file': file_base64}
)

data = response.json()
print("Extrahovane placeholders:", data['data']['placeholders'])
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

Mozne chyby:
- `No file provided` - Chybí parametr "file"
- `LibreOffice conversion error` - LibreOffice neni v image nebo nebyla nalezena binarka `soffice`
- `Variable extraction failed` - Chyba pri parsovani dokumentu

---

## Troubleshooting

### LibreOffice neni nalezena
Nastavte `LIBREOFFICE_PATH` na adresar nebo plnou cestu k binarce `soffice`.

- Windows: `C:\Program Files\LibreOffice\program` nebo `C:\Program Files\LibreOffice\program\soffice.exe`
- Linux: `/usr/bin/soffice`
- macOS: `/Applications/LibreOffice.app/Contents/MacOS/soffice`

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
