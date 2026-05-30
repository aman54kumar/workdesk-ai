export const TOOL_ICON_PATHS: Record<string, string> = {
  mail: 'M3 7.5A2.5 2.5 0 015.5 5h13A2.5 2.5 0 0121 7.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 16.5v-9zM4.5 7l7.5 6L19.5 7',
  chat: 'M5.5 5h13A2.5 2.5 0 0121 7.5v7A2.5 2.5 0 0118.5 17H9l-4.5 3v-3H5.5A2.5 2.5 0 013 14.5v-7A2.5 2.5 0 015.5 5z',
  document:
    'M7 3.5h6l4 4V20a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 016 20V5A1.5 1.5 0 017.5 3.5zM13 3.5V8h4M9 12h6M9 15.5h6M9 19h3',
  sparkles:
    'M12 3l1.7 4.5L18 9.2l-4.3 1.7L12 15.5l-1.7-4.6L6 9.2l4.3-1.7L12 3zM5 15l.9 2.3L8 18l-2.1.7L5 21l-.9-2.3L2 18l2.1-.7L5 15zM19 14l.7 1.8L21.5 16l-1.8.7L19 18.5l-.7-1.8-1.8-.7 1.8-.7L19 14z',
  language: 'M4 6h10M9 6c0 6-2.5 10-5 12m5-7H3m8.5 9L16 6l4.5 14M14 15h4',
  chart: 'M4 19h16M7.5 15V9m4.5 6V5m4.5 10v-4',
  shield: 'M12 3l7 3v6c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6l7-3z',
  code: 'M9 8l-4 4 4 4m6-8l4 4-4 4',
  commit: 'M8 12h8M3 12h2m14 0h2M12 16a4 4 0 100-8 4 4 0 000 8z',
  bug: 'M9 7.5h6m-5-2h4m-7 7h10m-9 4h8M9 7.5A3 3 0 0112 5a3 3 0 013 2.5v9A2.5 2.5 0 0112.5 19h-1A2.5 2.5 0 019 16.5v-9zM5 10.5h2m10 0h2M6 15h2m8 0h2',
  check: 'M4 13l5 5L20 7',
  wand: 'M12 4l8 4.5v7L12 20l-8-4.5v-7L12 4z',
};

export const TOOL_ICON_ACCENTS: Record<string, { bg: string; text: string; ring: string }> = {
  mail: { bg: 'bg-sky-500/15', text: 'text-sky-600 dark:text-sky-300', ring: 'group-hover:ring-sky-400/40' },
  chat: { bg: 'bg-violet-500/15', text: 'text-violet-600 dark:text-violet-300', ring: 'group-hover:ring-violet-400/40' },
  document: { bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300', ring: 'group-hover:ring-amber-400/40' },
  sparkles: { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-600 dark:text-fuchsia-300', ring: 'group-hover:ring-fuchsia-400/40' },
  language: { bg: 'bg-cyan-500/15', text: 'text-cyan-700 dark:text-cyan-300', ring: 'group-hover:ring-cyan-400/40' },
  chart: { bg: 'bg-indigo-500/15', text: 'text-indigo-600 dark:text-indigo-300', ring: 'group-hover:ring-indigo-400/40' },
  shield: { bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', ring: 'group-hover:ring-emerald-400/40' },
  code: { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-300', ring: 'group-hover:ring-blue-400/40' },
  commit: { bg: 'bg-orange-500/15', text: 'text-orange-700 dark:text-orange-300', ring: 'group-hover:ring-orange-400/40' },
  bug: { bg: 'bg-rose-500/15', text: 'text-rose-600 dark:text-rose-300', ring: 'group-hover:ring-rose-400/40' },
  check: { bg: 'bg-teal-500/15', text: 'text-teal-700 dark:text-teal-300', ring: 'group-hover:ring-teal-400/40' },
  wand: { bg: 'bg-purple-500/15', text: 'text-purple-600 dark:text-purple-300', ring: 'group-hover:ring-purple-400/40' },
};

export function toolIconPath(icon: string): string {
  return TOOL_ICON_PATHS[icon] ?? TOOL_ICON_PATHS['wand'];
}

export function toolIconAccent(icon: string) {
  return TOOL_ICON_ACCENTS[icon] ?? TOOL_ICON_ACCENTS['wand'];
}
