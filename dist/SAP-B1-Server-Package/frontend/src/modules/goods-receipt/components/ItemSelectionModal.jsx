import React, { useEffect, useState } from 'react';

const getItemCode = (item) => item.itemCode || item.ItemCode || '';
const getItemName = (item) => item.itemName || item.ItemName || '';
const getItemGroup = (item) => item.itemGroup || item.ItemGroup || '';
const getForeignName = (item) => item.foreignName || item.ForeignName || '';
const getInStock = (item) => item.inStock || item.InStock || 0;

function ItemSelectionModal({ isOpen, onClose, onSelect, items, loading }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredItems(
        items.filter((item) => {
          const code = getItemCode(item).toLowerCase();
          const name = getItemName(item).toLowerCase();
          const foreignName = getForeignName(item).toLowerCase();
          const group = getItemGroup(item).toLowerCase();
          return (
            code.includes(query) ||
            name.includes(query) ||
            foreignName.includes(query) ||
            group.includes(query)
          );
        })
      );
    } else {
      setFilteredItems(items);
    }

    setSelectedIndex(-1);
  }, [items, searchQuery]);

  const handleClose = () => {
    setSearchQuery('');
    setSelectedIndex(-1);
    onClose();
  };

  const handleChoose = () => {
    if (selectedIndex < 0 || !filteredItems[selectedIndex]) return;
    onSelect(filteredItems[selectedIndex]);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="po-modal-overlay"
      onClick={handleClose}
    >
      <div
        className="po-modal"
        style={{ width: 900, maxWidth: '92vw' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="po-modal__header">
          <span>List of Items</span>
          <button type="button" className="po-modal__close" onClick={handleClose}>
            x
          </button>
        </div>

        <div className="po-modal__body" style={{ paddingTop: 12 }}>
          <div className="po-field" style={{ marginBottom: 12 }}>
            <label className="po-field__label">Find</label>
            <input
              type="text"
              className="po-field__input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by item code or description"
              autoFocus
            />
          </div>

          <div className="po-grid-wrap" style={{ maxHeight: '50vh' }}>
            <table className="po-grid">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th style={{ width: 140 }}>Item No.</th>
                  <th>Item Description</th>
                  <th style={{ width: 120, textAlign: 'right' }}>In Stock</th>
                  <th style={{ width: 140 }}>UoM</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="5" style={{ padding: 20, textAlign: 'center' }}>
                      Loading items...
                    </td>
                  </tr>
                )}

                {!loading && filteredItems.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ padding: 20, textAlign: 'center' }}>
                      No items found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredItems.map((item, index) => (
                    <tr
                      key={`${getItemCode(item)}-${index}`}
                      onClick={() => setSelectedIndex(index)}
                      onDoubleClick={() => {
                        onSelect(item);
                        handleClose();
                      }}
                      style={{
                        cursor: 'pointer',
                        background: selectedIndex === index ? '#fff8c5' : undefined,
                      }}
                    >
                      <td>{index + 1}</td>
                      <td>{getItemCode(item)}</td>
                      <td>{getItemName(item)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {Number(getInStock(item) || 0).toFixed(2)}
                      </td>
                      <td>{item.uomCode || item.UoMCode || ''}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="po-modal__footer">
          <button
            type="button"
            className="po-btn po-btn--primary"
            onClick={handleChoose}
            disabled={selectedIndex < 0}
          >
            Choose
          </button>
          <button type="button" className="po-btn" onClick={handleClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ItemSelectionModal;
