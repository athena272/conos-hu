-- Papéis de acesso: admin (CRUD completo) e viewer (somente leitura).
-- Novos cadastros recebem viewer por padrão (DEFAULT na coluna).

USE conos;

ALTER TABLE usuarios
  ADD COLUMN role ENUM('admin', 'viewer') NOT NULL DEFAULT 'viewer';

-- Após aplicar a coluna, defina um único administrador (substitua o e-mail):
-- UPDATE usuarios SET role = 'viewer';
-- UPDATE usuarios SET role = 'admin' WHERE email = 'seu-admin@exemplo.com';
