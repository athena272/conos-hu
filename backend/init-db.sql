-- Opcional / referência: o schema completo e as migrações leves são aplicados na primeira
-- conexão da API (veja backend/models/db.ts). Use este script apenas para bootstrap manual
-- em um MySQL onde você não vá subir a API de imediato, ou como documentação legada.
--
-- Com Docker Compose na raiz do projeto, o banco e o usuário da app já são criados pelas
-- variáveis MYSQL_*; não é necessário executar este arquivo para o fluxo local com Docker.

-- Criar database se não existir
CREATE DATABASE IF NOT EXISTS conos;

-- Criar usuário se não existir e conceder privilégios (ajuste a senha antes de rodar)
CREATE USER IF NOT EXISTS 'conos'@'%' IDENTIFIED BY 'changeme_local_only';
GRANT ALL PRIVILEGES ON conos.* TO 'conos'@'%';
FLUSH PRIVILEGES;

USE conos;

-- Criar tabela usuários (role: admin = CRUD completo; viewer = somente leitura; novos cadastros = viewer)
CREATE TABLE IF NOT EXISTS usuarios (
    idusuarios INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'viewer') NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar tabela medications
CREATE TABLE IF NOT EXISTS medications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    lote VARCHAR(100) NOT NULL,
    quantidade INT NOT NULL,
    classificacao VARCHAR(100),
    concentracao  VARCHAR(100) NOT NULL,
    forma ENUM('1', '2', '3', '4') NOT NULL,
    data_validade DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar tabela retira_medications
CREATE TABLE IF NOT EXISTS retira_medications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    medication_id INT NOT NULL,
    usuario_id INT NOT NULL,
    quantidade INT NOT NULL,
    data_retirada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medications(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(idusuarios)
);

-- Usuário de teste admin (opcional). Hash bcrypt corresponde à senha literal: password
INSERT IGNORE INTO usuarios (email, password, role) VALUES 
('admin@conos.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
