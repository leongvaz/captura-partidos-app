import { useMediaQuery } from '@/hooks/useMediaQuery';
import { JugadorRowDesktop } from './JugadorRowDesktop';
import { JugadorSwipeRowMobile } from './JugadorSwipeRowMobile';

export type JugadorRowProps = {
  jugadorId: string;
  numero: number;
  nombre: string;
  apellido: string;
  curp: string | null | undefined;
  openSwipeId: string | null;
  onOpenSwipeId: (id: string | null) => void;
  disabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export function JugadorRow(props: JugadorRowProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (isMobile) {
    return <JugadorSwipeRowMobile {...props} />;
  }

  return (
    <JugadorRowDesktop
      numero={props.numero}
      nombre={props.nombre}
      apellido={props.apellido}
      curp={props.curp}
      disabled={props.disabled}
      onEdit={props.onEdit}
      onDelete={props.onDelete}
    />
  );
}
