import React, { useEffect, useState } from 'react';
import { fetchScheduleData } from './utils/sheetFetcher';
import Board from './components/Board';
import './App.css';

function App() {
  const [schedules, setSchedules] = useState([]);
  const [date, setDate] = useState('1.14'); // Default date
  const [loading, setLoading] = useState(true);

  // Google Sheet ID from user
  const SHEET_ID = '1joNaSibQKRE_yS1qJbssRL39uCmHf5BmNbSUvR6GhaQ';
  // Standard CSV export URL for "Anyone with the link" shared sheets
  const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
  // Direct Edit URL for users
  const SHEET_EDIT_URL = 'https://docs.google.com/spreadsheets/d/1joNaSibQKRE_yS1qJbssRL39uCmHf5BmNbSUvR6GhaQ/edit?usp=sharing';

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchScheduleData(SHEET_URL);
      setSchedules(data);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Placeholder for DateSwitcher component if it were defined elsewhere
  const DateSwitcher = ({ date, setDate }) => (
    <div className="p-1 rounded-2xl glass-panel inline-flex">
      {['1.14', '1.15'].map(d => (
        <button
          key={d}
          onClick={() => setDate(d)}
          className={`
            px-8 py-3 rounded-xl text-lg font-bold transition-all duration-300
            ${date === d
              ? 'bg-white text-black shadow-lg scale-105'
              : 'text-white/40 hover:text-white hover:bg-white/5'
            }
          `}
        >
          Jan {d.split('.')[1]}
        </button>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto px-2 py-6 max-w-[95vw]">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl text-white tracking-widest" style={{ fontFamily: 'var(--font-title)' }}>
            붕모 스케줄
          </h1>
          <p className="text-white/40 mt-1">Friends' Timeline</p>
        </div>

        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <button
            onClick={loadData}
            className="px-4 py-2 rounded-full text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-white"
          >
            Refresh
          </button>
          <a
            href={SHEET_EDIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white text-black hover:bg-gray-200 px-4 py-2 rounded-lg font-bold transition-colors"
          >
            <span>+</span> Add Schedule
          </a>
        </div>
      </header>

      {/* Date Switcher */}
      <div className="flex justify-center mb-8">
        <div className="p-1 rounded-2xl glass-panel inline-flex">
          {['1.14', '1.15'].map(d => (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={`
                px-8 py-3 rounded-xl text-lg font-bold transition-all duration-300
                ${date === d
                  ? 'bg-white text-black shadow-lg scale-105'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
                }
              `}
            >
              Jan {d.split('.')[1]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Board */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-cyan-400 animate-pulse font-mono">LOADING_GRID...</div>
        </div>
      ) : (
        <Board schedules={schedules} date={date} />
      )}
    </div>
  );
}

export default App;
