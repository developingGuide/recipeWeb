import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/Homepage";
import RecipeDetailsPage from "./pages/RecipeDetailsPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/recipe/:id" element={<RecipeDetailsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;