CREATE TABLE pacientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    prontuario BIGINT NOT NULL,
    apac VARCHAR(255) NOT NULL,
    diagnostico VARCHAR(500) NOT NULL,
    medicamento_nome VARCHAR(255) NOT NULL,
    medicamento_concentracao VARCHAR(100) NOT NULL,
    consumo_diario DECIMAL(10,2) NOT NULL,
    observacoes TEXT NULL,
    telefone VARCHAR(50) NOT NULL,
    data_liberacao DATE NOT NULL,
    retorna_servico TINYINT(1) NOT NULL,
    tipo_retorno VARCHAR(50) NULL,
    UNIQUE KEY uk_pacientes_prontuario (prontuario),
    KEY idx_pacientes_medicamento (medicamento_nome, medicamento_concentracao)
);
