'use client';
import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import type { ClientType } from '@/lib/types';
import { GraduationCap, Building2, ChevronRight } from 'lucide-react';
import IndividualStudentForm from './IndividualStudentForm';
import SchoolClientForm from './SchoolClientForm';

interface AddClientModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ModalStep = 'select_type' | 'fill_form';

export default function AddClientModal({ open, onClose, onSuccess }: AddClientModalProps) {
  const [step, setStep] = useState<ModalStep>('select_type');
  const [selectedType, setSelectedType] = useState<ClientType | null>(null);

  const handleClose = () => {
    onClose();
    setTimeout(() => { setStep('select_type'); setSelectedType(null); }, 300);
  };

  const handleTypeSelect = (type: ClientType) => {
    setSelectedType(type);
    setStep('fill_form');
  };

  const handleBack = () => {
    setStep('select_type');
    setSelectedType(null);
  };

  const title = step === 'select_type' ?'Add New Client'
    : selectedType === 'individual' ? 'Add Individual Student' : 'Add School Client';

  const subtitle = step === 'select_type' ?'Choose the type of client you want to add'
    : step === 'fill_form'&& selectedType === 'individual' ?'Enter student and parent/guardian details' :'Enter school and contact person details';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      subtitle={subtitle}
      size="lg"
    >
      {step === 'select_type' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <button
            onClick={() => handleTypeSelect('individual')}
            className="flex flex-col items-start gap-3 p-5 rounded-xl text-left transition-all duration-200 hover:shadow-primary group"
            style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--primary-muted)' }}>
              <GraduationCap size={22} style={{ color: 'var(--primary)' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Individual Student</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground-muted)' }}>
                A single student with parent or guardian contact details, preferred communication method, and session notifications.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--primary)' }}>
              Select <ChevronRight size={13} />
            </div>
          </button>

          <button
            onClick={() => handleTypeSelect('school')}
            className="flex flex-col items-start gap-3 p-5 rounded-xl text-left transition-all duration-200 hover:shadow-accent group"
            style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--info-muted)' }}>
              <Building2 size={22} style={{ color: 'var(--info)' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>School Client</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground-muted)' }}>
                A school with a contact person, approximate learner range, and group session management.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--info)' }}>
              Select <ChevronRight size={13} />
            </div>
          </button>
        </div>
      )}

      {step === 'fill_form' && selectedType === 'individual' && (
        <IndividualStudentForm onBack={handleBack} onSuccess={onSuccess} />
      )}

      {step === 'fill_form' && selectedType === 'school' && (
        <SchoolClientForm onBack={handleBack} onSuccess={onSuccess} />
      )}
    </Modal>
  );
}