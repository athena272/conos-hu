import app from "../app";
import { getJwtSecret } from "../services/authToken";

try {
  getJwtSecret();
} catch (e) {
  console.error(e);
  process.exit(1);
}

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
