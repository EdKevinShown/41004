import { NavLink, Route, Routes } from "react-router-dom";
import { OverviewPage } from "./pages/OverviewPage";
import { CouncilComparisonPage } from "./pages/CouncilComparisonPage";
import { ChartsPage } from "./pages/ChartsPage";
import { CaseExplorerPage } from "./pages/CaseExplorerPage";

function TopNav() {
  const base =
    "rounded-md px-3 py-2 text-sm font-medium transition-colors";
  const inactive = "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
  const active = "bg-slate-900 text-white hover:bg-slate-900";

  return (
    <nav className="flex flex-wrap gap-2">
      <NavLink to="/" end className={({ isActive }) => `${base} ${isActive ? active : inactive}`}>
        Overview
      </NavLink>
      <NavLink
        to="/councils"
        className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
      >
        Council Comparison
      </NavLink>
      <NavLink
        to="/charts"
        className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
      >
        Charts
      </NavLink>
      <NavLink
        to="/explorer"
        className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
      >
        Case Explorer
      </NavLink>
    </nav>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-3xl font-semibold tracking-tight text-slate-900">
                NSW Council DA Transparency Dashboard
              </div>
              <div className="mt-2 max-w-3xl text-sm text-slate-600">
                A comparative dashboard for development application transparency across selected NSW
                councils
              </div>
            </div>
            <TopNav />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-7">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/councils" element={<CouncilComparisonPage />} />
          <Route path="/charts" element={<ChartsPage />} />
          <Route path="/explorer" element={<CaseExplorerPage />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl space-y-1 px-6 py-4 text-xs text-slate-500">
          <div>
            Data source: Standardised records collected from selected NSW council DA tracking portals.
          </div>
          <div>
            Scores are comparative transparency indicators based on visible portal evidence. They do
            not assess the quality of council planning decisions.
          </div>
        </div>
      </footer>
    </div>
  );
}
