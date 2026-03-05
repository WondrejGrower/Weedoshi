import type { PlantCatalog } from './types';

export const plantCatalogData: PlantCatalog = {
  version: 1,
  items: [
    { id: 'cannabis-sativa', latin: 'Cannabis sativa', common: ['hemp', 'marijuana'], syn: ['c. sativa'] },
    { id: 'cannabis-indica', latin: 'Cannabis indica', common: ['indica'], syn: ['c. indica'] },
    { id: 'cannabis-ruderalis', latin: 'Cannabis ruderalis', common: ['ruderalis'], syn: ['c. ruderalis'] },
    { id: 'humulus-lupulus', latin: 'Humulus lupulus', common: ['hops'], syn: ['common hop'] },
    { id: 'nicotiana-tabacum', latin: 'Nicotiana tabacum', common: ['tobacco'], syn: ['cultivated tobacco'] },
    { id: 'ocimum-basilicum', latin: 'Ocimum basilicum', common: ['basil'], syn: ['sweet basil'] },
    { id: 'mentha-spicata', latin: 'Mentha spicata', common: ['spearmint'], syn: ['garden mint'] },
  ],
};
