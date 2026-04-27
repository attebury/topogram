import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { ArticleListPage } from "./pages/ArticleListPage";
import { ArticleDetailPage } from "./pages/ArticleDetailPage";
import { ArticleCreatePage } from "./pages/ArticleCreatePage";
import { ArticleEditPage } from "./pages/ArticleEditPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell" data-shell="sidebar" data-windowing="single_window" data-navigation-patterns="navigation_rail tabs">
        <header className="app-nav">
          <Link className="brand" to="/">Topogram Content Approval</Link>
          <nav className="app-nav-links">
            <Link to="/articles">Articles</Link>
            <Link to="/settings">Settings</Link>
          </nav>

        </header>
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/articles" element={<ArticleListPage />} />
            <Route path="/articles/:id" element={<ArticleDetailPage />} />
            <Route path="/articles/new" element={<ArticleCreatePage />} />
            <Route path="/articles/:id/edit" element={<ArticleEditPage />} />
          </Routes>
        </main>
        <footer className="app-footer">
          <span>Generated from Topogram</span>
        </footer>

      </div>
    </BrowserRouter>
  );
}
