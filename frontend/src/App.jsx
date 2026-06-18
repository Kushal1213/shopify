import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Orders from "./pages/Orders";
import MLForecast from "./pages/MLForecast";
import MLSegment from "./pages/MLSegment";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"           element={<Dashboard />}   />
        <Route path="/analytics"  element={<Analytics />}   />
        <Route path="/products"   element={<Products />}    />
        <Route path="/customers"  element={<Customers />}   />
        <Route path="/orders"     element={<Orders />}      />
        <Route path="/ml/forecast" element={<MLForecast />} />
        <Route path="/ml/segment"  element={<MLSegment />}  />
      </Routes>
    </Layout>
  );
}
