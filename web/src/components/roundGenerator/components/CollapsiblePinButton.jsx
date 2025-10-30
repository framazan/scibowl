import React from 'react';
import { ChevronLeft, Pin, PinOff } from 'lucide-react';

export default function CollapsiblePinButton({
  leftPaneCollapsed,
  leftPanePinned,
  leftPaneHovered,
  setLeftPaneCollapsed,
  setLeftPanePinned,
  setLeftPaneHovered,
}) {
  return (
    <button
      className="absolute top-2 -right-2 bg-white dark:bg-darkcard border border-black/10 dark:border-white/20 rounded-full p-1 shadow hover:bg-gray-50 dark:hover:bg-white/10 transition z-10"
      onClick={() => {
        if (leftPaneCollapsed || !leftPanePinned) {
          setLeftPaneCollapsed(false);
          setLeftPanePinned(true);
        } else {
          setLeftPanePinned(false);
          setLeftPaneCollapsed(true);
        }
      }}
      onMouseEnter={() => setLeftPaneHovered(true)}
      onMouseLeave={() => setLeftPaneHovered(false)}
      title={leftPaneCollapsed ? 'Expand panel' : leftPanePinned ? 'Unpin panel' : 'Pin panel'}
    >
      {leftPaneCollapsed ? (
        leftPaneHovered ? <Pin className="h-4 w-4" /> : <ChevronLeft className={`h-4 w-4 transition-transform rotate-180`} />
      ) : leftPanePinned ? (
        <PinOff className="h-4 w-4" />
      ) : (
        <Pin className="h-4 w-4" />
      )}
    </button>
  );
}
