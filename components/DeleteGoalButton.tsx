'use client';

import { deleteGoalAction } from '@/app/goals/actions';

export default function DeleteGoalButton({ id }: { id: string }) {
  return (
    <form>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label="Delete goal"
        title="Delete goal"
        onClick={(e) => {
          if (!confirm('Delete this goal?')) e.preventDefault();
        }}
        formAction={deleteGoalAction}
        className="inline-flex h-7 w-7 items-center justify-center hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 rounded"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>
    </form>
  );
}
