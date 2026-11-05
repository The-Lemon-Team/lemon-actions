import { ArenaAccentColor } from '../../core/models/flow.models';

export function getAccentAvatarClasses(color: ArenaAccentColor, isHighlighted: boolean): string {
  if (isHighlighted) {
    return 'bg-primary-container text-on-primary-container border-primary';
  }
  switch (color) {
    case 'amber':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
    case 'emerald':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    case 'indigo':
      return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
    case 'rose':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
    case 'violet':
      return 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30';
    case 'cyan':
      return 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30';
  }
}

export function getAccentPillClasses(color: ArenaAccentColor): string {
  switch (color) {
    case 'amber':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30';
    case 'emerald':
      return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30';
    case 'indigo':
      return 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-200 border-indigo-500/30';
    case 'rose':
      return 'bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-500/30';
    case 'violet':
      return 'bg-violet-500/15 text-violet-800 dark:text-violet-200 border-violet-500/30';
    case 'cyan':
      return 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-200 border-cyan-500/30';
  }
}

export function getBarBgClass(color: ArenaAccentColor): string {
  switch (color) {
    case 'amber':
      return 'bg-amber-500';
    case 'emerald':
      return 'bg-emerald-500';
    case 'indigo':
      return 'bg-indigo-500';
    case 'rose':
      return 'bg-rose-500';
    case 'violet':
      return 'bg-violet-500';
    case 'cyan':
      return 'bg-cyan-500';
  }
}
