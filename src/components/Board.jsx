import React, { useMemo, useState, useRef } from 'react';
import { motion, useDragControls } from 'framer-motion';

const ScheduleBlock = ({
    schedule,
    style,
    handlers,
    isMoving,
    isResizing,
    isEditing, // [NEW]
    isDeleteTarget, // [NEW]
    children
}) => {
    const controls = useDragControls();

    const isOfficial = schedule.name === '공식 일정';
    let bgStyle, boxShadow, border;

    if (isEditing) {
        bgStyle = isOfficial ? 'linear-gradient(to bottom, #FFE5B4, #FFD700)' : 'linear-gradient(to bottom, #ffffff, #f0f0f0)';
        boxShadow = '0 0 0 2px #3b82f6, 0 4px 12px rgba(0,0,0,0.3)';
        border = '1px solid #2563eb';
    } else {
        bgStyle = isOfficial ? 'linear-gradient(to bottom, #FFE5B4, #FFD700)' : 'linear-gradient(to bottom, #ffffff, #e0e0e0)';
        boxShadow = isOfficial ? '0 2px 10px rgba(255, 215, 0, 0.3)' : '0 2px 8px rgba(255, 255, 255, 0.2)';
        border = isOfficial ? '1px solid rgba(255, 215, 0, 0.5)' : '1px solid rgba(0,0,0,0.1)';
    }

    return (
        <motion.div
            drag={false} // Custom Drag Logic used (Mobile & Desktop)
            dragListener={false}
            dragControls={controls}
            dragMomentum={false}
            dragElastic={0}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            onDragStart={(e, info) => handlers.onDragStart(e, info, schedule)}
            onDrag={(e, info) => handlers.onDrag(e, info, schedule)}
            onDragEnd={(e, info) => handlers.onDragEnd(e, info, schedule)}
            onContextMenu={(e) => handlers.onContextMenu(e, schedule)}
            // Main Body Touch: Pan-Y allows vertical scroll (Swipe). 
            // We use preventDefault in touchMove ONLY if Long Press is active.
            onTouchStart={(e) => handlers.onTouchStart && handlers.onTouchStart(e)}
            onTouchEnd={(e) => handlers.onTouchEnd && handlers.onTouchEnd(e)}
            onTouchCancel={(e) => handlers.onTouchCancel && handlers.onTouchCancel(e)} // [NEW] Handle scroll taking over
            onMouseDown={(e) => handlers.onContentMouseDown && handlers.onContentMouseDown(e)} // RESTORED for Desktop Drag
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: (isMoving || isResizing) ? 0.5 : 1, scale: isEditing ? 1.02 : 1 }}
            className="absolute rounded flex flex-col hover:brightness-105 overflow-visible"
            style={{
                ...style,
                background: bgStyle,
                boxShadow: boxShadow,
                color: '#1a1a1a',
                border: border,
                padding: '2px',
                fontFamily: 'var(--font-soft)',
                zIndex: (isMoving || isResizing || isEditing) ? 60 : (isDeleteTarget ? 30 : 10),
                cursor: isEditing ? 'move' : 'default',

                // CRITICAL CHANGE: 'manipulation' allows native scroll but blocks double-tap zoom.
                // We no longer block all touches; we only block when Dragging/Resizing starts.
                touchAction: 'manipulation',
                filter: isDeleteTarget ? 'brightness(0.6)' : 'none' // Darken if delete target
            }}
        >
            {/* Delete Button (Overlay) - Shows on Static Long Press */}
            {isDeleteTarget && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-2xl z-50 flex items-center justify-center border border-white/20"
                    onClick={(e) => {
                        e.stopPropagation();
                        handlers.onDelete(schedule);
                    }}
                    onTouchEnd={(e) => {
                        e.stopPropagation();
                        handlers.onDelete(schedule);
                    }}
                >
                    삭제
                </div>
            )}

            {children}

            {/* TOP RESIZE HANDLE - Always Active on Mobile (Touch-Action: None) */}
            <div
                className="absolute -top-2 left-0 right-0 h-8 flex items-center justify-center cursor-ns-resize z-30 group"
                onMouseDown={(e) => handlers.onResizeStart(e, 'top', schedule)}
                onTouchStart={(e) => {
                    if (e.cancelable) e.preventDefault(); // Explicitly block scroll
                    e.stopPropagation(); // Don't trigger block long press
                    handlers.onResizeStart(e, 'top', schedule);
                }}
                style={{ touchAction: 'none' }} // Blocks scroll, locks gestures to this element
            >
                {/* Visual Indicator (Only visible on hover or if needed, kept subtle) */}
                <div className="w-8 h-1 bg-white/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Content Area - Passes clicks/touches through to parent logic */}
            <div
                className="flex-1 w-full px-1 flex flex-col justify-center pointer-events-none"
            // pointer-events-none ensures touches go to parent (the motion.div) for the main body logic
            // But we need to allow text selection? No, user wants drag/swipe.
            >
                {schedule.reason && <div className="text-sm font-bold leading-tight mb-0.5 truncate">{schedule.reason}</div>}
                <div className="text-[11px] opacity-70 leading-tight">{schedule.start}-{schedule.end}</div>
            </div>

            {/* BOTTOM RESIZE HANDLE - Always Active on Mobile */}
            <div
                className="absolute -bottom-2 left-0 right-0 h-8 flex items-center justify-center cursor-ns-resize z-30 group"
                onMouseDown={(e) => handlers.onResizeStart(e, 'bottom', schedule)}
                onTouchStart={(e) => {
                    if (e.cancelable) e.preventDefault();
                    e.stopPropagation();
                    handlers.onResizeStart(e, 'bottom', schedule);
                }}
                style={{ touchAction: 'none' }}
            >
                <div className="w-8 h-1 bg-white/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
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

