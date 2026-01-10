import React, { useMemo, useState, useRef } from 'react';
import { motion, useDragControls } from 'framer-motion';

const ScheduleBlock = ({
    schedule,
    style,
    handlers,
    isMoving,
    isResizing
}) => {
    const controls = useDragControls();

    const isOfficial = schedule.name === '공식 일정';
    const bgStyle = isOfficial ? 'linear-gradient(to bottom, #FFE5B4, #FFD700)' : 'linear-gradient(to bottom, #ffffff, #e0e0e0)';
    const boxShadow = isOfficial ? '0 2px 10px rgba(255, 215, 0, 0.3)' : '0 2px 8px rgba(255, 255, 255, 0.2)';
    const border = isOfficial ? '1px solid rgba(255, 215, 0, 0.5)' : '1px solid rgba(0,0,0,0.1)';

    return (
        <motion.div
            drag={!isResizing}
            dragListener={false} // Disable default listeners
            dragControls={controls} // Manual control
            dragMomentum={false}
            dragElastic={0}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            onDragStart={(e, info) => handlers.onDragStart(e, info, schedule)}
            onDrag={(e, info) => handlers.onDrag(e, info, schedule)}
            onDragEnd={(e, info) => handlers.onDragEnd(e, info, schedule)}
            onContextMenu={(e) => handlers.onContextMenu(e, schedule)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: (isMoving || isResizing) ? 0.3 : 1, scale: 1 }}
            className="absolute rounded flex flex-col hover:brightness-105 overflow-visible"
            style={{
                ...style,
                background: bgStyle,
                boxShadow: boxShadow,
                color: '#1a1a1a',
                border: border,
                padding: '2px',
                fontFamily: 'var(--font-soft)',
                zIndex: (isMoving || isResizing) ? 100 : 10,
                cursor: 'default' // Default cursor for the container
            }}
        >
            {/* Top Resize Handle */}
            <div
                className="absolute top-0 left-0 right-0 h-4 cursor-ns-resize hover:bg-blue-400/30 z-30"
                onMouseDown={(e) => handlers.onResizeStart(e, 'top', schedule)}
                style={{ marginTop: '-8px' }}
            />

            {/* Content Area - DRAGGABLE */}
            <div
                className="flex-1 w-full px-1 flex flex-col justify-center cursor-move"
                onPointerDown={(e) => {
                    e.stopPropagation(); // Stop parent creation handler
                    // Start drag ONLY when clicking here
                    controls.start(e);
                }}
                onMouseDown={(e) => e.stopPropagation()} // Strict bubbling prevention
            >
                {schedule.reason && <div className="text-sm font-bold leading-tight mb-0.5 truncate pointer-events-none">{schedule.reason}</div>}
                <div className="text-[11px] opacity-70 leading-tight pointer-events-none">{schedule.start}-{schedule.end}</div>
            </div>

            {/* Bottom Resize Handle */}
            <div
                className="absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize hover:bg-blue-400/30 z-30"
                onMouseDown={(e) => handlers.onResizeStart(e, 'bottom', schedule)}
                style={{ marginBottom: '-8px' }}
            />
        </motion.div>
    );
};

