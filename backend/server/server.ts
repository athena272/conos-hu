import app from "../app";
import { connectMongo } from "../models/mongo";
import { getJwtSecret } from "../services/authToken";

const PORT = process.env.PORT || 3001;

connectMongo()
  .then(() => {
    try {
      getJwtSecret();
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
    });
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
