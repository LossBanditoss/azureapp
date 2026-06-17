FROM node:16-alpine

# Nainstalujte LibreOffice
RUN apk add --no-cache libreoffice

# Nastavte pracovní adresář
WORKDIR /app

# Zkopírujte package.json a nainstalujte závislosti
COPY package.json package-lock.json ./
RUN npm ci --production

# Zkopírujte aplikaci
COPY . .

# Vystavte port
EXPOSE 3000

# Spusťte aplikaci
CMD ["npm", "start"]
