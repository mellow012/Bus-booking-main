'use client';

import { Bus, Route } from '@/types';
import { BusFormState, ModalContext, ModalType, RouteFormState, ScheduleFormState } from '../../types';
import ModalShell from './ModalShell';
import AddRouteForm from './AddRouteForm';
import AddBusForm from './AddBusForm';

interface RegionsModalsProps {
  activeModal: ModalType;
  modalContext: ModalContext;
  saving: boolean;
  onClose: () => void;

  routeForm: RouteFormState;
  onRouteFormChange: (form: RouteFormState) => void;
  onSaveRoute: () => void;

  busForm: BusFormState;
  onBusFormChange: (form: BusFormState) => void;
  onSaveBus: () => void;
  routes: Route[];
  buses: Bus[];
}

export default function RegionsModals({
  activeModal,
  modalContext,
  saving,
  onClose,
  routeForm,
  onRouteFormChange,
  onSaveRoute,
  busForm,
  onBusFormChange,
  onSaveBus,
  routes,
  buses,
}: RegionsModalsProps) {
  if (!activeModal) return null;

  if (activeModal === 'addRoute') {
    return (
      <ModalShell title="Add New Route" saving={saving} onClose={onClose} onSave={onSaveRoute}>
        <AddRouteForm form={routeForm} onChange={onRouteFormChange} />
      </ModalShell>
    );
  }

  if (activeModal === 'addBus') {
    return (
      <ModalShell title="Add New Bus" saving={saving} onClose={onClose} onSave={onSaveBus}>
        <AddBusForm form={busForm} onChange={onBusFormChange} />
      </ModalShell>
    );
  }

  return null;
}