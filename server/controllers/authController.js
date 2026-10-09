const db = require("../models/db");
const bcrypt = require("bcryptjs");

const registerUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    db.query("SELECT * FROM usuarios WHERE email = ?", [email], async (err, results) => {
      if (err) {
        console.error("Erro ao buscar usuário:", err);
        return res.status(500).json({ message: "Erro no servidor", error: err.message });
      }

      if (results.length > 0) {
        return res.status(409).json({ message: "Usuário já cadastrado" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      db.query(
        "INSERT INTO usuarios (email, password) VALUES (?, ?)",
        [email, hashedPassword],
        (insertErr) => {
          if (insertErr) {
            console.error("Erro ao registrar usuário:", insertErr);
            return res.status(500).json({ message: "Erro no servidor", error: insertErr.message });
          }

          res.status(201).json({ message: "Usuário criado com sucesso" });
        }
      );
    });
  } catch (err) {
    console.error("Erro inesperado:", err);
    res.status(500).json({ message: "Erro no servidor", error: err.message });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    db.query(
      "SELECT idusuarios, email, password FROM usuarios WHERE email = ?",
      [email],
      async (err, results) => {
        if (err) {
          console.error("Erro ao buscar usuário:", err);
          return res.status(500).json({ message: "Erro no servidor", error: err.message });
        }

        if (results.length === 0) {
          return res.status(401).json({ message: "Usuário não encontrado" });
        }

        const user = results[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
          return res.status(401).json({ message: "Senha incorreta" });
        }

        res.status(200).json({
          message: "Login realizado com sucesso",
          userId: user.idusuarios,
        });
      }
    );
  } catch (err) {
    console.error("Erro inesperado:", err);
    res.status(500).json({ message: "Erro no servidor", error: err.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
};