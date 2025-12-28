import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

// Helper to calculate overlaps
// Allocates horizontal space for colliding events
const resolveCollisions = (events) => {
    // Sort by start time
    const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes);
    const columns = [];

    sorted.forEach(event => {
        let placed = false;
        // Try to place in an existing column
        for (const col of columns) {
            const lastEvent = col[col.length - 1];
            if (lastEvent.endMinutes <= event.startMinutes) {
                col.push(event);
                placed = true;
                break;
            }
        }
        // If not placed, start a new column
        if (!placed) {
            columns.push([event]);
        }
    });

    const resolved = [];
    const totalCols = columns.length;
    columns.forEach((col, colIndex) => {
        col.forEach(event => {
            resolved.push({
                ...event,
                widthPercent: 100 / totalCols,
                leftPercent: (colIndex / totalCols) * 100
            });
        });
    });
    return resolved;
};

const Board = ({ schedules, date }) => {
    const daySchedules = useMemo(() =>
        schedules.filter(s => s.date === date),
        [schedules, date]
    );

    const people = useMemo(() => {
        const unique = [...new Set(daySchedules.map(s => s.name))].sort();
        // "공식 일정" always comes first
        const official = "공식 일정";
        if (unique.includes(official)) {
            return [official, ...unique.filter(p => p !== official)];
        }
        return unique;
    }, [daySchedules]);

    const HOURS_START = 8;
    const HOURS_END = 24;
    const hours = Array.from({ length: HOURS_END - HOURS_START }, (_, i) => i + HOURS_START);
    const START_MINUTES_GLOBAL = HOURS_START * 60;

    if (people.length === 0) {
        return (
            <div className="flex items-center justify-center p-20 glass-panel rounded-xl mt-4">
                <p className="text-xl text-white/50">Waiting for data... (Refresh if you added names)</p>
            </div>
        );
    }

    // Strict dimensions
    const COL_WIDTH = 110; // Reduced to fit ~10 people
    const TIME_COL_WIDTH = 60;
    const ROW_HEIGHT = 50; // Slightly more compact
    const HEADER_HEIGHT = 50;
    const GRID_HEIGHT = (HOURS_END - HOURS_START) * ROW_HEIGHT;

    return (
        <div className="mt-8 rounded-xl border border-white/20 bg-[#111] overflow-hidden relative shadow-2xl" style={{ height: '75vh' }}>
            <div className="overflow-auto w-full h-full relative">
                <div
                    className="grid relative"
                    style={{
                        gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${people.length}, ${COL_WIDTH}px)`,
                        gridTemplateRows: `${HEADER_HEIGHT}px ${GRID_HEIGHT}px`,
                        width: 'max-content'
                    }}
                >
                    {/* 1. Top-Left Corner */}
                    <div
                        className="sticky left-0 top-0 z-50 flex items-center justify-center font-bold text-white bg-[#0a0a0a] border-r border-b border-white/20 shadow-xl"
                        style={{ width: TIME_COL_WIDTH, height: HEADER_HEIGHT }}
                    >
                        Time
                    </div>

                    {/* 2. Person Headers */}
                    {people.map((person, i) => (
                        <div
                            key={person}
                            className="sticky top-0 z-40 flex items-center justify-center font-bold text-lg text-white bg-[#0a0a0a] border-r border-b border-white/20 shadow-sm"
                            style={{ gridColumnStart: i + 2, height: HEADER_HEIGHT }}
                        >
                            {person}
                        </div>
                    ))}

                    {/* 3. Time Labels (Full Height Column) */}
                    <div className="relative sticky left-0 z-30 bg-[#1a1a1a] border-r border-white/20" style={{ height: GRID_HEIGHT }}>
                        {hours.map((hour, i) => (
                            <div
                                key={`time-${hour}`}
                                className="absolute w-full flex items-center justify-center text-xs font-mono text-white/60"
                                style={{
                                    top: `${i * ROW_HEIGHT}px`,
                                    height: '20px',
                                    transform: 'translateY(-50%)'
                                }}
                            >
                                {`${hour.toString().padStart(2, '0')}:00`}
                            </div>
                        ))}
                    </div>

                    {/* 4. Content Columns */}
                    {people.map((person, pIndex) => {
                        // Resolve overlaps for this person
                        const personEvents = daySchedules.filter(s => s.name === person);
                        const resolvedEvents = resolveCollisions(personEvents);

                        return (
                            <div
                                key={`col-content-${person}`}
                                className="relative border-r border-white/10 bg-white/5"
                                style={{ gridColumnStart: pIndex + 2, height: GRID_HEIGHT }}
                            >
                                {/* Grid Lines */}
                                {hours.map((_, hIndex) => (
                                    <div
                                        key={`line-${hIndex}`}
                                        className="absolute inset-x-0 border-t border-white/10"
                                        style={{ top: `${hIndex * ROW_HEIGHT}px`, height: ROW_HEIGHT }}
                                    />
                                ))}

                                {/* Events */}
                                {resolvedEvents.map((schedule, i) => {
                                    const startY = schedule.startMinutes - START_MINUTES_GLOBAL;
                                    const duration = schedule.endMinutes - schedule.startMinutes;

                                    // Skip if out of bounds (before 8am)
                                    if (startY < 0) return null;

                                    // Special styling for "Official Schedule"
                                    const isOfficial = person === '공식 일정';
                                    const bgStyle = isOfficial
                                        ? 'linear-gradient(to bottom, #FFE5B4, #FFD700)' // Peach/Gold gradient
                                        : 'linear-gradient(to bottom, #ffffff, #e0e0e0)';

                                    // Scale minutes to pixels (ROW_HEIGHT is 50px for 60mins)
                                    const pixelsPerMinute = ROW_HEIGHT / 60;
                                    const topPx = (schedule.startMinutes - START_MINUTES_GLOBAL) * pixelsPerMinute;
                                    const heightPx = (schedule.endMinutes - schedule.startMinutes) * pixelsPerMinute;

                                    return (
                                        <motion.div
                                            key={`${person}-${i}`}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="absolute rounded flex items-center justify-center cursor-pointer hover:brightness-105 z-10 overflow-hidden"
                                            style={{
                                                top: `${topPx}px`,
                                                height: `${heightPx}px`,
                                                left: `${schedule.leftPercent}%`,
                                                width: `${schedule.widthPercent}%`,
                                                background: bgStyle,
                                                boxShadow: isOfficial
                                                    ? '0 2px 10px rgba(255, 215, 0, 0.3)'
                                                    : '0 2px 8px rgba(255, 255, 255, 0.2)',
                                                color: '#1a1a1a',
                                                border: isOfficial
                                                    ? '1px solid rgba(255, 215, 0, 0.5)'
                                                    : '1px solid rgba(0,0,0,0.1)',
                                                padding: '2px',
                                                fontFamily: 'var(--font-soft)'
                                            }}
                                        >
                                            <div className="text-center w-full px-1 flex flex-col justify-center h-full">
                                                {schedule.reason && (
                                                    <div className="text-sm font-bold leading-tight mb-0.5 truncate">{schedule.reason}</div>
                                                )}
                                                <div className="text-[11px] opacity-70 leading-tight">{schedule.start}-{schedule.end}</div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default Board;
