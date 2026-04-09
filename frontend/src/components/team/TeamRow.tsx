import { useMediaQuery } from '@/hooks/useMediaQuery';
import { TeamRowDesktop } from './TeamRowDesktop';
import { TeamSwipeRowMobile } from './TeamSwipeRowMobile';

export type TeamRowProps = {
  teamId: string;
  name: string;
  openSwipeId: string | null;
  onOpenSwipeId: (id: string | null) => void;
  disabled?: boolean;
  onRename: () => void;
  onJugadores: () => void;
  onDelete: () => void;
};

/** Fila de equipo: deslizar en móvil, iconos al hover en escritorio (patrón Sedes/canchas). */
export function TeamRow(props: TeamRowProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (isMobile) {
    return <TeamSwipeRowMobile {...props} />;
  }

  return (
    <TeamRowDesktop
      name={props.name}
      disabled={props.disabled}
      onRename={props.onRename}
      onJugadores={props.onJugadores}
      onDelete={props.onDelete}
    />
  );
}
