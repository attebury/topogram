import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { IssueListPage } from "./pages/IssueListPage";
import { IssueDetailPage } from "./pages/IssueDetailPage";
import { IssueCreatePage } from "./pages/IssueCreatePage";
import { IssueEditPage } from "./pages/IssueEditPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell" data-shell="split_view" data-windowing="multi_window" data-navigation-patterns="command_palette segmented_control stack_navigation">
        <div className="app-workspace">
          <aside className="app-sidebar">
            <Link className="brand" to="/">Topogram Issues</Link>
            <nav className="app-nav-links">
            <Link to="/issues">Issues</Link>
            </nav>
            <button className="command-palette-button" type="button">Command Palette</button>
          </aside>
          <div className="app-main-shell">
            <header className="app-nav compact">
              <div className="brand-mark">Topogram Issues</div>
              <button className="command-palette-button" type="button">Command Palette</button>
            </header>
            <main>
              <Routes>
                <Route path="/" element={<HomePage />} />
            <Route path="/issues" element={<IssueListPage />} />
            <Route path="/issues/:id" element={<IssueDetailPage />} />
            <Route path="/issues/new" element={<IssueCreatePage />} />
            <Route path="/issues/:id/edit" element={<IssueEditPage />} />
              </Routes>
            </main>
          </div>
        </div>
        <footer className="app-footer">
          <span>Generated from Topogram</span>
        </footer>

      </div>
    </BrowserRouter>
  );
}
