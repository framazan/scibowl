import React from 'react';

export default function Loading({ className = "glass p-6", text = "Loading…" }) {
  return (
    <div className={className}>{text}</div>
  );
}