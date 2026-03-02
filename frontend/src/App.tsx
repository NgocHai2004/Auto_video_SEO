import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import PipelineWorkspace from './pages/PipelineWorkspace';
import BatchPipeline from './pages/BatchPipeline';
import JobsDashboard from './pages/JobsDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<PipelineWorkspace />} />
          <Route path="/batch" element={<BatchPipeline />} />
          <Route path="/jobs" element={<JobsDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
