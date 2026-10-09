const db = require("../models/db");

const registerMedication = (req, res) => {
  const {
    nome,
    lote,
    quantidade,
    classificacao,
    concentracao,
    forma,
    data_validade,
  } = req.body;

  if (!nome || !lote || !quantidade || !data_validade) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }

  db.query(
    "INSERT INTO medications (nome, lote, quantidade, classificacao, concentracao, forma, data_validade) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [nome, lote, quantidade, classificacao, concentracao, forma, data_validade],
    (err, result) => {
      if (err) {
        console.error("Erro ao registrar medicação:", err);
        return res.status(500).json({ error: "Erro ao registrar a medicação" });
      }
      return res
        .status(201)
        .json({ message: "Medicação registrada com sucesso" });
    }
  );
};

const getMedications = (req, res) => {
  db.query("SELECT * FROM medications", (err, result) => {
    if (err) {
      console.error("Erro ao buscar medicações:", err);
      return res.status(500).json({ error: "Erro ao buscar medicações" });
    }

    const hoje = new Date();

    const medicationsWithStatus = result.map((med) => {
      const validade = new Date(med.data_validade);
      let status = "";

      if (med.quantidade <= 0) {
        status = "emFalta";
      } else if (validade < hoje) {
        status = "foraValidade";
      } else if ((validade - hoje) / (1000 * 60 * 60 * 24) <= 90) {
        status = "proximoVencer";
      } else {
        status = "emEstoque";
      }

      return {
        ...med,
        status,
      };
    });

    res.status(200).json(medicationsWithStatus);
  });
};


const getValidade = (req, res) => {
  db.query(
    "SELECT * FROM medications WHERE data_validade < CURDATE()",
    (err, result) => {
      if (err) {
        console.error("Erro ao buscar medicações vencidas:", err);
        return res
          .status(500)
          .json({ error: "Erro ao buscar medicações vencidas" });
      }
      return res.status(200).json(result);
    }
  );
};

const getQuantity = (req, res) => {
  db.query(
    "SELECT SUM(quantidade) AS total FROM medications",
    (err, result) => {
      if (err) {
        console.error("Erro ao buscar a quantidade de medicações", err);
        return res
          .status(500)
          .json({ error: "Erro ao buscar a quantidade de medicações" });
      }
      return res.status(200).json({ total: result[0].total || 0 });
    }
  );
};

const searchMedication = (req, res) => {
  const { nome, concentracao } = req.body;

  if (!nome || !concentracao) {
    return res
      .status(400)
      .json({ error: "Nome e concentração são obrigatórios" });
  }

  db.query(
    "SELECT * FROM medications WHERE nome = ? AND concentracao = ? LIMIT 1",
    [nome, concentracao],
    (err, results) => {
      if (err) {
        console.error("Erro ao buscar medicação:", err);
        return res.status(500).json({ error: "Erro ao buscar medicação" });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: "Medicação não encontrada" });
      }

      res.status(200).json(results[0]);
    }
  );
};

module.exports = {
  registerMedication,
  getMedications,
  getValidade,
  getQuantity,
  searchMedication,
};
