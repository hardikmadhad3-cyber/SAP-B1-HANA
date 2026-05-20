import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../purchase-order/styles/purchaseOrder.css';
import './styles/goodsReceipt.css';
import ContentsTab from './components/ContentsTab';
import AttachmentsTab from './components/AttachmentsTab';
import CopyFromModal from './components/CopyFromModal';
import ItemSelectionModal from './components/ItemSelectionModal';
import ReferenceInformationModal from './components/ReferenceInformationModal';
import BatchAllocationModal from '../../components/BatchAllocationModal';
import {
  BATCH_QTY_TOLERANCE,
  getRequiredBatchQty,
  sumBatchQty,
} from '../../utils/batchQuantity';
import {
  fetchGoodsReceiptBatchesByItem,
  fetchGoodsReceiptByDocEntry,
  fetchGoodsReceiptCopySource,
  fetchGoodsReceiptGoodsIssues,
  fetchGoodsReceiptItems,
  fetchGoodsReceiptMetadata,
  fetchGoodsReceiptSeries,
  fetchGoodsReceiptWarehouses,
  submitGoodsReceipt,
  updateGoodsReceipt,
} from '../../api/goodsReceiptApi';

const TAB_NAMES = ['Contents', 'Attachments'];
const today = () => new Date().toISOString().split('T')[0];

const createLine = () => ({
  itemCode: '',
  itemDescription: '',
  quantity: '',
  unitPrice: '',
  total: '',
  warehouse: '',
  accountCode: '',
  itemCost: '',
  uomCode: '',
  uomName: '',
  distributionRule: '',
  location: '',
  branch: '',
  batchManaged: false,
  serialManaged: false,
  batches: [],
  inventoryUOM: '',
  uomFactor: 1,
  baseEntry: null,
  baseLine: null,
  baseType: null,
  lockedByCopy: false,
});

const createHeader = () => ({
  number: 'Auto',
  series: '',
  postingDate: today(),
  documentDate: today(),
  ref2: '',
  priceList: '',
  branch: '',
  referencedDocument: null,
  remarks: '',
  journalRemark: 'Goods Receipt',
});

const getItemFlags = (item) => ({
  batchManaged:
    item?.batchManaged === true ||
    String(item?.batchManaged ?? item?.BatchManaged ?? item?.ManBtchNum ?? '').toUpperCase() ===
      'Y',
  serialManaged:
    item?.serialManaged === true ||
    String(item?.serialManaged ?? item?.SerialManaged ?? item?.ManSerNum ?? '').toUpperCase() ===
      'Y',
  inventoryUOM:
    item?.inventoryUOM || item?.InventoryUOM || item?.uomName || item?.uomCode || '',
});

