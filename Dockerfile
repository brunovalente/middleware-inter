# Usa uma imagem oficial do Node.js como base
FROM node:18-bullseye

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos do projeto para o container
COPY package.json package-lock.json ./

# Instala as dependências
RUN npm install

# Copia o restante dos arquivos
COPY . .

# Expõe a porta usada pelo middleware
EXPOSE 3005

# Comando para iniciar a aplicação
CMD ["node", "server.js"]
