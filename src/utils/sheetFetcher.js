import Papa from 'papaparse';

// Mock data for development when no sheet URL is provided
// Mock data for development when no sheet URL is provided
const MOCK_DATA = [
  { name: 'Jinyo', date: '1.14', start: '10:00', end: '11:00', reason: 'Meeting' }, // Overlap 1
  { name: 'Jinyo', date: '1.14', start: '10:30', end: '11:45', reason: 'Brunch' }, // Overlap 2
  { name: 'Friend A', date: '1.14', start: '18:15', end: '22:30', reason: 'Gaming' }, // Precise minutes
  { name: 'Friend B', date: '1.15', start: '12:00', end: '16:00', reason: 'Study' },
  { name: 'Friend C', date: '1.14', start: '09:00', end: '11:00', reason: 'Gym' },
];

export const fetchScheduleData = async (sheetUrl) => {
  if (!sheetUrl) {
    console.warn('No sheet URL provided, using mock data');
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return normalizeData(MOCK_DATA);
  }

  return new Promise((resolve, reject) => {
    Papa.parse(sheetUrl, {
      download: true,
      header: true,
      complete: (results) => {
        resolve(normalizeData(results.data));
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};

const normalizeData = (rawData) => {
  return rawData.filter(row => row.name && row.date && row.start && row.end).map(row => {
    const [startH, startM] = row.start.split(':').map(Number);
    const [endH, endM] = row.end.split(':').map(Number);

    return {
      _id: Date.now() + Math.random().toString(36).substr(2, 9), // Synthetic ID for UI tracking
      name: row.name.trim(),
      date: row.date.trim(),
      start: row.start.trim(),
      end: row.end.trim(),
      reason: row.reason ? row.reason.trim() : '',
      startMinutes: startH * 60 + startM,
      endMinutes: endH * 60 + endM,
    };
  });
};
