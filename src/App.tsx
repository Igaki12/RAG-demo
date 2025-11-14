import { Route, Routes } from 'react-router-dom';
import AppShell from './routes/AppShell';

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />} />
    </Routes>
  );
}

export default App;
