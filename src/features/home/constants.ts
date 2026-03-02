export const DEFAULT_HASHTAGS = ['weedstr', 'plantstr'];

export const DEFAULT_DIARY_CHAPTERS = [
  ...Array.from({ length: 10 }, (_, i) => ({
    key: `vegW${String(i + 1).padStart(2, '0')}`,
    label: `Veg Week ${i + 1}`,
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    key: `flowerW${String(i + 1).padStart(2, '0')}`,
    label: `Flower Week ${i + 1}`,
  })),
];
