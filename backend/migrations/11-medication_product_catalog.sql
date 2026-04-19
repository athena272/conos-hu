-- Catálogo opcional GTIN → dados para autopreenchimento no cadastro por código de barras
CREATE TABLE IF NOT EXISTS medication_product_catalog (
    id INT AUTO_INCREMENT PRIMARY KEY,
    gtin VARCHAR(14) NOT NULL,
    nome VARCHAR(255) NULL,
    concentracao VARCHAR(100) NULL,
    forma ENUM('1', '2', '3', '4') NULL,
    classificacao CHAR(1) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_medication_product_catalog_gtin (gtin)
);
