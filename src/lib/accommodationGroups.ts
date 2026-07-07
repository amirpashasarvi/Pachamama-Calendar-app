import { Room, DayOfWeek } from '@/types';

export interface AccommodationGroup {
  anchorId: string;
  kind: 'group' | 'room';
  label: string;
  rooms: Room[];
}

export const WEEKDAYS: { id: DayOfWeek; label: string }[] = [
  { id: 'Su', label: 'Su' }, { id: 'Mo', label: 'Mo' }, { id: 'Tu', label: 'Tu' },
  { id: 'We', label: 'We' }, { id: 'Th', label: 'Th' }, { id: 'Fr', label: 'Fr' }, { id: 'Sa', label: 'Sa' },
];

export function computeAccommodationGroups(rooms: Room[]): AccommodationGroup[] {
  const grouped = new Map<string, Room[]>();
  const individual: Room[] = [];
  for (const room of rooms) {
    const g = room.bookingGroup?.trim();
    if (g) {
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g)!.push(room);
    } else {
      individual.push(room);
    }
  }
  const result: AccommodationGroup[] = [];
  for (const [label, members] of grouped) {
    const sorted = [...members].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
    result.push({ anchorId: sorted[0].id, kind: 'group', label, rooms: sorted });
  }
  for (const room of individual) {
    result.push({ anchorId: room.id, kind: 'room', label: room.name, rooms: [room] });
  }
  result.sort((a, b) => Math.min(...a.rooms.map(r => r.order ?? 0)) - Math.min(...b.rooms.map(r => r.order ?? 0)));
  return result;
}

export function groupDisplayName(
  group: AccommodationGroup,
  pricingById?: Map<string, { publicName?: string }>,
): string {
  return pricingById?.get(group.anchorId)?.publicName ?? group.label;
}
