import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../purchase-order/styles/purchaseOrder.css';
import '../goods-receipt/styles/goodsReceipt.css';
import './styles/inventoryTransferRequest.css';
import BusinessPartnerModal from '../sales-order/components/BusinessPartnerModal';
import ContentsTab from './components/ContentsTab';
import AttachmentsTab from './components/AttachmentsTab';
import ItemSelectionModal from '../goods-receipt/components/ItemSelectionModal';
import {
  fetchInventoryTransferRequestBusinessPartnerDetails,
  fetchInventoryTransferRequestByDocEntry,
  fetchInventoryTransferRequestItems,
  fetchInventoryTransferRequestMetadata,
  fetchInventoryTransferRequestSeries,
  fetchInventoryTransferRequestWarehouses,
  submitInventoryTransferRequest,
  updateInventoryTransferRequest,
} from '../../api/inventoryTransferRequestApi';

const TAB_NAMES = ['Contents', 'Attachments'];
const today = () => new Date().toISOString().split('T')[0];

const createLine = () => ({
  itemCode: '',
  itemDescription: '',
  fromWarehouse: '',
  toWarehouse: '',
  location: '',
  quantity: '',
  distributionRule: '',
  uomCode: '',
  uomName: '',
  branch: '',
  assessableValue: '',
});

const createHeader = () => ({
  number: 'Auto',
  series: '',
  status: 'Open',
  postingDate: today(),
  dueDate: today(),
  documentDate: today(),
  businessPartner: '',
  businessPartnerName: '',
  contactPerson: '',
  shipTo: '',
  shipToAddress: '',
  vat: false,
  priceList: '',
  fromBranch: '',
  fromWarehouse: '',
  toWarehouse: '',
  referencedDocument: '',
  salesEmployee: '',
  dutyStatus: 'With Payment of Duty',
  journalRemark: 'Inventory Transfer Request',
  pickPackRemarks: '',
  remarks: '',
  createQrCodeFrom: '',
});

