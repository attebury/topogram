import { Route, Routes } from "react-router-dom";

export function App() {
  return (
    <Routes>
      <Route path="/tasks" element={<div>Tasks</div>} />
      <Route path="/tasks/new" element={<div>Create Task</div>} />
      <Route path="/tasks/:id" element={<div>Task Detail</div>} />
      <Route path="/tasks/:id/edit" element={<div>Edit Task</div>} />
    </Routes>
  );
}
