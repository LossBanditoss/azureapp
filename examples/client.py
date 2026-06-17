"""
Python Client Example

Instalace:
pip install requests
"""

import requests
import base64
import json
from pathlib import Path
from typing import List, Dict, Tuple

class WordConverterClient:
    def __init__(self, api_url: str = "http://localhost:3000"):
        self.api_url = api_url
        self.session = requests.Session()

    def extract_variables(self, file_path: str) -> List[str]:
        """
        Extract variables from Word document
        
        Args:
            file_path: Path to Word document
            
        Returns:
            List of extracted variables
        """
        with open(file_path, 'rb') as f:
            file_data = base64.b64encode(f.read()).decode('utf-8')

        response = self.session.post(
            f"{self.api_url}/extract-variables",
            json={"file": file_data}
        )
        response.raise_for_status()
        
        return response.json()['data']['variables']

    def convert_to_pdf(self, input_path: str, output_path: str) -> None:
        """
        Convert Word document to PDF
        
        Args:
            input_path: Path to Word document
            output_path: Output PDF path
        """
        with open(input_path, 'rb') as f:
            file_data = base64.b64encode(f.read()).decode('utf-8')

        response = self.session.post(
            f"{self.api_url}/convert-to-pdf",
            json={"file": file_data}
        )
        response.raise_for_status()

        pdf_data = base64.b64decode(response.json()['data']['pdfBase64'])
        with open(output_path, 'wb') as f:
            f.write(pdf_data)

    def convert_and_extract(self, input_path: str, output_path: str) -> Dict:
        """
        Convert Word to PDF and extract variables
        
        Args:
            input_path: Path to Word document
            output_path: Output PDF path
            
        Returns:
            Dictionary with variables and pdf path
        """
        with open(input_path, 'rb') as f:
            file_data = base64.b64encode(f.read()).decode('utf-8')

        response = self.session.post(
            f"{self.api_url}/convert-and-extract",
            json={"file": file_data}
        )
        response.raise_for_status()

        data = response.json()['data']
        pdf_data = base64.b64decode(data['pdfBase64'])
        
        with open(output_path, 'wb') as f:
            f.write(pdf_data)

        return {
            'variables': data['variables'],
            'pdf_path': output_path,
            'pdf_size': data['pdfSize']
        }


# Usage Example
def main():
    client = WordConverterClient()

    try:
        print("🔄 Zpracovávání dokumentu...\n")

        # Extract variables only
        variables = client.extract_variables('document.docx')
        print(f"📝 Extrahované proměnné: {variables}")

        # Convert and extract
        result = client.convert_and_extract('document.docx', 'output.pdf')
        print("\n✅ Hotovo!")
        print(f"📊 Proměnné: {result['variables']}")
        print(f"💾 PDF: {result['pdf_path']}")
        print(f"📈 Velikost PDF: {result['pdf_size']} bajtů")

    except requests.exceptions.ConnectionError:
        print("❌ Chyba: Nelze se připojit k serveru")
        print("Ujistěte se, že je server spuštěn: python -m http.server")
    except Exception as e:
        print(f"❌ Chyba: {str(e)}")


if __name__ == "__main__":
    main()
