import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Orders from "./pages/Orders";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"          element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/products"  element={<Products />}  />
        <Route path="/customers" element={<Customers />} />
        <Route path="/orders"    element={<Orders />}    />
      </Routes>
    </Layout>
  );
}
