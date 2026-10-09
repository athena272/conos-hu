import "primeicons/primeicons.css";
import "primereact/resources/themes/lara-light-cyan/theme.css";
import "primereact/resources/primereact.min.css";
import "./styles/design-tokens.css";
import AppRoutes from "../AppRouters";
import { PrimeReactProvider } from "primereact/api";

function App() {
  return (
    <PrimeReactProvider>
      <div className="app">
        <AppRoutes />
      </div>
    </PrimeReactProvider>
  );
}

export default App;
