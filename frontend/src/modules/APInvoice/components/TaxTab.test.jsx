import React from 'react';
import { render, screen } from '@testing-library/react';
import TaxTab from './TaxTab';

test('uses isolated SAP B1 tax classes instead of generic document field classes', () => {
  const { container } = render(
    <TaxTab
      header={{ differentialTaxRate: '100' }}
      onHeaderChange={() => {}}
      onOpenTaxInfoModal={() => {}}
    />
  );

  expect(screen.getByText('Tax Information')).toHaveClass('sap-b1-tax-label');
  expect(screen.getByLabelText('Transaction Category')).toHaveClass('sap-b1-tax-control');
  expect(container.querySelector('.po-field')).not.toBeInTheDocument();
  expect(container.querySelector('.po-field__label')).not.toBeInTheDocument();
});
