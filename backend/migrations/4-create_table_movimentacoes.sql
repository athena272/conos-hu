CREATE TABLE movimentacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('entrada', 'saida') NOT NULL,
    medication_id INT NOT NULL,
    quantidade INT NOT NULL,
    usuario_id INT NULL,
    data_movimentacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medications(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(idusuarios)
);
