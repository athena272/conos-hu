# Imagem base (use Alpine para menor tamanho e melhor compatibilidade)
FROM node:18-alpine

WORKDIR /app

# Copiar arquivos de dependência
COPY package*.json ./

# Instalar TODAS as dependências incluindo mysql2
RUN npm install

# Copiar o restante do código APÓS instalar dependências
COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev"]