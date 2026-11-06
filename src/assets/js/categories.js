// Event categories map to TPA's existing programs. Used by the calendar and the admin portal.
export const CATEGORIES = [
  { id: 'adopt-the-block', label: 'Adopt The Block' },
  { id: 'meeting', label: 'Community Meeting' },
  { id: 'economy', label: 'Peoples Economy' },
  { id: 'community', label: 'Detroit Peoples Community' },
  { id: 'army', label: 'Peoples Army' },
  { id: 'politics', label: 'Peoples Politics' },
];
export const CHAPTERS = [
  { id: 'detroit', label: 'Detroit' },
  { id: 'houston', label: 'Houston' },
];
export const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || 'Community';
