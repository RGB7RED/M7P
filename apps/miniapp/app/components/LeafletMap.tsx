import dynamic from 'next/dynamic';

import type { LeafletMapProps } from './LeafletMapInternal';

const LeafletMap = dynamic(() => import('./LeafletMapInternal').then((mod) => mod.LeafletMap), {
  ssr: false,
});

export default LeafletMap;
export type { LeafletMapProps };
