import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AuthProvider } from "./auth";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ReactFlowProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ReactFlowProvider>
  </StrictMode>,
);
