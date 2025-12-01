import React, { useMemo } from 'react';
import { formatDate } from '../../utils/format';
import './StreakGraph.css';

const StreakGraph = ({ data = [] }) => {
    // Process data to group by month for the last year
    const months = useMemo(() => {
        const today = new Date();
        const result = [];

        // Go back 11 months + current month
        for (let i = 11; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthName = d.toLocaleString('default', { month: 'short' });
            const year = d.getFullYear();
            const daysInMonth = new Date(year, d.getMonth() + 1, 0).getDate();

            const days = [];
            // Calculate offset for the first day (0 = Sunday, 1 = Monday, etc.)
            const firstDayOfWeek = d.getDay(); // 0 = Sunday

            // Add empty placeholders for days before the 1st of the month to align columns
            for (let j = 0; j < firstDayOfWeek; j++) {
                days.push({ date: null });
            }

            for (let day = 1; day <= daysInMonth; day++) {
                const dateObj = new Date(year, d.getMonth(), day);
                const dateStr = dateObj.toISOString().split('T')[0];
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
        const map = {};
        data.forEach(record => {
            const dateStr = new Date(record.date).toISOString().split('T')[0];
            map[dateStr] = record.status;
        });
        return map;
    }, [data]);

    return (
        <div className="streak-graph-container">
            <div className="streak-graph-header">
                <h3>Attendance Activity</h3>
                <div className="streak-legend">
                    <span>Less</span>
                    <div className="legend-box level-0"></div>
                    <div className="legend-box level-1"></div>
                    <div className="legend-box level-2"></div>
                    <div className="legend-box level-3"></div>
                    <span>More</span>
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

                                    const status = attendanceMap[dayObj.date];
                                    let level = 'level-0';
                                    let title = `${dayObj.date}: No activity`;

                                    if (status === 'present') {
                                        level = 'level-3';
                                        title = `${dayObj.date}: Present`;
                                    } else if (status === 'late') {
                                        level = 'level-2';
                                        title = `${dayObj.date}: Late`;
                                    } else if (status === 'absent') {
                                        level = 'level-1';
                                        title = `${dayObj.date}: Absent`;
                                    }

                                    return (
                                        <div
                                            key={dayObj.date}
                                            className={`streak-box ${level}`}
                                            title={title}
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