const Board = ({ schedules, date, onScheduleCreate, onScheduleUpdate, onScheduleDelete, onScheduleEdit, people: propPeople }) => {
    const daySchedules = useMemo(() => schedules.filter(s => s.date === date), [schedules, date]);
    const people = useMemo(() => {
        // Use propPeople if provided, otherwise fallback to schedules
        // Also merge them to be safe (in case some schedule has a name not in people list?)
        // User wants "Just name floating" -> propPeople contains names from sheet even if no schedule.
        const allNames = [...(propPeople || []), ...schedules.map(s => s.name)];
        const unique = [...new Set(allNames)].sort();

        const official = "공식 일정";
        if (unique.includes(official)) {
            return [official, ...unique.filter(p => p !== official)];
        }
        return unique;
    }, [schedules, propPeople]);

    // --- State ---
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
        dragOffsetY: 0
    });

    const [resizeState, setResizeState] = useState({
        isResizing: false,
        original: null,
        edge: null,
        newStartY: 0,
        newEndY: 0
    });

    const [longPressTarget, setLongPressTarget] = useState(null); // stores schedule ID
    const [editingBlockId, setEditingBlockId] = useState(null); // [NEW] Edit Mode ID

    // --- Refs ---
    const containerRef = useRef(null);
    const longPressTimerRef = useRef(null);
    const touchStartRef = useRef({ x: 0, y: 0 }); // To track distance for scroll vs long press
    const isLongPressActiveRef = useRef(false); // Immediate flag for event handlers without re-render lag
    const interactionTypeRef = useRef(null); // 'creation' | 'block'
    const lastTapRef = useRef({ time: 0, x: 0, y: 0 }); // Track last tap for double-tap detection
    const lastBlockTapRef = useRef({ time: 0, id: null }); // [NEW] Track block double tap
    const activeTouchBlockIdRef = useRef(null); // Track which block is being touched for Tap detection
    const lastTouchRef = useRef({ x: 0, y: 0 }); // [NEW] For manual scrolling delta
    const resizeActiveRef = useRef(false); // [NEW] Track if resize is active (for mobile document listener)


    // --- Constants ---
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

    // --- Helpers ---

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

    const getPointY = (e, info) => {
        if (info && info.point) {
            const containerRect = containerRef.current.getBoundingClientRect();
            return info.point.y - containerRect.top + containerRef.current.scrollTop - HEADER_HEIGHT;
        }
        let clientY;
        if (e.touches && e.touches.length > 0) {
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientY = e.changedTouches[0].clientY;
        } else {
            clientY = e.clientY;
        }

        const containerRect = containerRef.current.getBoundingClientRect();
        return clientY - containerRect.top + containerRef.current.scrollTop - HEADER_HEIGHT;
    };

    // --- Handlers ---

    const calculateTargetFromDrag = (info, schedule) => {
        if (!containerRef.current) return null;

        const containerRect = containerRef.current.getBoundingClientRect();
        const absoluteX = info.point.x;
        const relativeX = absoluteX - containerRect.left + containerRef.current.scrollLeft;

        let targetColIndex = -1;
        if (relativeX > TIME_COL_WIDTH) {
            targetColIndex = Math.floor((relativeX - TIME_COL_WIDTH) / COL_WIDTH);
            if (targetColIndex < 0 || targetColIndex >= people.length) targetColIndex = -1;
        }

        const relativeY = info.point.y - containerRect.top + containerRef.current.scrollTop;
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
        setLongPressTarget(null); // Cancel any selection
        const containerRect = containerRef.current.getBoundingClientRect();
        const scrollTop = containerRef.current.scrollTop;
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
        setMoveState({ isMoving: false, original: null });

        if (!targetPerson) return;

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


    // --- Interaction Logic ---

    // 1. Creation Logic
    const handleCreationTouchStart = (e, person, colIndex) => {
        // [NEW] Clear any active selection immediately
        setLongPressTarget(null);
        setEditingBlockId(null);

        if (e.touches && e.touches.length > 0) {
            const touch = e.touches[0];
            const now = Date.now();
            const timeDiff = now - lastTapRef.current.time;
            const dist = Math.hypot(touch.clientX - lastTapRef.current.x, touch.clientY - lastTapRef.current.y);

            // Double Tap Detection (Mobile)
            if (timeDiff < 300 && dist < 20) {
                // Prevent Long Press logic from starting
                if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

                // Trigger Creation immediately
                handleDoubleClick(e, person, colIndex);

                // Reset to prevent triple-tap firing again
                lastTapRef.current = { time: 0, x: 0, y: 0 };
                return;
            }

            // Update Last Tap
            lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };

            touchStartRef.current = { x: touch.clientX, y: touch.clientY };
            isLongPressActiveRef.current = false;
            interactionTypeRef.current = 'creation'; // MARK: Creation

            // Start Long Press Timer for CREATION
            longPressTimerRef.current = setTimeout(() => {
                isLongPressActiveRef.current = true; // Now we are in "Drag Mode"
                if (navigator.vibrate) navigator.vibrate(50); // Feedback

                // Initialize Creation Drag
                const rect = e.currentTarget.getBoundingClientRect();
                const relativeY = touch.clientY - rect.top;
                setDragState({ isDragging: true, startY: relativeY, currentY: relativeY, person, colIndex });
            }, 300); // 300ms threshold for long press (Relaxed)
        }
    };

    const handleCreationMouseDown = (e, person, colIndex) => {
        // [NEW] Clear any active selection immediately
        setLongPressTarget(null);
        setEditingBlockId(null);

        if (e.button !== 0) return; // Only left click
        // Mouse is instant, no long press needed, but we MUST set the flag for move logic to work
        isLongPressActiveRef.current = true;
        interactionTypeRef.current = 'creation';

        const rect = e.currentTarget.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        setDragState({ isDragging: true, startY: relativeY, currentY: relativeY, person, colIndex });
    };

    // [RESTORED] Desktop Block Drag Handler
    const handleBlockMouseDown = (e, schedule) => {
        if (e.button !== 0) return;
        e.stopPropagation(); // Prevent creation trigger

        isLongPressActiveRef.current = true; // Allow move logic immediately for mouse
        interactionTypeRef.current = 'block';

        const containerRect = containerRef.current.getBoundingClientRect();
        const scrollTop = containerRef.current.scrollTop;
        const mouseGridY = e.clientY - containerRect.top + scrollTop - HEADER_HEIGHT;
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

        // Attach Global Listeners for Mouse Drag
        document.addEventListener('mousemove', handleUnifiedMove);
        document.addEventListener('mouseup', handleUnifiedEnd);
    };

    const handleDoubleClick = (e, person, colIndex) => {
        if (e.cancelable) e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        let clientY;

        // Robust ClientY Extraction
        if (e.touches && e.touches.length > 0) {
            clientY = e.touches[0].clientY;
        } else if (e.nativeEvent instanceof TouchEvent && e.nativeEvent.touches && e.nativeEvent.touches.length > 0) {
            clientY = e.nativeEvent.touches[0].clientY;
        } else {
            clientY = e.clientY;
        }

        if (!clientY) return;

        const relativeY = clientY - rect.top;
        const gridY = relativeY; // Already relative to col-content which is the scale
        const snappedY = snapToGrid(gridY);

        const startTime = pixelsToTime(snappedY);
        const startMinutes = (snappedY / PIXELS_PER_MINUTE) + START_MINUTES_GLOBAL;
        const endMinutes = startMinutes + 60; // 1 Hour Default

        const endH = Math.floor(endMinutes / 60);
        const endM = endMinutes % 60;
        const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

        if (onScheduleCreate) {
            // Slight vibration for feedback
            if (navigator.vibrate) navigator.vibrate(50);
            onScheduleCreate({ name: person, date, startTime, endTime });
        }
    };

    // 2. Block Logic (Move/Resize/Delete)
    const handleBlockTouchStart = (e, schedule) => {
        if (e.touches && e.touches.length > 0) {
            const touch = e.touches[0];
            touchStartRef.current = { x: touch.clientX, y: touch.clientY };
            lastTouchRef.current = { x: touch.clientX, y: touch.clientY }; // Init for delta
            isLongPressActiveRef.current = false;
            interactionTypeRef.current = 'block'; // MARK: Block
            activeTouchBlockIdRef.current = schedule._id; // Store for Tap detection
            activeTouchRef.current = true; // GATE OPEN: Listen to document moves

            console.log("Touch Start:", schedule.name, schedule._id);

            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

            longPressTimerRef.current = setTimeout(() => {
                console.log("Timer Fired! Long Press -> Drag Mode.");
                longPressTimerRef.current = null;
                if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback

                // Long Press -> Show Option (Static Mode)
                isLongPressActiveRef.current = true;
                setLongPressTarget(schedule._id); // Show Delete Button

                // Note: We do NOT set moveState here. 
                // We wait for handleUnifiedMove to detect if user moves finger.

            }, 300); // 300ms Standard Long Press
        }
    };

    // 3. Unified Move Handler (Container)
    const handleUnifiedMove = (e) => {
        // console.log("UnifiedMove Called", e.type, "LongPress:", isLongPressActiveRef.current, "MoveState:", moveState.isMoving);

        // A. If Touch: Check for scrolling vs dragging
        if (e.touches && e.touches.length > 0 && !resizeState.isResizing) {

            // IF Long Press is NOT active, we let the browser handle scrolling (Swipe).
            if (!isLongPressActiveRef.current) {
                const touch = e.touches[0];
                const moveX = Math.abs(touch.clientX - touchStartRef.current.x);
                const moveY = Math.abs(touch.clientY - touchStartRef.current.y);

                // If user moves drastically before timer, cancel timer (it's a scroll).
                if (moveX > 10 || moveY > 10) {
                    if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                    }
                }
                // allow default (native scroll)
                return;
            }

            // IF Long Press IS active, we HIJACK the touch stream.
            if (isLongPressActiveRef.current) {
                if (e.cancelable) e.preventDefault(); // STOP SCROLLING (Prevent Browser)

                const touch = e.touches[0];
                const moveX = Math.abs(touch.clientX - touchStartRef.current.x);
                const moveY = Math.abs(touch.clientY - touchStartRef.current.y);

                // --- Deferred Move Start Check ---
                // If we are in "Long Press" mode (isLongPressActiveRef=true) but NOT moving yet (Static),
                // check if we drifted enough to start Dragging.
                if (!moveState.isMoving) {
                    const MOVE_THRESHOLD = 5;
                    if (moveX > MOVE_THRESHOLD || moveY > MOVE_THRESHOLD) {
                        // User moved finger! Transition from Static -> Dragging
                        setLongPressTarget(null); // Hide Delete Button

                        // Init Drag State
                        const scheduleId = activeTouchBlockIdRef.current;
                        const schedule = schedules.find(s => s._id === scheduleId);

                        if (schedule) {
                            const containerRect = containerRef.current.getBoundingClientRect();
                            const scrollTop = containerRef.current.scrollTop;
                            const mouseGridY = touch.clientY - containerRect.top + scrollTop - HEADER_HEIGHT;
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
                        }
                    }
                }
            }
        }


        // --- Drag Logic Implementation ---

        // 1. Handle Resize
        if (resizeState.isResizing) {
            // Resize relies on touch-action: none for the handle, so native scroll is already blocked usually.
            // But good to prevent default here too.
            if (e.cancelable) e.preventDefault();

            const gridY = getPointY(e);
            const snappedY = snapToGrid(gridY);
            const { original, edge } = resizeState;
            const originalStartY = (original.startMinutes - START_MINUTES_GLOBAL) * PIXELS_PER_MINUTE;
            const originalEndY = (original.endMinutes - START_MINUTES_GLOBAL) * PIXELS_PER_MINUTE;

            if (edge === 'top') {
                const minY = 0;
                const maxY = originalEndY - SNAP_INTERVAL_PX;
                const clampedY = Math.max(minY, Math.min(maxY, snappedY));
                setResizeState(prev => ({ ...prev, newStartY: clampedY, newEndY: originalEndY }));
            } else {
                const minY = originalStartY + SNAP_INTERVAL_PX;
                const maxY = GRID_HEIGHT;
                const clampedY = Math.max(minY, Math.min(maxY, snappedY));
                setResizeState(prev => ({ ...prev, newStartY: originalStartY, newEndY: clampedY }));
            }
            return;
        }

        // 2. Handle Creation
        if (dragState.isDragging && isLongPressActiveRef.current) {
            if (e.cancelable) e.preventDefault();

            const containerRect = containerRef.current.getBoundingClientRect();
            const scrollTop = containerRef.current.scrollTop;
            let clientY;
            if (e.touches && e.touches.length > 0) clientY = e.touches[0].clientY;
            else clientY = e.clientY;

            const gridY = clientY - containerRect.top + scrollTop - HEADER_HEIGHT;
            setDragState(prev => ({ ...prev, currentY: gridY }));
        }

        // 3. Handle Block Moving
        if (moveState.isMoving && isLongPressActiveRef.current) {
            if (e.cancelable) e.preventDefault();

            const containerRect = containerRef.current.getBoundingClientRect();
            let clientX, clientY;
            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            const absoluteX = clientX;
            const relativeX = absoluteX - containerRect.left + containerRef.current.scrollLeft;

            let targetColIndex = -1;
            if (relativeX > TIME_COL_WIDTH) {
                targetColIndex = Math.floor((relativeX - TIME_COL_WIDTH) / COL_WIDTH);
                if (targetColIndex < 0 || targetColIndex >= people.length) targetColIndex = -1;
            }

            const relativeY = clientY - containerRect.top + containerRef.current.scrollTop;
            const gridOffsetY = relativeY - HEADER_HEIGHT - moveState.dragOffsetY;
            const snappedY = snapToGrid(gridOffsetY);

            if (snappedY >= 0 && snappedY < GRID_HEIGHT) {
                setMoveState(prev => ({
                    ...prev,
                    targetPerson: targetColIndex >= 0 ? people[targetColIndex] : null,
                    targetColIndex: targetColIndex,
                    snappedY: snappedY
                }));
            }
        }
    };

    const handleUnifiedEnd = (e) => {
        // Detect Tap (Block Only)
        // Check timer AND that we are NOT already moving
        if (longPressTimerRef.current && interactionTypeRef.current === 'block' && !moveState.isMoving) {
            // Prevent ghost click
            if (e && e.cancelable) e.preventDefault();

            // Check Double Tap or Single Tap
            const targetId = activeTouchBlockIdRef.current;
            const now = Date.now();
            const timeDiff = now - lastBlockTapRef.current.time;

            if (targetId === lastBlockTapRef.current.id && timeDiff < 300) {
                // Double Tap -> Open Modal
                const targetSchedule = schedules.find(s => s._id === targetId);
                if (targetSchedule && onScheduleEdit) {
                    onScheduleEdit(targetSchedule);
                }
                setEditingBlockId(null);
                lastBlockTapRef.current = { time: 0, id: null };
            } else {
                // Single Tap -> Toggle Delete Button (Standard: Select Block)
                setLongPressTarget(prev => prev === targetId ? null : targetId);
                setEditingBlockId(null); // Clear others
                lastBlockTapRef.current = { time: now, id: targetId };
            }
        }

        // Clear Timers
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        // Brief delay
        setTimeout(() => {
            isLongPressActiveRef.current = false;
        }, 50);

        // 1. End Resize
        if (resizeState.isResizing) {
            const { original, newStartY, newEndY, edge } = resizeState;
            setResizeState({ isResizing: false, original: null, edge: null, newStartY: 0, newEndY: 0 });
            resizeActiveRef.current = false; // Clear mobile resize flag

            const newStartMinutes = START_MINUTES_GLOBAL + (newStartY / PIXELS_PER_MINUTE);
            const newEndMinutes = START_MINUTES_GLOBAL + (newEndY / PIXELS_PER_MINUTE);

            const newStartH = Math.floor(newStartMinutes / 60);
            const newStartM = newStartMinutes % 60;
            const newEndH = Math.floor(newEndMinutes / 60);
            const newEndM = newEndMinutes % 60;

            const newStartTime = `${String(newStartH).padStart(2, '0')}:${String(newStartM).padStart(2, '0')}`;
            const newEndTime = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`;

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
            const startY = Math.min(dragState.startY, dragState.currentY);
            const endY = Math.max(dragState.startY, dragState.currentY);
            const height = endY - startY;
            if (height > 10) {
                const startTime = pixelsToTime(startY);
                const endTime = pixelsToTime(endY);
                if (onScheduleCreate) onScheduleCreate({ name: dragState.person, date, startTime, endTime });
            }
            setDragState({ isDragging: false, startY: 0, currentY: 0, person: null, colIndex: -1 });
        }

        // 3. End Moving
        if (moveState.isMoving) {
            const { targetPerson, snappedY, original } = moveState;
            setMoveState({ isMoving: false, original: null });

            if (targetPerson && original) {
                const newStartMinutes = START_MINUTES_GLOBAL + (snappedY / PIXELS_PER_MINUTE);
                const duration = original.endMinutes - original.startMinutes;
                const newEndMinutes = newStartMinutes + duration;

                const newStartH = Math.floor(newStartMinutes / 60);
                const newStartM = newStartMinutes % 60;
                const newEndH = Math.floor(newEndMinutes / 60);
                const newEndM = newEndMinutes % 60;

                const newStartTime = `${String(newStartH).padStart(2, '0')}:${String(newStartM).padStart(2, '0')}`;
                const newEndTime = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`;

                if (targetPerson !== original.name || newStartTime !== original.start) {
                    if (onScheduleUpdate) {
                        onScheduleUpdate(original, {
                            ...original,
                            name: targetPerson,
                            date: date,
                            startTime: newStartTime,
                            endTime: newEndTime
                        });
                    }
                }
            }
        }

        // Cleanup Desktop Mouse Listeners
        document.removeEventListener('mousemove', handleUnifiedMove);
        document.removeEventListener('mouseup', handleUnifiedEnd);
    };

    const handleResizeStart = (e, edge, schedule) => {
        // For Mouse
        if (e.nativeEvent instanceof MouseEvent) {
            e.preventDefault();
            e.stopPropagation();
        }

        // For Touch: Enable document listener to track moves
        if (e.touches) {
            activeTouchRef.current = true;
            resizeActiveRef.current = true;
            touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }

        setLongPressTarget(null);

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


    // --- Document Level Listeners for Robust Touch Handling ---
    // We attach these ONLY when a touch starts on a block to minimize overhead/interference
    const activeTouchRef = useRef(null); // Track if we are currently handling a block touch sequence

    const latestUnifiedMove = useRef(handleUnifiedMove);
    const latestUnifiedEnd = useRef(handleUnifiedEnd);
    latestUnifiedMove.current = handleUnifiedMove;
    latestUnifiedEnd.current = handleUnifiedEnd;

    React.useEffect(() => {
        const handleDocTouchMove = (e) => {
            if (!activeTouchRef.current) return;

            // RESIZE MODE: Immediate response, no long press needed
            if (resizeActiveRef.current) {
                if (e.cancelable) e.preventDefault();
                latestUnifiedMove.current(e);
                return;
            }

            // LONG PRESS MODE: Block drag/move
            if (isLongPressActiveRef.current) {
                if (e.cancelable) e.preventDefault();
                latestUnifiedMove.current(e);
            } else {
                // MONITOR MODE: Check for scroll (cancel long press timer)
                const touch = e.touches[0];
                const start = touchStartRef.current;
                const moveX = Math.abs(touch.clientX - start.x);
                const moveY = Math.abs(touch.clientY - start.y);
                if (moveX > 10 || moveY > 10) {
                    if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                    }
                }
            }
        };

        const handleDocTouchEnd = (e) => {
            if (!activeTouchRef.current) return;
            latestUnifiedEnd.current(e);
            activeTouchRef.current = false;
        };

        const options = { passive: false };
        document.addEventListener('touchmove', handleDocTouchMove, options);
        document.addEventListener('touchend', handleDocTouchEnd, options);

        return () => {
            document.removeEventListener('touchmove', handleDocTouchMove);
            document.removeEventListener('touchend', handleDocTouchEnd);
        };
    }, []);

    const handleBackgroundClick = () => {
        setLongPressTarget(null);
        setEditingBlockId(null); // Clear Edit Mode
    };

    return (
        <div
            className="mt-8 rounded-xl border border-white/20 bg-[#111] overflow-hidden relative shadow-2xl"
            style={{ height: '75vh' }}
            onClick={handleBackgroundClick}
        >
            <div
                className="overflow-auto w-full h-full relative"
                ref={containerRef}
                onMouseMove={handleUnifiedMove}
                onMouseUp={handleUnifiedEnd}
                onMouseLeave={handleUnifiedEnd}
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
                                onTouchStart={(e) => handleCreationTouchStart(e, person, pIndex)}
                                onDoubleClick={(e) => handleDoubleClick(e, person, pIndex)}
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
                                    const isLongPressed = longPressTarget === schedule._id;
                                    const isEditing = editingBlockId === schedule._id; // [NEW]

                                    let topPx = startY * PIXELS_PER_MINUTE;
                                    let heightPx = (schedule.endMinutes - schedule.startMinutes) * PIXELS_PER_MINUTE;
                                    let displaySchedule = schedule;

                                    if (isResizingThis) {
                                        topPx = resizeState.newStartY;
                                        heightPx = resizeState.newEndY - resizeState.newStartY;
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
                                            isEditing={isEditing} // [NEW]
                                            isDeleteTarget={isLongPressed} // [NEW]
                                            handlers={{
                                                onDragStart: handleBlockDragStart,
                                                onDrag: handleBlockDrag,
                                                onDragEnd: handleBlockDragEnd,
                                                onResizeStart: handleResizeStart,
                                                onContextMenu: (e, s) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    // Long Press Delete handles this now, but keep Context Menu for desktop?
                                                    if (onScheduleDelete && window.confirm(`"${s.reason || '일정'}" 삭제하시겠습니까?`)) onScheduleDelete(s);
                                                },
                                                onDelete: onScheduleDelete, // [NEW] Pass delete handler
                                                // Touch specific for long press
                                                onTouchStart: (e) => handleBlockTouchStart(e, schedule),
                                                onTouchEnd: handleUnifiedEnd,
                                                onTouchCancel: (e) => {
                                                    // Browser decided this is a scroll, cancel any pending long press
                                                    if (longPressTimerRef.current) {
                                                        clearTimeout(longPressTimerRef.current);
                                                        longPressTimerRef.current = null;
                                                    }
                                                    activeTouchRef.current = false;
                                                },
                                                // Mouse (Tap/Edit)
                                                // We rely on onClick for tap ?? Container usually handles clicks. 
                                                // But since we use touchEnd/mouseUp on container for taps, we might not need separate onContentMouseDown other than for blocking prop
                                                onContentMouseDown: (e) => handleBlockMouseDown(e, schedule)
                                            }}
                                            style={{
                                                top: `${topPx}px`,
                                                height: `${Math.max(10, heightPx)}px`,
                                                left: `${schedule.leftPercent}%`,
                                                width: `${schedule.widthPercent}%`,
                                                // touchAction handled in component
                                            }}
                                        >
                                            {/* No children overlays, avoiding duplication */}
                                        </ScheduleBlock>
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
