import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Workflow, Package, BarChart3, Settings, Clapperboard } from 'lucide-react';

const navItems = [
  { to: '/', icon: Workflow, label: 'Pipeline Workspace' },
  { to: '/batch', icon: Package, label: 'Batch Pipeline' },
  { to: '/jobs', icon: BarChart3, label: 'Jobs Dashboard' },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-16 flex flex-col items-center py-4 bg-[#0d0d14] border-r border-slate-800/50 z-50">
      {/* Logo */}
      <div className="mb-8">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center">
          <Clapperboard className="h-5 w-5 text-white" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group relative flex items-center justify-center h-11 w-11 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-violet-600/20 text-violet-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-violet-600/20 border border-violet-500/30"
                    transition={{ duration: 0.2 }}
                  />
                )}
                <Icon className="h-5 w-5 relative z-10" />
                {/* Tooltip */}
                <span className="absolute left-full ml-3 px-2 py-1 rounded bg-slate-800 text-xs text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Settings */}
      <button
        type="button"
        className="group relative flex items-center justify-center h-11 w-11 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-all duration-200"
      >
        <Settings className="h-5 w-5" />
        <span className="absolute left-full ml-3 px-2 py-1 rounded bg-slate-800 text-xs text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
          Settings
        </span>
      </button>
    </aside>
  );
}
