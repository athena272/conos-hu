CREATE TABLE medications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    lote VARCHAR(100) NOT NULL,
    data_validade DATE NOT NULL,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    quantidade INT NOT NULL
);

ALTER TABLE medications
ADD COLUMN classificacao CHAR(1) NOT NULL,
ADD COLUMN concentracao VARCHAR(100) NOT NULL,
ADD COLUMN forma ENUM('1', '2', '3', '4') NOT NULL;