import React from 'react';

const buttonStyle = {
  flex: '0 0 20px',
  width: 20,
  minWidth: 20,
  height: 22,
  padding: 0,
  border: '1px solid #c19a1d',
  borderRadius: 2,
  background: 'linear-gradient(180deg, #fff4b7 0%, #e0ad22 100%)',
  color: '#6f5200',
  fontSize: 11,
  fontWeight: 800,
  lineHeight: '18px',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.75)',
};

const disabledStyle = {
  opacity: 0.45,
  cursor: 'not-allowed',
};

export default function SapGoldenArrowButton({
  disabled = false,
  title = 'Open linked document',
  onClick,
  className = '',
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{ ...buttonStyle, ...(disabled ? disabledStyle : {}) }}
    >
      &gt;
    </button>
  );
}
