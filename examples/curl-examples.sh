#!/bin/bash
# cURL Examples for Word to PDF Converter API

API_URL="http://localhost:3000"

echo "📋 cURL Examples for Word to PDF Converter\n"

# 1. Health Check
echo "1️⃣ Health Check"
curl -X GET "$API_URL/health" \
  -H "Content-Type: application/json" \
  | jq '.'

echo "\n---\n"

# 2. Extract Variables
echo "2️⃣ Extract Variables Only"
FILE_BASE64=$(base64 document.docx)
curl -X POST "$API_URL/extract-variables" \
  -H "Content-Type: application/json" \
  -d "{\"file\":\"$FILE_BASE64\"}" \
  | jq '.data.variables'

echo "\n---\n"

# 3. Convert to PDF
echo "3️⃣ Convert to PDF"
FILE_BASE64=$(base64 document.docx)
curl -X POST "$API_URL/convert-to-pdf" \
  -H "Content-Type: application/json" \
  -d "{\"file\":\"$FILE_BASE64\"}" \
  | jq -r '.data.pdfBase64' | base64 -d > output.pdf
echo "✅ PDF saved to output.pdf"

echo "\n---\n"

# 4. Convert and Extract
echo "4️⃣ Convert and Extract (Combined)"
FILE_BASE64=$(base64 document.docx)
RESPONSE=$(curl -s -X POST "$API_URL/convert-and-extract" \
  -H "Content-Type: application/json" \
  -d "{\"file\":\"$FILE_BASE64\"}")

# Extract variables
echo "📝 Variables:"
echo "$RESPONSE" | jq '.data.variables'

# Save PDF
echo "$RESPONSE" | jq -r '.data.pdfBase64' | base64 -d > output_combined.pdf
echo "💾 PDF saved to output_combined.pdf"

echo "\n✅ All tests completed!"