function InventoryTransferRequest() {
  const location = useLocation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const attachmentsRef = useRef([]);
  const [currentDocEntry, setCurrentDocEntry] = useState(null);
  const [header, setHeader] = useState(createHeader);
  const [lines, setLines] = useState([createLine()]);
  const [attachments, setAttachments] = useState([]);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState(null);
  const [activeTab, setActiveTab] = useState('Contents');
  const [activeRow, setActiveRow] = useState(0);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [seriesOptions, setSeriesOptions] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [branches, setBranches] = useState([]);
  const [businessPartners, setBusinessPartners] = useState([]);
  const [contactOptions, setContactOptions] = useState([]);
  const [shipToOptions, setShipToOptions] = useState([]);
  const [pageState, setPageState] = useState({
    loading: false,
    posting: false,
    partnerLoading: false,
    error: '',
    success: '',
  });
  const [valErrors, setValErrors] = useState({
    header: {},
    lines: {},
    form: '',
  });
  const [itemModal, setItemModal] = useState({
    open: false,
    lineIndex: -1,
  });
  const [bpModal, setBpModal] = useState(false);

  const currentSeriesOption =
    seriesOptions.find((seriesOption) => seriesOption.series === String(header.series)) ||
    seriesOptions[0] ||
    null;
  const defaultPriceList = priceLists[0] || null;
  const defaultBranch = branches[0] || null;
  const selectedBusinessPartner = useMemo(
    () =>
      businessPartners.find(
        (partner) => partner.cardCode === String(header.businessPartner || '')
      ) || null,
    [businessPartners, header.businessPartner]
  );
  const businessPartnerModalItems = useMemo(
    () =>
      businessPartners.map((partner) => ({
        CardCode: partner.cardCode,
        CardName: partner.cardName,
        CardType: partner.cardType,
        Balance: partner.currentAccountBalance ?? partner.balance ?? 0,
        CurrentAccountBalance: partner.currentAccountBalance ?? partner.balance ?? 0,
        balance: partner.currentAccountBalance ?? partner.balance ?? 0,
        currentAccountBalance: partner.currentAccountBalance ?? partner.balance ?? 0,
      })),
    [businessPartners]
  );
  const fromWarehouseOptions = header.fromBranch
    ? warehouses.filter(
        (warehouse) =>
          !warehouse.branchId || warehouse.branchId === String(header.fromBranch)
      )
    : warehouses;
  const selectedShipTo =
    shipToOptions.find((address) => address.id === header.shipTo) ||
    shipToOptions.find((address) => address.label === header.shipTo) ||
    null;

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setPageState((current) => ({ ...current, loading: true, error: '', success: '' }));

      try {
        const [
          metadataResponse,
          itemsResponse,
          warehousesResponse,
          seriesResponse,
        ] = await Promise.all([
          fetchInventoryTransferRequestMetadata(),
          fetchInventoryTransferRequestItems(),
          fetchInventoryTransferRequestWarehouses(),
          fetchInventoryTransferRequestSeries(),
        ]);

        if (ignore) return;

        const metadata = metadataResponse.data || {};
        const loadedSeries = seriesResponse.data || [];
        const initialSeries = loadedSeries[0] || null;
        const initialPriceList = metadata.priceLists?.[0] || null;
        const initialBranch = metadata.branches?.[0] || null;

        setItems(itemsResponse.data || []);
        setWarehouses(warehousesResponse.data || []);
        setSeriesOptions(loadedSeries);
        setPriceLists(metadata.priceLists || []);
        setBranches(metadata.branches || []);
        setBusinessPartners(metadata.businessPartners || []);
        setHeader((current) => ({
          ...current,
          series: current.series || initialSeries?.series || '',
          number: initialSeries?.nextNumber || current.number,
          priceList: current.priceList || initialPriceList?.id || '',
          fromBranch: current.fromBranch || initialBranch?.id || '',
        }));
      } catch (error) {
        if (!ignore) {
          setPageState((current) => ({
            ...current,
            error:
              error.response?.data?.message ||
              error.message ||
              'Failed to load Inventory Transfer Request reference data.',
          }));
        }
      } finally {
        if (!ignore) {
          setPageState((current) => ({ ...current, loading: false }));
        }
      }
    };

    load();

    return () => {
      ignore = true;
      attachmentsRef.current.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    const docEntry = location.state?.inventoryTransferRequestDocEntry;
    if (!docEntry) return;

    let ignore = false;

    const load = async () => {
      setPageState((current) => ({ ...current, loading: true, error: '', success: '' }));

      try {
        const response = await fetchInventoryTransferRequestByDocEntry(docEntry);
        const document = response.data;
        if (ignore || !document) return;

        setCurrentDocEntry(document.docEntry || Number(docEntry));
        setHeader(() => ({
          ...createHeader(),
          ...document.header,
        }));
        setLines(
          Array.isArray(document.lines) && document.lines.length
            ? document.lines.map((line) => ({ ...createLine(), ...line }))
            : [{
                ...createLine(),
                fromWarehouse: document.header?.fromWarehouse || '',
                toWarehouse: document.header?.toWarehouse || '',
                branch: document.header?.toWarehouse
                  ? getWarehouseBranch(document.header.toWarehouse)
                  : '',
              }]
        );
        setAttachments([]);
        setSelectedAttachmentId(null);
        setActiveTab('Contents');
        setValErrors({ header: {}, lines: {}, form: '' });
        setPageState((current) => ({
          ...current,
          success: document.docNum
            ? `Inventory Transfer Request ${document.docNum} loaded.`
            : 'Inventory Transfer Request loaded.',
        }));
      } catch (error) {
        if (!ignore) {
          setPageState((current) => ({
            ...current,
            error:
              error.response?.data?.message ||
              error.message ||
              'Failed to load inventory transfer request.',
          }));
        }
      } finally {
        if (!ignore) {
          setPageState((current) => ({ ...current, loading: false }));
          navigate(location.pathname, { replace: true, state: null });
        }
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!header.businessPartner) {
      setContactOptions([]);
      setShipToOptions([]);
      return;
    }

    let ignore = false;

    const loadBusinessPartnerDetails = async () => {
      setPageState((current) => ({ ...current, partnerLoading: true }));
      try {
        const response = await fetchInventoryTransferRequestBusinessPartnerDetails(
          header.businessPartner
        );
        if (ignore) return;

        const data = response.data || {};
        const nextContacts = data.contacts || [];
        const nextShipToAddresses = data.shipToAddresses || [];

        setContactOptions(nextContacts);
        setShipToOptions(nextShipToAddresses);
        setHeader((current) => ({
          ...current,
          businessPartnerName:
            selectedBusinessPartner?.cardName || current.businessPartnerName,
          contactPerson:
            current.contactPerson || nextContacts[0]?.id || '',
          shipTo: current.shipTo || nextShipToAddresses[0]?.id || '',
          shipToAddress:
            nextShipToAddresses.find((address) => address.id === current.shipTo)?.fullAddress ||
            nextShipToAddresses.find((address) => address.label === current.shipTo)?.fullAddress ||
            current.shipToAddress ||
            '',
        }));
      } catch (error) {
        if (!ignore) {
          setPageState((current) => ({
            ...current,
            error:
              error.response?.data?.message ||
              error.message ||
              'Failed to load business partner details.',
          }));
        }
      } finally {
        if (!ignore) {
          setPageState((current) => ({ ...current, partnerLoading: false }));
        }
      }
    };

    loadBusinessPartnerDetails();

    return () => {
      ignore = true;
    };
  }, [header.businessPartner, selectedBusinessPartner]);

  const getWarehouseByCode = (whsCode) =>
    warehouses.find((warehouse) => warehouse.whsCode === String(whsCode || ''));

  const getWarehouseBranch = (whsCode) => getWarehouseByCode(whsCode)?.branchId || '';
  const getWarehouseBranchDisplay = (whsCode, branchId = '') => {
    const warehouse = getWarehouseByCode(whsCode);
    if (warehouse?.city) return warehouse.city;
    if (warehouse?.branchId) {
      const branch = branches.find((entry) => String(entry.id || '') === String(warehouse.branchId));
      if (branch?.name) return branch.name;
    }
    if (branchId) {
      const branch = branches.find((entry) => String(entry.id || '') === String(branchId));
      if (branch?.name) return branch.name;
    }
    return branchId || '';
  };

  const getItem = (itemCode) => items.find((item) => item.itemCode === itemCode);

  const getItemPrice = (item, priceList) => {
    if (!item) return 0;
    if (priceList && item.prices && item.prices[String(priceList)] != null) {
      return Number(item.prices[String(priceList)] || 0);
    }
    return Number(item.lastPurchasePrice || item.itemCost || 0);
  };

  const normalizeLine = (line) => {
    const quantity = Number(line.quantity || 0);
    const item = getItem(line.itemCode);
    const price = getItemPrice(item, header.priceList);

    return {
      ...line,
      quantity: line.quantity === '' ? '' : String(line.quantity),
      branch: line.branch || getWarehouseBranch(line.toWarehouse),
      assessableValue:
        quantity > 0
          ? (quantity * price).toFixed(2)
          : line.assessableValue || '0.00',
    };
  };

  const patchLineFromItem = (line, itemCode, priceList = header.priceList) => {
    const item = getItem(itemCode);
    if (!item) {
      return normalizeLine({
        ...createLine(),
        branch: getWarehouseBranch(header.toWarehouse),
      });
    }

    return normalizeLine({
      ...line,
      itemCode: item.itemCode,
      itemDescription: item.itemName,
      fromWarehouse: line.fromWarehouse || header.fromWarehouse || item.defaultWarehouse || '',
      toWarehouse: line.toWarehouse || header.toWarehouse || '',
      uomCode: item.uomCode || '',
      uomName: item.uomName || '',
      branch: line.branch || getWarehouseBranch(line.toWarehouse || header.toWarehouse),
      assessableValue: line.assessableValue || String(getItemPrice(item, priceList)),
    });
  };

  const handleHeaderChange = (field, value) => {
    setHeader((current) => {
      const next = { ...current, [field]: value };
      if (field === 'series') {
        const selectedSeries = seriesOptions.find(
          (seriesOption) => seriesOption.series === String(value)
        );
        next.number = selectedSeries?.nextNumber || 'Auto';
      }
      if (field === 'businessPartner') {
        const matchedPartner = businessPartners.find(
          (partner) => partner.cardCode === String(value)
        );
        next.businessPartnerName =
          matchedPartner?.cardName || '';
        next.contactPerson = '';
        next.shipTo = '';
        next.shipToAddress = '';
        next.priceList = matchedPartner?.priceList || next.priceList;
      }
      if (field === 'shipTo') {
        next.shipToAddress =
          shipToOptions.find((address) => address.id === value)?.fullAddress ||
          shipToOptions.find((address) => address.label === value)?.fullAddress ||
          '';
      }
      return next;
    });

    if (field === 'priceList') {
      setLines((current) =>
        current.map((line) =>
          line.itemCode ? patchLineFromItem(line, line.itemCode, value) : line
        )
      );
    }

    if (field === 'fromBranch') {
      setLines((current) =>
        current.map((line) => ({
          ...line,
          branch: line.toWarehouse ? getWarehouseBranch(line.toWarehouse) : line.branch,
        }))
      );
    }

    if (field === 'fromWarehouse') {
      setLines((current) =>
        current.map((line) => ({
          ...line,
          fromWarehouse: value,
        }))
      );
    }

    if (field === 'toWarehouse') {
      setLines((current) =>
        current.map((line) => ({
          ...line,
          toWarehouse: value,
          branch: value ? getWarehouseBranch(value) : '',
        }))
      );
    }
  };

  const openBpModal = () => {
    setBpModal(true);
  };

  const closeBpModal = () => {
    setBpModal(false);
  };

  const selectBusinessPartner = (cardCode) => {
    handleHeaderChange('businessPartner', cardCode);
  };

  const handleBusinessPartnerInputChange = (value) => {
    setHeader((current) => ({
      ...current,
      businessPartner: value,
      businessPartnerName:
        businessPartners.find(
          (partner) => partner.cardCode === String(value || '').trim()
        )?.cardName || '',
      contactPerson: '',
      shipTo: '',
      shipToAddress: '',
    }));
  };

  const commitBusinessPartnerInput = () => {
    const businessPartnerCode = String(header.businessPartner || '').trim();

    if (!businessPartnerCode) {
      handleHeaderChange('businessPartner', '');
      return;
    }

    const matchedPartner = businessPartners.find(
      (partner) => partner.cardCode.toLowerCase() === businessPartnerCode.toLowerCase()
    );

    if (matchedPartner) {
      selectBusinessPartner(matchedPartner.cardCode);
    }
  };

  const handleBpSelect = (bp) => {
    const cardCode = bp?.CardCode || bp?.cardCode || '';
    if (!cardCode) return;
    selectBusinessPartner(cardCode);
  };

  const handleItemChange = (rowIndex, itemCode) => {
    setLines((current) =>
      current.map((line, index) =>
        index === rowIndex ? patchLineFromItem({ ...line, itemCode }, itemCode) : line
      )
    );
  };

  const handleItemCodeChange = (rowIndex, itemCode) => {
    setLines((current) =>
      current.map((line, index) => (index === rowIndex ? { ...line, itemCode } : line))
    );
  };

  const handleItemCommit = (rowIndex) => {
    const line = lines[rowIndex];
    const itemCode = String(line?.itemCode || '').trim();

    if (!itemCode) return;
    if (!getItem(itemCode)) return;

    handleItemChange(rowIndex, itemCode);
  };

  const handleLineChange = (rowIndex, field, value) => {
    setLines((current) =>
      current.map((line, index) => {
        if (index !== rowIndex) return line;

        const nextLine = { ...line, [field]: value };
        if (field === 'toWarehouse') {
          nextLine.branch = value ? getWarehouseBranch(value) : '';
        }
        return normalizeLine(nextLine);
      })
    );
  };

  const addLine = () => {
    setLines((current) => [
      ...current,
      {
        ...createLine(),
        fromWarehouse: header.fromWarehouse || '',
        toWarehouse: header.toWarehouse || '',
        branch: getWarehouseBranch(header.toWarehouse),
      },
    ]);
  };

  const removeLine = (rowIndex) => {
    setLines((current) => {
      if (current.length === 1) {
        return [
          {
            ...createLine(),
            fromWarehouse: header.fromWarehouse || '',
            toWarehouse: header.toWarehouse || '',
            branch: getWarehouseBranch(header.toWarehouse),
          },
        ];
      }
      return current.filter((_, index) => index !== rowIndex);
    });
  };

  const validateDocument = () => {
    const nextErrors = { header: {}, lines: {}, form: '' };
    const activeLines = lines.filter((line) => line.itemCode);

    if (!header.postingDate) nextErrors.header.postingDate = 'Posting Date is required';
    if (!header.dueDate) nextErrors.header.dueDate = 'Due Date is required';
    if (!header.documentDate) nextErrors.header.documentDate = 'Document Date is required';

    if (!activeLines.length) {
      nextErrors.form = 'Add at least one line before saving.';
    }

    lines.forEach((line, index) => {
      if (!line.itemCode) return;

      const rowErrors = {};
      if (!line.itemCode) rowErrors.itemCode = 'Item required';
      if (line.itemCode && !getItem(line.itemCode)) rowErrors.itemCode = 'Invalid item';
      if (Number(line.quantity || 0) <= 0) rowErrors.quantity = 'Qty > 0';
      if (!(line.fromWarehouse || header.fromWarehouse)) {
        rowErrors.fromWarehouse = 'Required';
      }
      if (!(line.toWarehouse || header.toWarehouse)) {
        rowErrors.toWarehouse = 'Required';
      }

      if (Object.keys(rowErrors).length) {
        nextErrors.lines[index] = rowErrors;
      }
    });

    if (
      !nextErrors.form &&
      (Object.keys(nextErrors.header).length || Object.keys(nextErrors.lines).length)
    ) {
      nextErrors.form = 'Fix the highlighted fields before saving.';
    }

    setValErrors(nextErrors);
    return (
      !nextErrors.form &&
      Object.keys(nextErrors.header).length === 0 &&
      Object.keys(nextErrors.lines).length === 0
    );
  };

  const resetForm = (options = {}) => {
    const { successMessage = '' } = options;
    const nextSeries = currentSeriesOption?.series || '';
    const nextBranch = header.fromBranch || defaultBranch?.id || '';

    setCurrentDocEntry(null);
    setHeader(() => ({
      ...createHeader(),
      series: nextSeries,
      number: currentSeriesOption?.nextNumber || 'Auto',
      priceList: header.priceList || defaultPriceList?.id || '',
      fromBranch: nextBranch,
    }));
    setLines([{ ...createLine() }]);
    attachmentsRef.current.forEach((attachment) => {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    });
    setAttachments([]);
    setSelectedAttachmentId(null);
    setActiveTab('Contents');
    setValErrors({ header: {}, lines: {}, form: '' });
    setPageState((current) => ({
      ...current,
      error: '',
      success: successMessage,
      posting: false,
    }));
  };

  const handleBrowseAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleAttachmentFiles = (event) => {
    const incomingFiles = Array.from(event.target.files || []);
    if (!incomingFiles.length) return;

    const addedIds = [];

    setAttachments((current) => {
      const next = [...current];
      incomingFiles.forEach((file) => {
        const id = `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2)}`;
        addedIds.push(id);
        next.push({
          id,
          targetPath: 'Local Upload',
          fileName: file.name,
          attachmentDate: today(),
          freeText: '',
          previewUrl: URL.createObjectURL(file),
          file,
        });
      });
      return next;
    });

    setSelectedAttachmentId(addedIds[0] || null);
    event.target.value = '';
  };

  const handleDisplayAttachment = () => {
    const target = attachments.find((attachment) => attachment.id === selectedAttachmentId);
    if (target?.previewUrl) {
      window.open(target.previewUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDeleteAttachment = () => {
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === selectedAttachmentId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((attachment) => attachment.id !== selectedAttachmentId);
    });
    setSelectedAttachmentId(null);
  };

  const handleAttachmentFreeTextChange = (attachmentId, freeText) => {
    setAttachments((current) =>
      current.map((attachment) =>
        attachment.id === attachmentId ? { ...attachment, freeText } : attachment
      )
    );
  };

  const openItemModal = (rowIndex) => {
    setItemModal({
      open: true,
      lineIndex: rowIndex,
    });
  };

  const closeItemModal = () => {
    setItemModal({
      open: false,
      lineIndex: -1,
    });
  };

  const handleItemSelect = (item) => {
    const lineIndex = itemModal.lineIndex;
    const itemCode = item?.itemCode || item?.ItemCode || '';

    if (lineIndex < 0 || !itemCode) {
      closeItemModal();
      return;
    }

    handleItemChange(lineIndex, itemCode);
    setActiveRow(lineIndex);
    closeItemModal();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateDocument()) {
      setPageState((current) => ({
        ...current,
        error: 'Fix the highlighted fields before saving.',
        success: '',
      }));
      return;
    }

    setPageState((current) => ({ ...current, posting: true, error: '', success: '' }));

    try {
      const payload = {
        header,
        lines: lines
          .filter((line) => line.itemCode)
          .map((line) => ({
            itemCode: line.itemCode,
            itemDescription: line.itemDescription,
            fromWarehouse: line.fromWarehouse || header.fromWarehouse,
            toWarehouse: line.toWarehouse || header.toWarehouse,
            location: line.location,
            quantity: Number(line.quantity || 0),
            distributionRule: line.distributionRule,
            uomCode: line.uomCode,
            uomName: line.uomName,
            branch: line.branch,
            assessableValue: Number(line.assessableValue || 0),
          })),
        attachments: attachments.map((attachment) => ({
          targetPath: attachment.targetPath,
          fileName: attachment.fileName,
          attachmentDate: attachment.attachmentDate,
          freeText: attachment.freeText,
        })),
      };

      const response = currentDocEntry
        ? await updateInventoryTransferRequest(currentDocEntry, payload)
        : await submitInventoryTransferRequest(payload);
      const result = response.data || {};
      const successMessage = `${
        result.message || 'Inventory Transfer Request saved successfully.'
      } DocEntry: ${result.docEntry}, DocNum: ${result.docNum}`;

      if (!currentDocEntry) {
        resetForm({ successMessage });
        return;
      }

      setPageState((current) => ({
        ...current,
        posting: false,
        success: successMessage,
      }));

      if (result.docEntry != null) {
        setCurrentDocEntry(Number(result.docEntry));
      }
      setHeader((current) => ({
        ...current,
        number: result.docNum != null ? String(result.docNum) : current.number,
        status: 'Open',
      }));
      setValErrors({ header: {}, lines: {}, form: '' });
    } catch (error) {
      setPageState((current) => ({
        ...current,
        posting: false,
        error:
          error.response?.data?.message ||
          error.message ||
          'Failed to save Inventory Transfer Request.',
      }));
    }
  };

  const totalQuantity = lines
    .filter((line) => line.itemCode)
    .reduce((sum, line) => sum + Number(line.quantity || 0), 0)
    .toFixed(2);

  return (
    <form className="po-page itr-transfer-request__page" onSubmit={handleSubmit}>
      <div className="po-toolbar">
        <div className="po-toolbar__title">
          Inventory Transfer Request
          {currentDocEntry ? ` - #${header.number || currentDocEntry}` : ''}
        </div>
        <span className={`po-mode-badge po-mode-badge--${currentDocEntry ? 'update' : 'add'}`}>
          {currentDocEntry ? 'Update' : 'Add'} Mode
        </span>
        <button type="submit" className="po-btn po-btn--primary" disabled={pageState.posting}>
          {pageState.posting ? 'Saving...' : currentDocEntry ? 'Update' : 'Add'}
        </button>
        <button
          type="button"
          className="po-btn po-btn--danger"
          onClick={resetForm}
          disabled={pageState.posting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="po-btn"
          onClick={() => navigate('/inventory-transfer-request/find')}
        >
          Find
        </button>
        <button type="button" className="po-btn" onClick={resetForm}>
          New
        </button>
        {pageState.loading && (
          <span className="po-alert po-alert--warning" style={{ margin: 0 }}>
            Loading...
          </span>
        )}
      </div>

      {pageState.error && <div className="po-alert po-alert--error">{pageState.error}</div>}
      {pageState.success && <div className="po-alert po-alert--success">{pageState.success}</div>}

      <div className="po-header-card">
        <div className="itr-transfer-request__header-grid">
          <div className="itr-transfer-request__header-column">
            <div className="po-field">
              <label className="po-field__label">Business Partner</label>
              <div className="itr-transfer-request__selector">
                <input
                  className={`po-field__input${
                    valErrors.header.businessPartner ? ' po-field__input--error' : ''
                  }`}
                  value={header.businessPartner}
                  placeholder="Business Partner Code"
                  onChange={(event) =>
                    handleBusinessPartnerInputChange(event.target.value)
                  }
                  onBlur={commitBusinessPartnerInput}
                />
                <button
                  type="button"
                  className="po-btn"
                  onClick={openBpModal}
                  title="Select Business Partner"
                  style={{ minWidth: 36, paddingInline: 0 }}
                >
                  ...
                </button>
              </div>
            </div>
            <div className="po-field">
              <label className="po-field__label">Name</label>
              <input className="po-field__input" value={header.businessPartnerName} readOnly />
            </div>
            <div className="po-field">
              <label className="po-field__label">Contact Person</label>
              <select
                className="po-field__select"
                value={header.contactPerson}
                onChange={(event) => handleHeaderChange('contactPerson', event.target.value)}
                disabled={!header.businessPartner || pageState.partnerLoading}
              >
                <option value="">Select Contact</option>
                {contactOptions.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="po-field">
              <label className="po-field__label">Ship To</label>
              <select
                className="po-field__select"
                value={header.shipTo}
                onChange={(event) => handleHeaderChange('shipTo', event.target.value)}
                disabled={!header.businessPartner || pageState.partnerLoading}
              >
                <option value="">Select Ship To</option>
                {shipToOptions.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="po-field" style={{ alignItems: 'flex-start' }}>
              <label className="po-field__label" style={{ paddingTop: 4 }}>
                Address
              </label>
              <textarea
                className="po-textarea itr-transfer-request__address"
                rows={4}
                value={selectedShipTo?.fullAddress || header.shipToAddress || ''}
                readOnly
              />
            </div>
            <label className="po-field" style={{ alignItems: 'center', gap: 10 }}>
              <span className="po-field__label">VAT</span>
              <input
                type="checkbox"
                checked={header.vat}
                onChange={(event) => handleHeaderChange('vat', event.target.checked)}
              />
            </label>
            <div className="po-field">
              <label className="po-field__label">Price List</label>
              <select
                className="po-field__select"
                value={header.priceList}
                onChange={(event) => handleHeaderChange('priceList', event.target.value)}
              >
                <option value="">Select Price List</option>
                {priceLists.map((priceList) => (
                  <option key={priceList.id} value={priceList.id}>
                    {priceList.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="itr-transfer-request__header-column itr-transfer-request__header-column--compact">
            <div className="po-field">
              <label className="po-field__label">No.</label>
              <div className="itr-transfer-request__selector">
                <select
                  className="po-field__select"
                  value={header.series}
                  onChange={(event) => handleHeaderChange('series', event.target.value)}
                >
                  <option value="">Select Series</option>
                  {seriesOptions.map((series) => (
                    <option key={series.series} value={series.series}>
                      {series.seriesName}
                    </option>
                  ))}
                </select>
                <input className="po-field__input" value={header.number} readOnly />
              </div>
            </div>
            <div className="po-field">
              <label className="po-field__label">Status</label>
              <input className="po-field__input" value={header.status} readOnly />
            </div>
            <div className="po-field">
              <label className="po-field__label">Posting Date</label>
              <input
                type="date"
                className={`po-field__input${
                  valErrors.header.postingDate ? ' po-field__input--error' : ''
                }`}
                value={header.postingDate}
                onChange={(event) => handleHeaderChange('postingDate', event.target.value)}
              />
            </div>
            <div className="po-field">
              <label className="po-field__label">Due Date</label>
              <input
                type="date"
                className={`po-field__input${
                  valErrors.header.dueDate ? ' po-field__input--error' : ''
                }`}
                value={header.dueDate}
                onChange={(event) => handleHeaderChange('dueDate', event.target.value)}
              />
            </div>
            <div className="po-field">
              <label className="po-field__label">Document Date</label>
              <input
                type="date"
                className={`po-field__input${
                  valErrors.header.documentDate ? ' po-field__input--error' : ''
                }`}
                value={header.documentDate}
                onChange={(event) => handleHeaderChange('documentDate', event.target.value)}
              />
            </div>
            <div className="po-field">
              <label className="po-field__label">Referenced Document</label>
              <div className="itr-transfer-request__selector">
                <input
                  className="po-field__input"
                  value={header.referencedDocument}
                  onChange={(event) =>
                    handleHeaderChange('referencedDocument', event.target.value)
                  }
                />
                <button
                  type="button"
                  className="po-btn"
                  disabled
                  title="Reference document lookup"
                  style={{ minWidth: 36, paddingInline: 0 }}
                >
                  ...
                </button>
              </div>
            </div>
            <div className="po-field">
              <label className="po-field__label">From Branch</label>
              <select
                className="po-field__select"
                value={header.fromBranch}
                onChange={(event) => handleHeaderChange('fromBranch', event.target.value)}
              >
                <option value="">Select Branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="po-field">
              <label className="po-field__label">From Warehouse</label>
              <select
                className={`po-field__select${
                  valErrors.header.fromWarehouse ? ' po-field__input--error' : ''
                }`}
                value={header.fromWarehouse}
                onChange={(event) => handleHeaderChange('fromWarehouse', event.target.value)}
              >
                <option value="">Select From Warehouse</option>
                {fromWarehouseOptions.map((warehouse) => (
                  <option key={warehouse.whsCode} value={warehouse.whsCode}>
                    {warehouse.whsCode} - {warehouse.whsName}
                  </option>
                ))}
              </select>
            </div>
            <div className="po-field">
              <label className="po-field__label">To Warehouse</label>
              <select
                className={`po-field__select${
                  valErrors.header.toWarehouse ? ' po-field__input--error' : ''
                }`}
                value={header.toWarehouse}
                onChange={(event) => handleHeaderChange('toWarehouse', event.target.value)}
              >
                <option value="">Select To Warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.whsCode} value={warehouse.whsCode}>
                    {warehouse.whsCode} - {warehouse.whsName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="po-tabs">
        {TAB_NAMES.map((tabName) => (
          <button
            key={tabName}
            type="button"
            className={`po-tab${activeTab === tabName ? ' po-tab--active' : ''}`}
            onClick={() => setActiveTab(tabName)}
          >
            {tabName}
          </button>
        ))}
      </div>

      <div className="po-tab-panel">
        {activeTab === 'Contents' && (
          <ContentsTab
            lines={lines}
            fromWarehouses={fromWarehouseOptions}
            warehouses={warehouses}
            getBranchDisplay={getWarehouseBranchDisplay}
            activeRow={activeRow}
            onFocusRow={setActiveRow}
            onItemCodeChange={handleItemCodeChange}
            onItemCommit={handleItemCommit}
            onOpenItemModal={openItemModal}
            onFieldChange={handleLineChange}
            onAddLine={addLine}
            onRemoveLine={removeLine}
            errors={valErrors.lines}
          />
        )}

        {activeTab === 'Attachments' && (
          <AttachmentsTab
            attachments={attachments}
            selectedAttachmentId={selectedAttachmentId}
            onSelectAttachment={setSelectedAttachmentId}
            onBrowseAttachment={handleBrowseAttachment}
            onDisplayAttachment={handleDisplayAttachment}
            onDeleteAttachment={handleDeleteAttachment}
            onFreeTextChange={handleAttachmentFreeTextChange}
          />
        )}
      </div>

      {valErrors.form && <div className="po-alert po-alert--error">{valErrors.form}</div>}

      <div className="po-toolbar itr-transfer-request__action-bar">
        <div className="itr-transfer-request__action-right">
          <div className="itr-transfer-request__total-box">
            <label className="po-field__label" style={{ width: 'auto', textAlign: 'left' }}>
              Total Qty
            </label>
            <input className="po-field__input" value={totalQuantity} readOnly />
          </div>
        </div>
      </div>

      <ItemSelectionModal
        isOpen={itemModal.open}
        onClose={closeItemModal}
        onSelect={handleItemSelect}
        items={items}
        loading={pageState.loading}
      />

      <BusinessPartnerModal
        isOpen={bpModal}
        onClose={closeBpModal}
        onSelect={handleBpSelect}
        businessPartners={businessPartnerModalItems}
      />

      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple
        onChange={handleAttachmentFiles}
      />
    </form>
  );
}

export default InventoryTransferRequest;
