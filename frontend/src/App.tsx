import "primeicons/primeicons.css";
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
