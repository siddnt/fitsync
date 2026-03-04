import { useState, useMemo } from 'react';

/**
 * useTableSort – reusable hook for client-side column sorting.
 *
 * @param {Array}  items          – the array to sort (already filtered)
 * @param {string} defaultKey     – initial sort column key (e.g. 'name')
 * @param {string} defaultDir     – 'asc' | 'desc'  (default: 'asc')
 * @returns {{ sorted, sortKey, sortDir, onSort }}
 *
 * Usage:
 *   const { sorted, sortKey, sortDir, onSort } = useTableSort(filteredUsers, 'name');
 *   <th onClick={() => onSort('name')} className={sortKey === 'name' ? `sort-${sortDir}` : ''}>Name ▾</th>
 *   {sorted.map(user => ...)}
 */
const useTableSort = (items, defaultKey = '', defaultDir = 'asc') => {
    const [sortKey, setSortKey] = useState(defaultKey);
    const [sortDir, setSortDir] = useState(defaultDir);

    const onSort = (key) => {
        if (key === sortKey) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const sorted = useMemo(() => {
        if (!sortKey) return items;

        return [...items].sort((a, b) => {
            const resolve = (obj, path) =>
                path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

            let valA = resolve(a, sortKey);
            let valB = resolve(b, sortKey);

            // Handle nullish
            if (valA == null && valB == null) return 0;
            if (valA == null) return 1;
            if (valB == null) return -1;

            // Dates
            if (typeof valA === 'string' && !isNaN(Date.parse(valA)) && valA.includes('-')) {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            }

            // Numbers
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortDir === 'asc' ? valA - valB : valB - valA;
            }

            // Strings
            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();
            const cmp = strA.localeCompare(strB);
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [items, sortKey, sortDir]);

    return { sorted, sortKey, sortDir, onSort };
};

export default useTableSort;
