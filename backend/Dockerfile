# Imagem base (use Alpine para menor tamanho e melhor compatibilidade)
FROM node:18-alpine

WORKDIR /app

# Copiar arquivos de dependência
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar o restante do código
COPY . .

# Compilar TypeScript
RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]