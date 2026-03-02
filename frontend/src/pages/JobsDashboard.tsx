import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import PageHeader from '../components/layout/PageHeader';
import JobsTable from '../components/jobs/JobsTable';
import JobDetailPanel from '../components/jobs/JobDetailPanel';

export default function JobsDashboard() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        icon={<BarChart3 className="h-5 w-5" />}
        title="Jobs Dashboard"
        subtitle="View all batch pipeline jobs and their results"
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Jobs Table */}
        <div className={`glass-card p-5 ${selectedJobId ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
          <JobsTable onSelectJob={setSelectedJobId} selectedJobId={selectedJobId} />
        </div>

        {/* Job Detail Panel */}
        <AnimatePresence>
          {selectedJobId && (
            <div className="lg:col-span-2">
              <JobDetailPanel
                key={selectedJobId}
                jobId={selectedJobId}
                onClose={() => setSelectedJobId(null)}
              />
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