function GoodsReceipt() {
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
  const [goodsIssues, setGoodsIssues] = useState([]);
  const [pageState, setPageState] = useState({
    loading: false,
    posting: false,
    error: '',
    success: '',
  });
  const [valErrors, setValErrors] = useState({
    lines: {},
    form: '',
  });
  const [copyFromModal, setCopyFromModal] = useState(false);
  const [selectedCopyDocEntry, setSelectedCopyDocEntry] = useState(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [batchModal, setBatchModal] = useState({
    open: false,
    lineIndex: null,
    availableBatches: [],
    loading: false,
    error: '',
  });
  const [referenceModalOpen, setReferenceModalOpen] = useState(false);
  const [itemModal, setItemModal] = useState({
    open: false,
    lineIndex: -1,
  });
  const currentSeriesOption =
    seriesOptions.find((seriesOption) => seriesOption.series === String(header.series)) ||
    seriesOptions[0] ||
    null;
  const defaultPriceList = priceLists[0] || null;
  const defaultBranch = branches[0] || null;
  const getBranchName = useCallback(
    (branchValue) => {
      const rawValue = String(branchValue ?? '').trim();
      if (!rawValue) return '';

      const match = branches.find(
        (branch) =>
          String(branch.id ?? '').trim() === rawValue ||
          String(branch.name ?? '').trim() === rawValue
      );
      return match?.name || rawValue;
    },
    [branches]
  );
  const headerBranchName = getBranchName(header.branch);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.po-dropdown')) {
        document
          .querySelectorAll('.po-dropdown')
          .forEach((dropdown) => dropdown.classList.remove('active'));
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const branchFilteredWarehouses = header.branch
    ? warehouses.filter(
        (warehouse) => !warehouse.branchId || warehouse.branchId === String(header.branch)
      )
    : warehouses;

  const getItem = (itemCode) => items.find((item) => item.itemCode === itemCode);

  const getItemPrice = (item, priceList) => {
    if (!item) return 0;
    if (priceList && item.prices && item.prices[String(priceList)] != null) {
      return Number(item.prices[String(priceList)] || 0);
    }
    return Number(item.lastPurchasePrice || 0);
  };

  const normalizeLine = (line) => {
    const quantity = Number(line.quantity || 0);
    const unitPrice = Number(line.unitPrice || 0);

    return {
      ...line,
      quantity: line.quantity === '' ? '' : String(line.quantity),
      unitPrice: line.unitPrice === '' ? '' : String(line.unitPrice),
      total:
        quantity > 0 || unitPrice > 0
          ? (quantity * unitPrice).toFixed(2)
          : line.total || '0.00',
      itemCost:
        line.itemCost === '' || line.itemCost == null
          ? ''
          : Number(line.itemCost).toFixed(2),
      batches: Array.isArray(line.batches) ? line.batches : [],
    };
  };

  const hydrateLineMetadata = useCallback(
    (line, sourceItems = items) => {
      const item = sourceItems.find((entry) => entry.itemCode === line.itemCode);
      if (!item) {
        return normalizeLine(line);
      }

      const itemFlags = getItemFlags(item);
      return normalizeLine({
        ...line,
        accountCode: line.accountCode || item.accountCode || '',
        itemCost:
          line.itemCost === '' || line.itemCost == null
            ? item.itemCost != null
              ? String(item.itemCost)
              : ''
            : line.itemCost,
        uomCode: line.uomCode || item.uomCode || '',
        uomName: line.uomName || item.uomName || '',
        batchManaged: itemFlags.batchManaged,
        serialManaged: itemFlags.serialManaged,
        inventoryUOM: line.inventoryUOM || itemFlags.inventoryUOM,
        uomFactor: line.uomFactor || 1,
      });
    },
    [items]
  );

  const patchLineFromItem = (line, itemCode, priceList = header.priceList) => {
    const item = getItem(itemCode);
    if (!item) {
      return normalizeLine({
        ...createLine(),
        location: headerBranchName,
        branch: header.branch || '',
      });
    }

    const itemFlags = getItemFlags(item);
    return normalizeLine({
      ...line,
      itemCode: item.itemCode,
      itemDescription: item.itemName,
      unitPrice:
        line.baseEntry != null || line.lockedByCopy
          ? line.unitPrice
          : String(getItemPrice(item, priceList)),
      warehouse: line.warehouse || item.defaultWarehouse || '',
      accountCode: line.accountCode || item.accountCode || '',
      itemCost: item.itemCost != null ? String(item.itemCost) : '',
      uomCode: item.uomCode || '',
      uomName: item.uomName || '',
      location: headerBranchName,
      branch: line.branch || header.branch || '',
      batchManaged: itemFlags.batchManaged,
      serialManaged: itemFlags.serialManaged,
      batches: [],
      inventoryUOM: itemFlags.inventoryUOM,
      uomFactor: 1,
    });
  };

  useEffect(() => {
    setLines((current) =>
      current.map((line) => {
        const nextLocation = headerBranchName || '';
        const nextBranch = line.branch || header.branch || '';
        if (line.location === nextLocation && line.branch === nextBranch) {
          return line;
        }
        return {
          ...line,
          location: nextLocation,
          branch: nextBranch,
        };
      })
    );
  }, [header.branch, headerBranchName]);

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
          goodsIssuesResponse,
        ] = await Promise.all([
          fetchGoodsReceiptMetadata(),
          fetchGoodsReceiptItems(),
          fetchGoodsReceiptWarehouses(),
          fetchGoodsReceiptSeries(),
          fetchGoodsReceiptGoodsIssues(),
        ]);

        if (ignore) return;

        const metadata = metadataResponse.data || {};
        const loadedItems = itemsResponse.data || [];
        const loadedSeries = seriesResponse.data || [];
        const defaultSeries = loadedSeries[0] || null;
        const nextDefaultPriceList = metadata.priceLists?.[0] || null;
        const nextDefaultBranch = metadata.branches?.[0] || null;

        setItems(loadedItems);
        setWarehouses(warehousesResponse.data || []);
        setSeriesOptions(loadedSeries);
        setPriceLists(metadata.priceLists || []);
        setBranches(metadata.branches || []);
        setGoodsIssues(goodsIssuesResponse.data || []);
        setHeader((current) => ({
          ...current,
          series: current.series || defaultSeries?.series || '',
          number: defaultSeries?.nextNumber || current.number,
          priceList: current.priceList || nextDefaultPriceList?.id || '',
          branch: current.branch || nextDefaultBranch?.id || '',
        }));
        setLines((current) =>
          current.map((line) =>
            line.itemCode
              ? hydrateLineMetadata(
                  {
                    ...line,
                    itemCode: line.itemCode,
                    location: getBranchName(line.branch || header.branch || nextDefaultBranch?.id || ''),
                    branch: line.branch || header.branch || nextDefaultBranch?.id || '',
                  },
                  loadedItems
                )
              : {
                  ...line,
                  location: getBranchName(line.branch || header.branch || nextDefaultBranch?.id || ''),
                  branch: line.branch || header.branch || nextDefaultBranch?.id || '',
                }
          )
        );
      } catch (error) {
        if (!ignore) {
          setPageState((current) => ({
            ...current,
            error:
              error.response?.data?.message ||
              error.message ||
              'Failed to load Goods Receipt reference data.',
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
    const docEntry = location.state?.goodsReceiptDocEntry;
    if (!docEntry) return;

    let ignore = false;

    const load = async () => {
      setPageState((current) => ({ ...current, loading: true, error: '', success: '' }));

      try {
        const response = await fetchGoodsReceiptByDocEntry(docEntry);
        const document = response.data;
        if (ignore || !document) return;

        setCurrentDocEntry(document.docEntry || Number(docEntry));
        setHeader(() => ({
          ...createHeader(),
          ...document.header,
        }));
        setLines(
          Array.isArray(document.lines) && document.lines.length
            ? document.lines.map((line) => hydrateLineMetadata({ ...createLine(), ...line }))
            : [{ ...createLine(), location: getBranchName(document.header?.branch || ''), branch: document.header?.branch || '' }]
        );
        setAttachments([]);
        setSelectedAttachmentId(null);
        setActiveTab('Contents');
        setValErrors({ lines: {}, form: '' });
        setPageState((current) => ({
          ...current,
          success: document.docNum
            ? `Goods Receipt ${document.docNum} loaded.`
            : 'Goods Receipt loaded.',
        }));
      } catch (error) {
        if (!ignore) {
          setPageState((current) => ({
            ...current,
            error:
              error.response?.data?.message ||
              error.message ||
              'Failed to load goods receipt.',
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

  const handleHeaderChange = (field, value) => {
    setHeader((current) => {
      const next = { ...current, [field]: value };
      if (field === 'series') {
        const selectedSeries = seriesOptions.find(
          (seriesOption) => seriesOption.series === String(value)
        );
        next.number = selectedSeries?.nextNumber || 'Auto';
      }
      return next;
    });

    if (field === 'priceList') {
      setLines((current) =>
        current.map((line) =>
          line.itemCode && line.baseEntry == null
            ? patchLineFromItem(line, line.itemCode, value)
            : line
        )
      );
    }

    if (field === 'branch') {
      setLines((current) =>
        current.map((line) => ({
          ...line,
          location: getBranchName(value),
          branch: line.baseEntry != null ? line.branch : value,
        }))
      );
    }
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
      current.map((line, index) =>
        index === rowIndex ? normalizeLine({ ...line, itemCode }) : line
      )
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

        return normalizeLine({
          ...line,
          [field]: value,
          batches: field === 'warehouse' && line.warehouse !== value ? [] : line.batches || [],
        });
      })
    );
  };

  const addLine = () => {
    setLines((current) => [
      ...current,
      { ...createLine(), location: headerBranchName, branch: header.branch || '' },
    ]);
  };

  const removeLine = (rowIndex) => {
    setLines((current) => {
      if (current.length === 1) {
        return [{ ...createLine(), location: headerBranchName, branch: header.branch || '' }];
      }
      return current.filter((_, index) => index !== rowIndex);
    });
  };

  const validateDocument = () => {
    const nextErrors = { lines: {}, form: '' };
    const activeLines = lines.filter((line) => line.itemCode || line.baseEntry != null);

    if (!activeLines.length) {
      nextErrors.form = 'Add at least one line before saving.';
    }

    lines.forEach((line, index) => {
      if (!line.itemCode && line.baseEntry == null) return;
      if (line.baseEntry != null) return;

      const rowErrors = {};
      if (!line.itemCode) rowErrors.itemCode = 'Item required';
      if (line.itemCode && !getItem(line.itemCode)) rowErrors.itemCode = 'Invalid item';
      if (Number(line.quantity || 0) <= 0) rowErrors.quantity = 'Qty > 0';
      if (line.itemCode && !line.warehouse) rowErrors.warehouse = 'Warehouse required';
      if (line.serialManaged) {
        rowErrors.batches = 'Serial-managed items are not yet supported.';
      }
      if (line.batchManaged) {
        if (!Array.isArray(line.batches) || line.batches.length === 0) {
          rowErrors.batches = 'Batch allocation is required.';
        } else {
          const requiredBatchQty = getRequiredBatchQty(line);
          const assignedBatchQty = sumBatchQty(line.batches);
          const inventoryUOM = line.inventoryUOM || line.uomName || line.uomCode || 'Base UoM';
          if (Math.abs(assignedBatchQty - requiredBatchQty) > BATCH_QTY_TOLERANCE) {
            rowErrors.quantity = `Batch quantity (${assignedBatchQty.toFixed(
              2
            )} ${inventoryUOM}) must match line quantity (${requiredBatchQty.toFixed(
              2
            )} ${inventoryUOM})`;
          }
        }
      }

      if (Object.keys(rowErrors).length) {
        nextErrors.lines[index] = rowErrors;
      }
    });

    setValErrors(nextErrors);
    return !nextErrors.form && Object.keys(nextErrors.lines).length === 0;
  };

  const resetForm = (options = {}) => {
    const { successMessage = '' } = options;
    const nextSeries = currentSeriesOption?.series || '';
    const nextBranch = header.branch || defaultBranch?.id || '';

    setCurrentDocEntry(null);
    setHeader(() => ({
      ...createHeader(),
      series: nextSeries,
      number: currentSeriesOption?.nextNumber || 'Auto',
      priceList: header.priceList || defaultPriceList?.id || '',
      branch: nextBranch,
    }));
    setLines([{ ...createLine(), location: getBranchName(nextBranch), branch: nextBranch }]);
    attachmentsRef.current.forEach((attachment) => {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    });
    setAttachments([]);
    setSelectedAttachmentId(null);
    setActiveTab('Contents');
    setValErrors({ lines: {}, form: '' });
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

  const openBatchModal = async (lineIndex) => {
    const line = lines[lineIndex];
    if (!line?.itemCode) {
      setPageState((current) => ({
        ...current,
        error: 'Select an item before allocating batches.',
      }));
      return;
    }
    if (line?.serialManaged) {
      setPageState((current) => ({
        ...current,
        error: 'Serial-managed items are not yet supported on Goods Receipt.',
      }));
      return;
    }
    if (!line?.warehouse) {
      setPageState((current) => ({
        ...current,
        error: 'Select a warehouse before allocating batches.',
      }));
      return;
    }

    setBatchModal({
      open: true,
      lineIndex,
      availableBatches: [],
      loading: true,
      error: '',
    });

    try {
      const response = await fetchGoodsReceiptBatchesByItem(line.itemCode, line.warehouse);
      setBatchModal((current) =>
        current.open && current.lineIndex === lineIndex
          ? {
              open: true,
              lineIndex,
              availableBatches: response.data?.batches || [],
              loading: false,
              error: '',
            }
          : current
      );
    } catch (error) {
      setBatchModal((current) =>
        current.open && current.lineIndex === lineIndex
          ? {
              open: true,
              lineIndex,
              availableBatches: [],
              loading: false,
              error:
                error.response?.data?.message ||
                error.message ||
                'Failed to load warehouse batches.',
            }
          : current
      );
    }
  };

  const closeBatchModal = () => {
    setBatchModal({
      open: false,
      lineIndex: null,
      availableBatches: [],
      loading: false,
      error: '',
    });
  };

  const saveLineBatches = (nextBatches) => {
    if (batchModal.lineIndex == null) return;

    setLines((current) =>
      current.map((line, index) =>
        index === batchModal.lineIndex ? normalizeLine({ ...line, batches: nextBatches }) : line
      )
    );
    setValErrors((current) => ({
      ...current,
      lines: {
        ...current.lines,
        [batchModal.lineIndex]: {
          ...(current.lines[batchModal.lineIndex] || {}),
          batches: '',
          quantity: '',
        },
      },
      form: '',
    }));
    closeBatchModal();
  };

  const openCopyFromModal = () => {
    setSelectedCopyDocEntry(null);
    setCopyFromModal(true);
  };

  const handleCopyFrom = async () => {
    if (!selectedCopyDocEntry) return;

    setCopyLoading(true);
    setPageState((current) => ({ ...current, error: '', success: '' }));

    try {
      const response = await fetchGoodsReceiptCopySource('goods-issue', selectedCopyDocEntry);
      const payload = response.data || {};

      setHeader((current) => ({
        ...current,
        ...payload.header,
        number: current.number,
        series: current.series,
      }));
      setCurrentDocEntry(null);
      setLines(
        Array.isArray(payload.lines) && payload.lines.length
          ? payload.lines.map((line) => hydrateLineMetadata({ ...createLine(), ...line }))
          : [{ ...createLine(), location: getBranchName(payload.header?.branch || header.branch || ''), branch: payload.header?.branch || header.branch || '' }]
      );
      setValErrors({ lines: {}, form: '' });
      setCopyFromModal(false);
      setPageState((current) => ({
        ...current,
        success: 'Copied from Goods Issue. Please review and save.',
      }));
    } catch (error) {
      setPageState((current) => ({
        ...current,
        error: error.response?.data?.message || error.message || 'Copy From failed.',
      }));
    } finally {
      setCopyLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateDocument()) {
      setPageState((current) => ({
        ...current,
        error: 'Fix the highlighted line errors before saving.',
        success: '',
      }));
      return;
    }

    setPageState((current) => ({ ...current, posting: true, error: '', success: '' }));

    try {
      const payload = {
        header,
        lines: lines
          .filter((line) => line.itemCode || line.baseEntry != null)
          .map((line) => ({
            itemCode: line.itemCode,
            itemDescription: line.itemDescription,
            quantity: Number(line.quantity || 0),
            unitPrice: Number(line.unitPrice || 0),
            total: Number(line.total || 0),
            warehouse: line.warehouse,
            accountCode: line.accountCode,
            itemCost: Number(line.itemCost || 0),
            uomCode: line.uomCode,
            uomName: line.uomName,
            distributionRule: line.distributionRule,
            location: line.location,
            branch: line.branch,
            batchManaged: line.batchManaged,
            serialManaged: line.serialManaged,
            batches: line.batches || [],
            baseEntry: line.baseEntry,
            baseLine: line.baseLine,
            baseType: line.baseType,
          })),
        attachments: attachments.map((attachment) => ({
          targetPath: attachment.targetPath,
          fileName: attachment.fileName,
          attachmentDate: attachment.attachmentDate,
          freeText: attachment.freeText,
        })),
      };

      const response = currentDocEntry
        ? await updateGoodsReceipt(currentDocEntry, payload)
        : await submitGoodsReceipt(payload);
      const result = response.data || {};
      const successMessage = `${result.message || 'Goods Receipt saved successfully.'} DocEntry: ${
        result.docEntry
      }, DocNum: ${result.docNum}`;

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
      }));
      setValErrors({ lines: {}, form: '' });
    } catch (error) {
      setPageState((current) => ({
        ...current,
        posting: false,
        error:
          error.response?.data?.message ||
          error.message ||
          'Failed to save Goods Receipt.',
      }));
    }
  };

  const documentTotal = lines
    .filter((line) => line.itemCode || line.baseEntry != null)
    .reduce((sum, line) => sum + Number(line.total || 0), 0)
    .toFixed(2);

  const batchModalLine =
    batchModal.lineIndex != null
      ? {
          ...lines[batchModal.lineIndex],
          itemNo: lines[batchModal.lineIndex]?.itemCode,
          whse: lines[batchModal.lineIndex]?.warehouse,
        }
      : null;

  return (
    <form className="po-page gr-goods-receipt__page" onSubmit={handleSubmit}>
      <div className="po-toolbar">
        <div className="po-toolbar__title">
          Goods Receipt{currentDocEntry ? ` - #${header.number || currentDocEntry}` : ''}
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
        <button type="button" className="po-btn" onClick={() => navigate('/goods-receipt/find')}>
          Find
        </button>
        <button type="button" className="po-btn" onClick={resetForm}>
          New
        </button>
        <div className="po-dropdown">
          <button
            type="button"
            className="po-btn"
            disabled={pageState.posting || !!currentDocEntry}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const dropdown = event.currentTarget.parentElement;
              const isActive = dropdown.classList.contains('active');
              document
                .querySelectorAll('.po-dropdown')
                .forEach((node) => node.classList.remove('active'));
              if (!isActive) dropdown.classList.add('active');
            }}
          >
            Copy From v
          </button>
          <div className="po-dropdown-menu">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openCopyFromModal();
                document
                  .querySelectorAll('.po-dropdown')
                  .forEach((node) => node.classList.remove('active'));
              }}
            >
              Goods Issue
            </button>
          </div>
        </div>
        {pageState.loading && (
          <span className="po-alert po-alert--warning" style={{ margin: 0 }}>
            Loading...
          </span>
        )}
      </div>

      {pageState.error && <div className="po-alert po-alert--error">{pageState.error}</div>}
      {pageState.success && <div className="po-alert po-alert--success">{pageState.success}</div>}

      <div className="po-header-card">
        <div className="gr-goods-receipt__header-grid">
          <div className="po-field-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="po-field">
              <label className="po-field__label">Number</label>
              <input className="po-field__input" value={header.number} readOnly />
            </div>
            <div className="po-field">
              <label className="po-field__label">Series</label>
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
            </div>
            <div className="po-field">
              <label className="po-field__label">Price List</label>
              <select
                className="po-field__select"
                value={header.priceList}
                onChange={(event) => handleHeaderChange('priceList', event.target.value)}
                disabled={!!header.referencedDocument}
              >
                <option value="">Select Price List</option>
                {priceLists.map((priceList) => (
                  <option key={priceList.id} value={priceList.id}>
                    {priceList.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="po-field">
              <label className="po-field__label">Branch</label>
              <select
                className="po-field__select"
                value={header.branch}
                onChange={(event) => handleHeaderChange('branch', event.target.value)}
                disabled={!!header.referencedDocument}
              >
                <option value="">Select Branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="po-field-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="po-field">
              <label className="po-field__label">Posting Date</label>
              <input
                type="date"
                className="po-field__input"
                value={header.postingDate}
                onChange={(event) => handleHeaderChange('postingDate', event.target.value)}
              />
            </div>
            <div className="po-field">
              <label className="po-field__label">Document Date</label>
              <input
                type="date"
                className="po-field__input"
                value={header.documentDate}
                onChange={(event) => handleHeaderChange('documentDate', event.target.value)}
              />
            </div>
            <div className="po-field">
              <label className="po-field__label">Ref. 2</label>
              <input
                className="po-field__input"
                value={header.ref2}
                onChange={(event) => handleHeaderChange('ref2', event.target.value)}
              />
            </div>
            <div className="po-field">
              <label className="po-field__label">Referenced Document</label>
              <div className="gr-goods-receipt__selector">
                <input
                  className="po-field__input"
                  readOnly
                  value={
                    header.referencedDocument
                      ? `${header.referencedDocument.sourceLabel} ${header.referencedDocument.docNum}`
                      : ''
                  }
                />
                <button
                  type="button"
                  className="po-btn"
                  onClick={() => setReferenceModalOpen(true)}
                >
                  ...
                </button>
              </div>
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
            warehouses={branchFilteredWarehouses}
            headerBranchName={headerBranchName}
            activeRow={activeRow}
            onFocusRow={setActiveRow}
            onItemCodeChange={handleItemCodeChange}
            onItemCommit={handleItemCommit}
            onOpenItemModal={openItemModal}
            onFieldChange={handleLineChange}
            onOpenBatchModal={openBatchModal}
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

      <div className="po-header-card gr-goods-receipt__footer-card" style={{ marginTop: 0 }}>
        <div>
          <div>
            <div className="po-field" style={{ alignItems: 'flex-start' }}>
              <label className="po-field__label" style={{ paddingTop: 4 }}>
                Remarks
              </label>
              <textarea
                className="po-textarea"
                rows={3}
                value={header.remarks}
                onChange={(event) => handleHeaderChange('remarks', event.target.value)}
              />
            </div>
            <div className="po-field">
              <label className="po-field__label">Journal Remark</label>
              <input
                className="po-field__input"
                value={header.journalRemark}
                onChange={(event) => handleHeaderChange('journalRemark', event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="po-toolbar gr-goods-receipt__action-bar">
        <div className="gr-goods-receipt__action-right">
          <div className="gr-goods-receipt__total-box">
            <label className="po-field__label" style={{ width: 'auto', textAlign: 'left' }}>
              Total
            </label>
            <input className="po-field__input" value={documentTotal} readOnly />
          </div>
        </div>
      </div>

      <CopyFromModal
        isOpen={copyFromModal}
        goodsIssues={goodsIssues}
        selectedDocEntry={selectedCopyDocEntry}
        onSelectDocEntry={setSelectedCopyDocEntry}
        onClose={() => setCopyFromModal(false)}
        onCopy={handleCopyFrom}
        loading={copyLoading}
      />

      <ReferenceInformationModal
        isOpen={referenceModalOpen}
        onClose={() => setReferenceModalOpen(false)}
        referencedDocument={header.referencedDocument}
        documentDate={header.documentDate}
        remarks={header.remarks}
        documentTotal={documentTotal}
      />

      <ItemSelectionModal
        isOpen={itemModal.open}
        onClose={closeItemModal}
        onSelect={handleItemSelect}
        items={items}
        loading={pageState.loading}
      />

      <BatchAllocationModal
        isOpen={batchModal.open}
        mode="receipt"
        line={batchModalLine}
        availableBatches={batchModal.availableBatches}
        loading={batchModal.loading}
        error={batchModal.error}
        onClose={closeBatchModal}
        onSave={saveLineBatches}
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

export default GoodsReceipt;
