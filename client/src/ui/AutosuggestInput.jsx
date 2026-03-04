import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import './AutosuggestInput.css';

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

  const filtered = useMemo(() => {
    const query = (value ?? '').trim().toLowerCase();
    if (!query) {
      return [];
    }

    const seen = new Set();
    const results = [];

    for (const suggestion of suggestions) {
      if (!suggestion) {
        continue;
      }

      const lower = suggestion.toLowerCase();
      if (seen.has(lower)) {
        continue;
      }

      if (lower.includes(query) && lower !== query) {
        seen.add(lower);
        results.push(suggestion);
        if (results.length >= maxSuggestions) {
          break;
        }
      }
    }

    return results;
  }, [value, suggestions, maxSuggestions]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    setActiveIdx(-1);
  }, [filtered]);

  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const item = listRef.current.children[activeIdx];
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIdx]);

  const handleChange = useCallback((event) => {
    onChange(event.target.value);
    setOpen(true);
  }, [onChange]);

  const selectSuggestion = useCallback((text) => {
    onChange(text);
    if (typeof onSelect === 'function') {
      onSelect(text);
    }
    setOpen(false);
  }, [onChange, onSelect]);

  const handleKeyDown = useCallback((event) => {
    if (!open || filtered.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIdx((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIdx((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (event.key === 'Enter' && activeIdx >= 0) {
      event.preventDefault();
      selectSuggestion(filtered[activeIdx]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }, [open, filtered, activeIdx, selectSuggestion]);

  const handleFocus = useCallback(() => {
    if (filtered.length > 0) {
      setOpen(true);
    }
  }, [filtered]);

  const highlight = (text) => {
    const query = (value ?? '').trim().toLowerCase();
    if (!query) {
      return text;
    }

    const index = text.toLowerCase().indexOf(query);
    if (index === -1) {
      return text;
    }

    return (
      <>
        {text.slice(0, index)}
        <mark>{text.slice(index, index + query.length)}</mark>
        {text.slice(index + query.length)}
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
          {filtered.map((item, index) => (
            <li
              key={item}
              role="option"
              aria-selected={index === activeIdx}
              className={`autosuggest__item${index === activeIdx ? ' autosuggest__item--active' : ''}`}
              onMouseDown={() => selectSuggestion(item)}
              onMouseEnter={() => setActiveIdx(index)}
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
