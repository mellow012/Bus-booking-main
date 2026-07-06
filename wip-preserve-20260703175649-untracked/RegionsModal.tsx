'use client';

import { Bus, Route } from '@/types';
import { BusFormState, ModalContext, ModalType, RouteFormState, ScheduleFormState } from '../../types';
import ModalShell from './ModalShell';
import AddRouteForm from './AddRouteForm';
import AddBusForm from './AddBusForm';
import AddScheduleForm from './AddScheduleForm';

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

  scheduleForm: ScheduleFormState;
  onScheduleFormChange: (form: ScheduleFormState) => void;
  onSaveSchedule: () => void;
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
  scheduleForm,
  onScheduleFormChange,
  onSaveSchedule,
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

  const scheduleTitle = modalContext.isReturnSchedule ? 'Create Return Schedule' : 'Create Schedule';

  return (
    <ModalShell title={scheduleTitle} saving={saving} onClose={onClose} onSave={onSaveSchedule}>
      <AddScheduleForm form={scheduleForm} onChange={onScheduleFormChange} modalContext={modalContext} routes={routes} buses={buses} />
    </ModalShell>
  );
}