const resolveCollisions = (events) => {
    const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes);
    const columns = [];
    sorted.forEach(event => {
        let placed = false;
        for (const col of columns) {
            const lastEvent = col[col.length - 1];
            if (lastEvent.endMinutes <= event.startMinutes) {
                col.push(event);
                placed = true;
                break;
            }
        }
        if (!placed) columns.push([event]);
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

const Board = ({ schedules, date, onScheduleCreate, onScheduleUpdate, onScheduleDelete }) => {
    const daySchedules = useMemo(() => schedules.filter(s => s.date === date), [schedules, date]);
    const people = useMemo(() => {
        // Use 'schedules' (all data) instead of 'daySchedules' to ensure columns persist
        // even on days with no events.
        const unique = [...new Set(schedules.map(s => s.name))].sort();
        const official = "공식 일정";
        if (unique.includes(official)) {
            return [official, ...unique.filter(p => p !== official)];
        }
        return unique;
    }, [schedules]);

    const [dragState, setDragState] = useState({
        isDragging: false,
        startY: 0,
        currentY: 0,
        person: null,
        colIndex: -1
    });

    const [moveState, setMoveState] = useState({
        isMoving: false,
        original: null,
        targetPerson: null,
        targetColIndex: -1,
        snappedY: 0,
        dragOffsetY: 0 // Offset from top of block
    });

    const [resizeState, setResizeState] = useState({
        isResizing: false,
        original: null,
        edge: null, // 'top' or 'bottom'
        newStartY: 0,
        newEndY: 0
    });

    const containerRef = useRef(null);

    const HOURS_START = 8;
    const HOURS_END = 24;
    const hours = Array.from({ length: HOURS_END - HOURS_START }, (_, i) => i + HOURS_START);
    const START_MINUTES_GLOBAL = HOURS_START * 60;
    const COL_WIDTH = 110;
    const TIME_COL_WIDTH = 60;
    const ROW_HEIGHT = 50;
    const HEADER_HEIGHT = 50;
    const GRID_HEIGHT = (HOURS_END - HOURS_START) * ROW_HEIGHT;
    const PIXELS_PER_MINUTE = ROW_HEIGHT / 60;
    const SNAP_INTERVAL_MINUTES = 15;
    const SNAP_INTERVAL_PX = SNAP_INTERVAL_MINUTES * PIXELS_PER_MINUTE;

    if (people.length === 0) {
        return (
            <div className="flex items-center justify-center p-20 glass-panel rounded-xl mt-4">
                <p className="text-xl text-white/50">Waiting for data...</p>
            </div>
        );
    }

    const pixelsToTime = (y) => {
        const totalMinutes = (y / ROW_HEIGHT) * 60 + START_MINUTES_GLOBAL;
        const h = Math.floor(totalMinutes / 60);
        const m = Math.floor(totalMinutes % 60);
        const roundedM = Math.round(m / 15) * 15;
        let finalH = h;
        let finalM = roundedM;
        if (finalM === 60) {
            finalH++;
            finalM = 0;
        }
        return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
    };

    const snapToGrid = (yPixels) => {
        return Math.round(yPixels / SNAP_INTERVAL_PX) * SNAP_INTERVAL_PX;
    };

    const calculateTargetFromDrag = (info, schedule) => {
        if (!containerRef.current) return null;

        const containerRect = containerRef.current.getBoundingClientRect();
        const relativeX = info.point.x - containerRect.left + containerRef.current.scrollLeft;
        const relativeY = info.point.y - containerRect.top + containerRef.current.scrollTop;

        let targetColIndex = -1;
        if (relativeX > TIME_COL_WIDTH) {
            targetColIndex = Math.floor((relativeX - TIME_COL_WIDTH) / COL_WIDTH);
            if (targetColIndex < 0 || targetColIndex >= people.length) targetColIndex = -1;
        }

        // Apply Offset so we drag "from where we grabbed"
        const gridOffsetY = relativeY - HEADER_HEIGHT - moveState.dragOffsetY;
        const snappedY = snapToGrid(gridOffsetY);

        if (snappedY < 0 || snappedY >= GRID_HEIGHT) return null;

        return {
            targetColIndex,
            targetPerson: targetColIndex >= 0 ? people[targetColIndex] : null,
            snappedY
        };
    };

    const handleBlockDrag = (e, info, schedule) => {
        const result = calculateTargetFromDrag(info, schedule);
        if (result) {
            setMoveState(prev => ({
                ...prev,
                targetPerson: result.targetPerson,
                targetColIndex: result.targetColIndex,
                snappedY: result.snappedY
            }));
        }
    };

    const handleBlockDragStart = (e, info, schedule) => {
        const containerRect = containerRef.current.getBoundingClientRect();
        const scrollTop = containerRef.current.scrollTop;

        // Mouse Y relative to the grid top (00:00 position basically, but shifted by header)
        // Actually relative to the scrollable content area top.
        const mouseGridY = info.point.y - containerRect.top + scrollTop - HEADER_HEIGHT;

        const blockStartY = (schedule.startMinutes - START_MINUTES_GLOBAL) * PIXELS_PER_MINUTE;
        const offset = mouseGridY - blockStartY;

        setMoveState({
            isMoving: true,
            original: schedule,
            targetPerson: schedule.name,
            targetColIndex: people.indexOf(schedule.name),
            snappedY: blockStartY,
            dragOffsetY: offset
        });
    };

    const handleBlockDragEnd = (e, info, schedule) => {
        if (!moveState.isMoving) return;

        const { targetPerson, snappedY } = moveState;

        // Clear state immediately
        setMoveState({ isMoving: false, original: null });

        if (!targetPerson) {
            return;
        }

        const newStartMinutes = START_MINUTES_GLOBAL + (snappedY / PIXELS_PER_MINUTE);
        const duration = schedule.endMinutes - schedule.startMinutes;
        const newEndMinutes = newStartMinutes + duration;

        const newStartH = Math.floor(newStartMinutes / 60);
        const newStartM = newStartMinutes % 60;
        const newEndH = Math.floor(newEndMinutes / 60);
        const newEndM = newEndMinutes % 60;

        const newStartTime = `${String(newStartH).padStart(2, '0')}:${String(newStartM).padStart(2, '0')}`;
        const newEndTime = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`;

        if (targetPerson !== schedule.name || newStartTime !== schedule.start) {
            if (onScheduleUpdate) {
                onScheduleUpdate(schedule, {
                    ...schedule,
                    name: targetPerson,
                    date: date,
                    startTime: newStartTime,
                    endTime: newEndTime
                });
            }
        }
    };

    // --- Resize Handlers ---

    const handleResizeStart = (e, edge, schedule) => {
        e.preventDefault();
        e.stopPropagation();
        const startY = (schedule.startMinutes - START_MINUTES_GLOBAL) * PIXELS_PER_MINUTE;
        const endY = (schedule.endMinutes - START_MINUTES_GLOBAL) * PIXELS_PER_MINUTE;
        setResizeState({
            isResizing: true,
            original: schedule,
            edge: edge,
            newStartY: startY,
            newEndY: endY
        });
    };

    const handleBoardMouseMove = (e) => {
        // 1. Handle Resize
        if (resizeState.isResizing) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const scrollTop = containerRef.current.scrollTop;

            // Calculate Y relative to the Grid (excluding header)
            const absoluteY = e.clientY - containerRect.top + scrollTop - HEADER_HEIGHT;
            const snappedY = snapToGrid(absoluteY);

            const { original, edge } = resizeState;
            const originalStartY = (original.startMinutes - START_MINUTES_GLOBAL) * PIXELS_PER_MINUTE;
            const originalEndY = (original.endMinutes - START_MINUTES_GLOBAL) * PIXELS_PER_MINUTE;

            if (edge === 'top') {
                // Dragging TOP: Modify Start, Fix End
                const minY = 0;
                const maxY = originalEndY - SNAP_INTERVAL_PX;
                const clampedY = Math.max(minY, Math.min(maxY, snappedY));
                setResizeState(prev => ({ ...prev, newStartY: clampedY, newEndY: originalEndY }));
            } else {
                // Dragging BOTTOM: Fix Start, Modify End
                const minY = originalStartY + SNAP_INTERVAL_PX;
                const maxY = GRID_HEIGHT;
                const clampedY = Math.max(minY, Math.min(maxY, snappedY));
                setResizeState(prev => ({ ...prev, newStartY: originalStartY, newEndY: clampedY }));
            }
        }

        // 2. Handle Creation (Delegate)
        if (dragState.isDragging) {
            handleCreationMouseMove(e);
        }
    };

    const handleBoardMouseUp = () => {
        // 1. End Resize
        if (resizeState.isResizing) {
            const { original, newStartY, newEndY, edge } = resizeState;
            setResizeState({ isResizing: false, original: null, edge: null, newStartY: 0, newEndY: 0 });

            const newStartMinutes = START_MINUTES_GLOBAL + (newStartY / PIXELS_PER_MINUTE);
            const newEndMinutes = START_MINUTES_GLOBAL + (newEndY / PIXELS_PER_MINUTE);

            const newStartH = Math.floor(newStartMinutes / 60);
            const newStartM = newStartMinutes % 60;
            const newEndH = Math.floor(newEndMinutes / 60);
            const newEndM = newEndMinutes % 60;

            const newStartTime = `${String(newStartH).padStart(2, '0')}:${String(newStartM).padStart(2, '0')}`;
            const newEndTime = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`;

            // Trigger update only for the changed edge
            let shouldUpdate = false;
            let finalStartTime = original.start;
            let finalEndTime = original.end;

            if (edge === 'top' && newStartTime !== original.start) {
                finalStartTime = newStartTime;
                shouldUpdate = true;
            } else if (edge === 'bottom' && newEndTime !== original.end) {
                finalEndTime = newEndTime;
                shouldUpdate = true;
            }

            if (shouldUpdate && onScheduleUpdate) {
                onScheduleUpdate(original, {
                    ...original,
                    startTime: finalStartTime,
                    endTime: finalEndTime
                });
            }
        }

        // 2. End Creation
        if (dragState.isDragging) {
            handleCreationMouseUp();
        }
    };

    const handleCreationMouseDown = (e, person, colIndex) => {
        if (e.button !== 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        setDragState({ isDragging: true, startY: relativeY, currentY: relativeY, person, colIndex });
    };

    const handleCreationMouseMove = (e) => {
        if (!dragState.isDragging) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const scrollTop = containerRef.current.scrollTop;
        const gridY = e.clientY - containerRect.top + scrollTop - HEADER_HEIGHT;
        setDragState(prev => ({ ...prev, currentY: gridY }));
    };

    const handleCreationMouseUp = () => {
        if (!dragState.isDragging) return;
        const startY = Math.min(dragState.startY, dragState.currentY);
        const endY = Math.max(dragState.startY, dragState.currentY);
        const height = endY - startY;
        if (height > 10) {
            const startTime = pixelsToTime(startY);
            const endTime = pixelsToTime(endY);
            if (onScheduleCreate) onScheduleCreate({ name: dragState.person, date, startTime, endTime });
        }
        setDragState({ isDragging: false, startY: 0, currentY: 0, person: null, colIndex: -1 });
    };

    return (
        <div className="mt-8 rounded-xl border border-white/20 bg-[#111] overflow-hidden relative shadow-2xl" style={{ height: '75vh' }}>
            <div
                className="overflow-auto w-full h-full relative"
                ref={containerRef}
                onMouseMove={handleBoardMouseMove}
                onMouseUp={handleBoardMouseUp}
                onMouseLeave={handleBoardMouseUp}
            >
                <div className="grid relative" style={{
                    gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${people.length}, ${COL_WIDTH}px)`,
                    gridTemplateRows: `${HEADER_HEIGHT}px ${GRID_HEIGHT}px`,
                    width: 'max-content'
                }}>
                    <div className="sticky left-0 top-0 z-50 flex items-center justify-center font-bold text-white bg-[#0a0a0a] border-r border-b border-white/20 shadow-xl" style={{ width: TIME_COL_WIDTH, height: HEADER_HEIGHT }}>Time</div>

                    {people.map((person, i) => (
                        <div key={person} className="sticky top-0 z-40 flex items-center justify-center font-bold text-lg text-white bg-[#0a0a0a] border-r border-b border-white/20 shadow-sm" style={{ gridColumnStart: i + 2, height: HEADER_HEIGHT }}>{person}</div>
                    ))}

                    <div className="relative sticky left-0 z-30 bg-[#1a1a1a] border-r border-white/20" style={{ height: GRID_HEIGHT }}>
                        {hours.map((hour, i) => (
                            <div key={`time-${hour}`} className="absolute w-full flex items-center justify-center text-xs font-mono text-white/60" style={{ top: `${i * ROW_HEIGHT}px`, height: '20px', transform: 'translateY(-50%)' }}>{`${hour.toString().padStart(2, '0')}:00`}</div>
                        ))}
                    </div>

                    {people.map((person, pIndex) => {
                        const personEvents = daySchedules.filter(s => s.name === person);
                        const resolvedEvents = resolveCollisions(personEvents);

                        return (
                            <div key={`col-content-${person}`} className="relative border-r border-white/10 bg-white/5 select-none" style={{ gridColumnStart: pIndex + 2, height: GRID_HEIGHT }}
                                onMouseDown={(e) => handleCreationMouseDown(e, person, pIndex)}
                            // onMouseMove and onMouseUp removed (handled by container)
                            >

                                {hours.map((_, hIndex) => (
                                    <div key={`line-${hIndex}`} className="absolute inset-x-0 border-t border-white/10 pointer-events-none" style={{ top: `${hIndex * ROW_HEIGHT}px`, height: ROW_HEIGHT }} />
                                ))}

                                {dragState.isDragging && dragState.person === person && (
                                    <div className="absolute z-20 rounded bg-blue-500/30 border border-blue-400/50 backdrop-blur-[2px]" style={{ left: '5%', width: '90%', top: `${Math.min(dragState.startY, dragState.currentY)}px`, height: `${Math.abs(dragState.currentY - dragState.startY)}px` }}>
                                        <div className="text-[10px] text-white font-bold text-center mt-1">New Event</div>
                                    </div>
                                )}

                                {moveState.isMoving && moveState.targetColIndex === pIndex && (
                                    <div className="absolute z-30 rounded-lg bg-green-500/50 border-2 border-green-400 backdrop-blur-sm pointer-events-none"
                                        style={{
                                            left: '2px',
                                            right: '2px',
                                            top: `${moveState.snappedY}px`,
                                            height: `${(moveState.original.endMinutes - moveState.original.startMinutes) * PIXELS_PER_MINUTE}px`
                                        }}>
                                        <div className="text-xs text-white font-bold text-center mt-1">
                                            {pixelsToTime(moveState.snappedY)}
                                        </div>
                                    </div>
                                )}

                                {resolvedEvents.map((schedule, i) => {
                                    const startY = schedule.startMinutes - START_MINUTES_GLOBAL;
                                    if (startY < 0) return null;

                                    const isMovingThis = moveState.isMoving && moveState.original._id === schedule._id;
                                    const isResizingThis = resizeState.isResizing && resizeState.original._id === schedule._id;

                                    let topPx = startY * PIXELS_PER_MINUTE;
                                    let heightPx = (schedule.endMinutes - schedule.startMinutes) * PIXELS_PER_MINUTE;
                                    let displaySchedule = schedule;

                                    if (isResizingThis) {
                                        // Override with Resize State
                                        topPx = resizeState.newStartY;
                                        heightPx = resizeState.newEndY - resizeState.newStartY;

                                        // Override displayed time
                                        displaySchedule = {
                                            ...schedule,
                                            start: pixelsToTime(resizeState.newStartY),
                                            end: pixelsToTime(resizeState.newEndY)
                                        };
                                    }

                                    return (
                                        <ScheduleBlock
                                            key={`${person}-${i}-${schedule._id || i}`}
                                            schedule={displaySchedule}
                                            isMoving={isMovingThis}
                                            isResizing={isResizingThis}
                                            handlers={{
                                                onDragStart: handleBlockDragStart,
                                                onDrag: handleBlockDrag,
                                                onDragEnd: handleBlockDragEnd,
                                                onResizeStart: handleResizeStart,
                                                onContextMenu: (e, s) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (onScheduleDelete && window.confirm(`"${s.reason || '일정'}" 삭제하시겠습니까?`)) onScheduleDelete(s);
                                                }
                                            }}
                                            style={{
                                                top: `${topPx}px`,
                                                height: `${Math.max(10, heightPx)}px`, // Min height safety
                                                left: `${schedule.leftPercent}%`,
                                                width: `${schedule.widthPercent}%`,
                                            }}
                                        />
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
