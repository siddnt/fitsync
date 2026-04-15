import { useEffect, useMemo, useRef, useState } from 'react';
import { prefixMatchScore } from '../../utils/search.js';
import './SearchSuggestInput.css';

const SearchSuggestInput = ({
  id,
  value,
  onChange,
  onSelect,
  suggestions = [],
  placeholder,
  ariaLabel,
  noResultsText = 'No matching suggestions.',
  className = '',
  inputClassName = '',
}) => {
  const containerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const normalizedValue = value.trim().toLowerCase();
  const visibleSuggestions = useMemo(() => {
    if (!normalizedValue) {
      return [];
    }
    return suggestions
      .map((s) => ({ ...s, _score: prefixMatchScore(s.label, normalizedValue) }))
      .filter((s) => s._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 8);
  }, [normalizedValue, suggestions]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleInputChange = (event) => {
    onChange(event.target.value);
    setIsOpen(true);
  };

  const handleSelect = (suggestion) => {
    onSelect?.(suggestion);
    setIsOpen(false);
  };

  return (
    <div className={['search-suggest', className].filter(Boolean).join(' ')} ref={containerRef}>
      <input
        id={id}
        type="search"
        className={['inventory-toolbar__input', 'search-suggest__input', inputClassName].filter(Boolean).join(' ')}
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        autoComplete="off"
        aria-label={ariaLabel}
      />

      {isOpen && normalizedValue ? (
        <div className="search-suggest__dropdown" role="listbox">
          {visibleSuggestions.length ? (
            visibleSuggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                className="search-suggest__option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(suggestion)}
              >
                <span className="search-suggest__option-label">{suggestion.label}</span>
                {suggestion.meta ? (
                  <span className="search-suggest__option-meta">{suggestion.meta}</span>
                ) : null}
              </button>
            ))
          ) : (
            <div className="search-suggest__empty">{noResultsText}</div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default SearchSuggestInput;
