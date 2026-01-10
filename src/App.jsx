import React, { useEffect, useState } from 'react';
import { fetchScheduleData } from './utils/sheetFetcher';
import Board from './components/Board';
// Import CreationModal and API utility
import CreationModal from './components/CreationModal';
import { saveScheduleToSheet } from './utils/sheetApi';
import './App.css';

function App() {
  const [schedules, setSchedules] = useState([]);
  const [people, setPeople] = useState([]); // List of all users from sheet
  const [date, setDate] = useState('1.14'); // Default date
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState(null);

  // Google Sheet ID from user
  const SHEET_ID = '1joNaSibQKRE_yS1qJbssRL39uCmHf5BmNbSUvR6GhaQ';
  // Standard CSV export URL for "Anyone with the link" shared sheets
  const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
  // Direct Edit URL for users
  const SHEET_EDIT_URL = 'https://docs.google.com/spreadsheets/d/1joNaSibQKRE_yS1qJbssRL39uCmHf5BmNbSUvR6GhaQ/edit?usp=sharing';

  // !!! PLACEHOLDER: This will be filled by the user later !!!
  const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxspOWWJO1qmUBWivR6OIXs3O9hNjyUig7amntxxGng5wW1Ehj9qyEtmaHDj7UC0YWY/exec';

  const loadData = async () => {
    setLoading(true);
    try {
      const { schedules: fetchedSchedules, users: fetchedUsers } = await fetchScheduleData(SHEET_URL);
      setSchedules(fetchedSchedules);
      setPeople(fetchedUsers);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Called when user finishes dragging on the Board
  const handleScheduleCreate = (data) => {
    setModalData(data); // { name, date, startTime, endTime }
    setIsModalOpen(true);
  };

  // Called when user clicks "Save" in the Modal
  const handleSaveSchedule = async (formData) => {
    try {
      if (!GOOGLE_APPS_SCRIPT_URL) {
        alert("아직 Google Apps Script URL이 설정되지 않았습니다.\n(구글 시트 연동 설정이 필요합니다)");
        return;
      }

      await saveScheduleToSheet(formData, GOOGLE_APPS_SCRIPT_URL);
      alert('일정이 저장되었습니다!');
      setIsModalOpen(false);
      // Refresh data
      loadData();
    } catch (error) {
      console.error("Save failed", error);
      alert('저장 실패: ' + error.message);
    }
  };

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
          <p className="text-white/30 text-xs mt-2 md:hidden">
            * 빈 공간을 빠르게 두 번 탭하여 새 일정 만들기<br />
            * 일정을 꾹 누르고 드래그하여 시간 수정<br />
            * 일정을 짧게 탭하여 삭제
          </p>
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
        <Board
          schedules={schedules}
          people={people}
          date={date}
          onScheduleCreate={handleScheduleCreate}
          onScheduleUpdate={(original, updated) => {
            // Optimistic Update using _id
            setSchedules(prev => prev.map(s => {
              if (s._id && s._id === original._id) {
                // Calculate new minute values for correct rendering
                const [startH, startM] = updated.startTime.split(':').map(Number);
                const [endH, endM] = updated.endTime.split(':').map(Number);
                return {
                  ...s, // Keep _id
                  ...updated,
                  start: updated.startTime,
                  end: updated.endTime,
                  startMinutes: startH * 60 + startM,
                  endMinutes: endH * 60 + endM
                };
              }
              return s;
            }));

            // Sync with backend
            saveScheduleToSheet(updated, GOOGLE_APPS_SCRIPT_URL, 'edit', original)
              .then(() => {
                // Optional: Reload to ensure consistency, but might cause flicker
                // loadData(); 
                console.log("Synced successfully.");
              })
              .catch(e => {
                alert('수정 실패 (되돌립니다): ' + e);
                loadData(); // Revert on failure
              });
          }}
          onScheduleDelete={(schedule) => {
            // Optimistic Update using _id
            setSchedules(prev => prev.filter(s => s._id !== schedule._id));

            // Sync with backend
            saveScheduleToSheet(schedule, GOOGLE_APPS_SCRIPT_URL, 'delete', schedule)
              .then(() => {
                console.log("Deleted successfully.");
                // loadData(); 
              })
              .catch(e => {
                alert('삭제 실패 (되돌립니다): ' + e);
                loadData(); // Revert on failure
              });
          }}
        />
      )}

      {/* Creation Modal */}
      <CreationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={modalData}
        onSave={handleSaveSchedule}
      />
    </div>
  );
}

export default App;
