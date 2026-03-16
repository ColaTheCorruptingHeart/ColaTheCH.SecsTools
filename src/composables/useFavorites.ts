import { ref, watch } from 'vue';

const STORAGE_KEY = 'cola_tools_favorites';

const loadFavorites = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load favorites', e);
  }
  return [];
};

export const favoriteIds = ref<string[]>(loadFavorites());

watch(
  favoriteIds,
  (newVal) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newVal));
  },
  { deep: true }
);

export const toggleFavorite = (id: string, e?: Event) => {
  if (e) {
    e.stopPropagation();
  }
  const idx = favoriteIds.value.indexOf(id);
  if (idx > -1) {
    favoriteIds.value.splice(idx, 1);
  } else {
    favoriteIds.value.push(id);
  }
};

export const isFavorite = (id: string) => favoriteIds.value.includes(id);
