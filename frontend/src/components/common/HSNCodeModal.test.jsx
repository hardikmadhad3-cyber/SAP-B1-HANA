import { fireEvent, render, screen } from '@testing-library/react';
import HSNCodeModal from './HSNCodeModal';
import { fetchHSNCodes, fetchSACCodes } from '../../api/hsnCodeApi';

jest.mock('../../api/hsnCodeApi', () => ({
  fetchHSNCodes: jest.fn(),
  fetchSACCodes: jest.fn(),
}));

const baseProps = {
  isOpen: true,
  onClose: jest.fn(),
  onSelect: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchHSNCodes.mockResolvedValue({
    data: [{ code: '0101', heading: '01', subHeading: '0101', description: 'Live horses' }],
  });
  fetchSACCodes.mockResolvedValue({
    data: [{ serviceCode: '9983', serviceName: 'Consulting', description: 'Business services' }],
  });
});

test('renders HSN mode by default and selects a row', async () => {
  render(<HSNCodeModal {...baseProps} />);

  expect(await screen.findByText('List of India Chapter ID')).toBeInTheDocument();
  fireEvent.click(await screen.findByText('Live horses'));
  fireEvent.click(screen.getByText('Choose'));

  expect(fetchHSNCodes).toHaveBeenCalledWith('');
  expect(baseProps.onSelect).toHaveBeenCalledWith(expect.objectContaining({ code: '0101' }));
});

test('renders SAC mode', async () => {
  render(<HSNCodeModal {...baseProps} mode="sac" />);

  expect(await screen.findByText('List of India SAC Codes')).toBeInTheDocument();
  expect(await screen.findByText('9983')).toBeInTheDocument();
  expect(fetchSACCodes).toHaveBeenCalledWith('');
});
