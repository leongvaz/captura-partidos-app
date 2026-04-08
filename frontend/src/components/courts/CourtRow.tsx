import { useMediaQuery } from '@/hooks/useMediaQuery';
import { CourtRowDesktop } from './CourtRowDesktop';
import { CourtRowMobile } from './CourtRowMobile';

export type CourtRowProps = {
  courtId: string;
  name: string;
  openSwipeId: string | null;
  onOpenSwipeId: (id: string | null) => void;
  disabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * Fila de cancha: swipe en móvil (≤767px), hover + iconos en escritorio.
 */
export function CourtRow(props: CourtRowProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (isMobile) {
    return <CourtRowMobile {...props} />;
  }

  return (
    <CourtRowDesktop
      name={props.name}
      disabled={props.disabled}
      onEdit={props.onEdit}
      onDelete={props.onDelete}
    />
  );
}
