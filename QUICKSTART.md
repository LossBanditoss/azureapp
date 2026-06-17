# Quickstart Guide

Jak začít s Word to PDF Converter & Variable Extractor v 5 minut.

## 1. Instalace

```bash
# Klonujte/vytvořte projekt
cd wordapplication

# Nainstalujte Node.js závislosti
npm install
```

## 2. Instalace LibreOffice

### Windows
1. Jděte na https://www.libreoffice.org/download/
2. Stáhněte verzi pro Windows
3. Spusťte instalátor
4. Výchozí cesta: `C:\Program Files\LibreOffice\program`

### macOS
```bash
brew install libreoffice
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install libreoffice libreoffice-writer
```

## 3. Spuštění Serveru

```bash
npm start
```

Měli byste vidět:
```
Server is running on port 3000
POST /convert-and-extract - Convert Word to PDF and extract variables
POST /extract-variables - Extract variables only
POST /convert-to-pdf - Convert to PDF only
```

## 4. Testování

### Vytvoření Test Dokumentu
Vytvořte Word dokument (document.docx) s těmito proměnnými:
- `{{user_name}}`
- `${email}`
- `$phone`
- `[USER_ID]`

### Test s Node.js
```bash
node test.js
```

### Test s cURL
```bash
# Extrakce proměnných
curl -X POST http://localhost:3000/extract-variables \
  -H "Content-Type: application/json" \
  -d '{"file":"'$(base64 document.docx)'"}'
```

### Test s Python
```bash
python examples/client.py
```

## 5. Integrace do vaší Aplikace

### JavaScript
```javascript
const WordConverterClient = require('./examples/client');
const client = new WordConverterClient();

const variables = await client.extractVariables('document.docx');
console.log(variables); // ['email', 'phone', 'user_name', 'USER_ID']
```

### Python
```python
from examples.client import WordConverterClient

client = WordConverterClient()
variables = client.extract_variables('document.docx')
print(variables)  # ['email', 'phone', 'user_name', 'USER_ID']
```

## Troubleshooting

### "LibreOffice not found"
Upravte cestu v `utils/converter.js`:
```javascript
libre.setLibreOfficePath('C:\\Program Files\\LibreOffice\\program');
```

### "Cannot find module 'libreoffice-convert'"
```bash
npm install libreoffice-convert
```

### Server se neresponde
- Zkontrolujte, že port 3000 není obsazen
- Restartujte server: `npm start`

---

Nyní jste připraveni! 🚀
