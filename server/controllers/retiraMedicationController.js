const db = require("../models/db");

const retiraMedication = (req, res) => {
  const { medication_id, usuario_id, quantidade } = req.body;

  console.log("📥 Dados recebidos para retirada:", req.body);

  const quantidadeNum = parseInt(quantidade);

  if (!medication_id || !usuario_id || isNaN(quantidadeNum)) {
    console.log("❌ Dados inválidos:", { medication_id, usuario_id, quantidade });
    return res.status(400).json({
      error: "Todos os campos são obrigatórios e quantidade deve ser numérica"
    });
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error("❌ Erro ao obter conexão:", err);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        console.error("❌ Erro ao iniciar transação:", err);
        return res.status(500).json({ error: "Erro interno do servidor" });
      }

      console.log("🔍 Verificando estoque para medication_id:", medication_id);
      
      connection.query(
        "SELECT quantidade FROM medications WHERE id = ? FOR UPDATE",
        [medication_id],
        (err, result) => {
          if (err) {
            connection.rollback(() => connection.release());
            console.error("❌ Erro ao buscar medicação:", err);
            return res.status(500).json({ error: "Erro ao buscar medicação" });
          }

          if (result.length === 0) {
            connection.rollback(() => connection.release());
            console.error("❌ Medicação não encontrada, ID:", medication_id);
            return res.status(404).json({ error: "Medicação não encontrada" });
          }

          const availableQuantity = result[0].quantidade;
          console.log(`📊 Estoque disponível: ${availableQuantity}, Quantidade solicitada: ${quantidadeNum}`);

          if (availableQuantity < quantidadeNum) {
            connection.rollback(() => connection.release());
            console.log("❌ Quantidade insuficiente em estoque");
            return res.status(400).json({ error: "Quantidade insuficiente em estoque" });
          }

          console.log("📝 Registrando retirada...");
          connection.query(
            "INSERT INTO retira_medications (medication_id, usuario_id, quantidade) VALUES (?, ?, ?)",
            [medication_id, usuario_id, quantidadeNum],
            (err, insertResult) => {
              if (err) {
                connection.rollback(() => connection.release());
                console.error("❌ Erro ao registrar retirada:", err);
                return res.status(500).json({ error: "Erro ao registrar retirada" });
              }

              console.log("🔄 Atualizando estoque...");
              connection.query(
                "UPDATE medications SET quantidade = quantidade - ? WHERE id = ?",
                [quantidadeNum, medication_id],
                (err) => {
                  if (err) {
                    connection.rollback(() => connection.release());
                    console.error("❌ Erro ao atualizar estoque:", err);
                    return res.status(500).json({ error: "Erro ao atualizar estoque" });
                  }

                  connection.commit((err) => {
                    if (err) {
                      connection.rollback(() => connection.release());
                      console.error("❌ Erro ao finalizar transação:", err);
                      return res.status(500).json({ error: "Erro ao finalizar transação" });
                    }

                    connection.release();
                    console.log("✅ Retirada realizada com sucesso");
                    return res.status(200).json({ message: "Retirada realizada com sucesso" });
                  });
                }
              );
            }
          );
        }
      );
    });
  });
};

module.exports = { retiraMedication };