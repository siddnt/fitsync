import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import './AutosuggestInput.css';

/**
 * Reusable autosuggest input with a dropdown of matching suggestions.
 *
 * @param {string}   value           – controlled input value
 * @param {function} onChange        – called with new value string
 * @param {string[]} suggestions    – full list of possible suggestions
 * @param {string}   [placeholder]
 * @param {string}   [className]    – extra class for the <input>
 * @param {string}   [ariaLabel]
 * @param {number}   [maxSuggestions=8]
 * @param {string}   [type='text']
 * @param {function} [onSelect]     – called when a suggestion is selected
 * @param {object}   [rest]         – spread onto <input>
 */
const AutosuggestInput = ({
    value,
    onChange,
    onSelect,
    suggestions,
    placeholder,
    className = '',
    ariaLabel,
    maxSuggestions = 8,
    type = 'text',
    ...rest
}) => {
    const [open, setOpen] = useState(false);
    const [activeIdx, setActiveIdx] = useState(-1);
    const wrapperRef = useRef(null);
    const listRef = useRef(null);

    // Deduplicate + filter suggestions by current value
    const filtered = useMemo(() => {
        const query = (value ?? '').trim().toLowerCase();
        if (!query) return [];
        const seen = new Set();
        const results = [];
        for (const s of suggestions) {
            if (!s) continue;
            const lower = s.toLowerCase();
            if (seen.has(lower)) continue;
            if (lower.includes(query) && lower !== query) {
                seen.add(lower);
                results.push(s);
                if (results.length >= maxSuggestions) break;
            }
        }
        return results;
    }, [value, suggestions, maxSuggestions]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Reset active index when filtered list changes
    useEffect(() => {
        setActiveIdx(-1);
    }, [filtered]);

    // Scroll active item into view
    useEffect(() => {
        if (activeIdx >= 0 && listRef.current) {
            const el = listRef.current.children[activeIdx];
            if (el) el.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIdx]);

    const handleChange = useCallback(
        (e) => {
            onChange(e.target.value);
            setOpen(true);
        },
        [onChange],
    );

    const selectSuggestion = useCallback(
        (text) => {
            onChange(text);
            if (typeof onSelect === 'function') {
                onSelect(text);
            }
            setOpen(false);
        },
        [onChange, onSelect],
    );

    const handleKeyDown = useCallback(
        (e) => {
            if (!open || filtered.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIdx((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIdx((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
            } else if (e.key === 'Enter' && activeIdx >= 0) {
                e.preventDefault();
                selectSuggestion(filtered[activeIdx]);
            } else if (e.key === 'Escape') {
                setOpen(false);
            }
        },
        [open, filtered, activeIdx, selectSuggestion],
    );

    const handleFocus = useCallback(() => {
        if (filtered.length > 0) setOpen(true);
    }, [filtered]);

    // Highlight the matching substring
    const highlight = (text) => {
        const query = (value ?? '').trim().toLowerCase();
        if (!query) return text;
        const idx = text.toLowerCase().indexOf(query);
        if (idx === -1) return text;
        return (
            <>
                {text.slice(0, idx)}
                <mark>{text.slice(idx, idx + query.length)}</mark>
                {text.slice(idx + query.length)}
            </>
        );
    };

    const showDropdown = open && filtered.length > 0;

    return (
        <div className="autosuggest" ref={wrapperRef}>
            <input
                type={type}
                className={`autosuggest__input ${className}`}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                placeholder={placeholder}
                aria-label={ariaLabel}
                aria-autocomplete="list"
                aria-expanded={showDropdown}
                role="combobox"
                autoComplete="off"
                {...rest}
            />
            {showDropdown && (
                <ul className="autosuggest__dropdown" ref={listRef} role="listbox">
                    {filtered.map((item, idx) => (
                        <li
                            key={item}
                            role="option"
                            aria-selected={idx === activeIdx}
                            className={`autosuggest__item${idx === activeIdx ? ' autosuggest__item--active' : ''}`}
                            onMouseDown={() => selectSuggestion(item)}
                            onMouseEnter={() => setActiveIdx(idx)}
                        >
                            {highlight(item)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

AutosuggestInput.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    onSelect: PropTypes.func,
    suggestions: PropTypes.arrayOf(PropTypes.string).isRequired,
    placeholder: PropTypes.string,
    className: PropTypes.string,
    ariaLabel: PropTypes.string,
    maxSuggestions: PropTypes.number,
    type: PropTypes.string,
};

export default AutosuggestInput;
