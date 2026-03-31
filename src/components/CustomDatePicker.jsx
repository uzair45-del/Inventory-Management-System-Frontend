import React, { useState, useRef } from 'react';
import { Calendar } from 'lucide-react';
import './CustomDatePicker.css';

const CustomDatePicker = ({ 
  value, 
  onChange, 
  label = "SELECT DATE", 
  placeholder = "DD/MM/YYYY",
  className = "",
  ...props 
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  
  // Convert YYYY-MM-DD to DD/MM/YYYY for display
  const formatDisplayDate = (dateString) => {
    if (!dateString) return placeholder;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return placeholder;
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  };
  
  const handleDisplayClick = () => {
    if (inputRef.current) {
      inputRef.current.showPicker ? inputRef.current.showPicker() : inputRef.current.focus();
    }
  };
  
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
  };
  
  const displayValue = formatDisplayDate(value);
  
  return (
    <div className={`custom-date-picker ${className}`}>
      <label className="date-picker-label">{label}</label>
      <div 
        className={`date-input-wrapper ${isFocused ? 'focused' : ''}`}
        onClick={handleDisplayClick}
      >
        <input
          ref={inputRef}
          type="date"
          className="date-input"
          value={value || ''}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        <div className="date-display">
          {displayValue}
        </div>
        <div className="date-icon">
          <Calendar size={20} />
        </div>
      </div>
    </div>
  );
};

export default CustomDatePicker;
