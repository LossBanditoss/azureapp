FROM node:20-bookworm-slim

# LibreOffice must be inside the container for Azure Container Apps.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends libreoffice libreoffice-writer fonts-dejavu-core ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# Nastavte pracovní adresář
WORKDIR /app

# Zkopírujte package.json a nainstalujte závislosti
COPY package.json package-lock.json ./
RUN npm ci --production

# Zkopírujte aplikaci
COPY . .

# Vystavte port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV LIBREOFFICE_PATH=/usr/bin/soffice

# Spusťte aplikaci
CMD ["npm", "start"]
