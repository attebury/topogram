import { Route, Routes } from "react-router-dom";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<div>Login</div>} />
      <Route path="/onboarding/setup" element={<div>Onboarding</div>} />
      <Route path="/settings/profile" element={<div>Settings</div>} />
      <Route path="/dashboard" element={<div>Dashboard</div>} />
      <Route path="/search" element={<div>Search</div>} />
      <Route path="/approvals/review" element={<div>Approvals</div>} />
    </Routes>
  );
}
