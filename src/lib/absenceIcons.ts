export const ABSENCE_ICONS: Record<number, string> = {
  1: 'lucide:Plane',           // Viagem
  2: 'lucide:Cross',           // Departamento Médico
  3: 'lucide:HeartHandshake',  // Pessoal
  4: 'lucide:CircleEllipsis',  // Outros
};

export function resolveAbsenceIcon(absenceType: number): string {
  return ABSENCE_ICONS[absenceType] ?? 'lucide:CircleEllipsis';
}

export const ABSENCE_TYPE_OPTIONS = [
  { value: 1, label: 'Viagem',              icon: ABSENCE_ICONS[1] },
  { value: 2, label: 'Departamento Médico', icon: ABSENCE_ICONS[2] },
  { value: 3, label: 'Pessoal',             icon: ABSENCE_ICONS[3] },
  { value: 4, label: 'Outros',              icon: ABSENCE_ICONS[4] },
] as const;
