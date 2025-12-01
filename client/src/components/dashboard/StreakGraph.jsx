import React, { useMemo } from 'react';
import './StreakGraph.css';
import { buildAttendanceMap, getDateKey } from '../../utils/attendance.js';

const StreakGraph = ({ data = [], enrollmentStart = null, attendanceMap: providedMap = null }) => {
    // Process data to group by month for the last year
    const months = useMemo(() => {
        const today = new Date();
        const todayYear = today.getUTCFullYear();
        const todayMonth = today.getUTCMonth();
        const result = [];

        // Go back 11 months + current month
        for (let i = 11; i >= 0; i--) {
            const monthDate = new Date(Date.UTC(todayYear, todayMonth - i, 1));
            const monthName = monthDate.toLocaleString('default', { month: 'short' });
            const year = monthDate.getUTCFullYear();
            const monthIndex = monthDate.getUTCMonth();
            const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

            const days = [];
            // Calculate offset for the first day (0 = Sunday, 1 = Monday, etc.)
            const firstDayOfWeek = monthDate.getUTCDay(); // 0 = Sunday

            // Add empty placeholders for days before the 1st of the month to align columns
            for (let j = 0; j < firstDayOfWeek; j++) {
                days.push({ date: null });
            }

            for (let day = 1; day <= daysInMonth; day++) {
                const dateObj = new Date(Date.UTC(year, monthIndex, day));
                const dateStr = getDateKey(dateObj);
                days.push({
                    date: dateStr,
                    dayOfMonth: day,
                });
            }

            result.push({
                name: monthName,
                year,
                days,
            });
        }
        return result;
    }, []);

    // Create a map of date -> status
    const attendanceMap = useMemo(() => {
        if (providedMap) {
            return providedMap;
        }
        return buildAttendanceMap(data, enrollmentStart);
    }, [providedMap, data, enrollmentStart]);

    const getAttendanceAttributes = (status) => {
        switch (status) {
            case 'present':
                return { variant: 'present', label: 'Present' };
            case 'late':
                return { variant: 'late', label: 'Late' };
            case 'absent':
                return { variant: 'absent', label: 'Absent' };
            default:
                return { variant: 'empty', label: 'No activity' };
        }
    };

    return (
        <div className="streak-graph-container">
            <div className="streak-graph-header">
                <h3>Attendance Activity</h3>
                <div className="streak-legend" aria-label="Attendance legend">
                    <div className="legend-item">
                        <span className="legend-box legend-absent" aria-hidden="true"></span>
                        <span>Absent</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-box legend-late" aria-hidden="true"></span>
                        <span>Late</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-box legend-present" aria-hidden="true"></span>
                        <span>Present</span>
                    </div>
                </div>
            </div>

            <div className="streak-scroll-wrapper">
                <div className="streak-months-container">
                    {months.map((month, index) => (
                        <div key={`${month.name}-${month.year}`} className="streak-month">
                            <div className="month-label">{month.name}</div>
                            <div className="month-grid">
                                {month.days.map((dayObj, dayIndex) => {
                                    if (!dayObj.date) {
                                        return <div key={`empty-${dayIndex}`} className="streak-box empty-placeholder"></div>;
                                    }

                                    const attendanceEntry = attendanceMap[dayObj.date];
                                    const { variant, label } = getAttendanceAttributes(attendanceEntry?.status);
                                    const note = attendanceEntry?.notes ? `\nNote: ${attendanceEntry.notes}` : '';

                                    return (
                                        <div
                                            key={dayObj.date}
                                            className={`streak-box ${variant}`}
                                            title={`${dayObj.date}: ${label}${note}`}
                                        ></div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StreakGraph;
