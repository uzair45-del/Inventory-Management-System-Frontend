import { useState } from 'react';
import { X, Plus, Trash2, Package, CheckCircle } from 'lucide-react';
import './ProductSideList.css';

const ProductSideList = ({ 
  isOpen, 
  onClose, 
  pendingItems, 
  onRemoveItem, 
  onClearAll, 
  onProcessItems,
  isProcessing 
}) => {
  const addCount = pendingItems.filter(item => item.action === 'add').length;
  const deleteCount = pendingItems.filter(item => item.action === 'delete').length;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return `Rs. ${parseFloat(amount).toLocaleString()}`;
  };

  return (
    <>
      {/* Side List */}
      <div className={`product-side-list ${isOpen ? 'open' : ''}`}>
        <div className="side-list-header">
          <h3>Pending Changes</h3>
          <button className="close-side-list" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="side-list-content">
          {pendingItems.length === 0 ? (
            <div className="empty-side-list">
              <Package size={48} />
              <h4>No pending changes</h4>
              <p>Add or delete products to see them here</p>
            </div>
          ) : (
            pendingItems.map((item, index) => (
              <div key={index} className={`side-list-item ${item.action}`}>
                <div className="item-header">
                  <span className="item-name">{item.name}</span>
                  <span className={`item-action ${item.action}`}>
                    {item.action === 'add' ? 'ADD' : 'DELETE'}
                  </span>
                </div>
                
                <div className="item-details">
                  {item.action === 'add' && item.data && (
                    <>
                      <div><strong>Category:</strong> {item.data.category || 'Uncategorized'}</div>
                      <div><strong>Price:</strong> {formatCurrency(item.data.price)}</div>
                      <div><strong>Quantity:</strong> {item.data.total_quantity} {item.data.quantity_unit || 'pieces'}</div>
                      {item.data.purchase_rate && (
                        <div><strong>Purchase Rate:</strong> {formatCurrency(item.data.purchase_rate)}</div>
                      )}
                      {item.data.purchased_from && (
                        <div><strong>Supplier:</strong> {item.data.purchased_from}</div>
                      )}
                      {item.data.purchase_date && (
                        <div><strong>Purchase Date:</strong> {formatDate(item.data.purchase_date)}</div>
                      )}
                    </>
                  )}
                  
                  {item.action === 'delete' && item.data && (
                    <>
                      <div><strong>ID:</strong> {item.data.id}</div>
                      <div><strong>Category:</strong> {item.data.category || 'Uncategorized'}</div>
                      <div><strong>Current Stock:</strong> {item.data.remaining_quantity || 0} pieces</div>
                      <div><strong>Price:</strong> {formatCurrency(item.data.price)}</div>
                    </>
                  )}
                </div>

                <button 
                  className="remove-item"
                  onClick={() => onRemoveItem(index)}
                  title="Remove from pending list"
                >
                  <X size={16} /> Remove
                </button>
              </div>
            ))
          )}
        </div>

        {pendingItems.length > 0 && (
          <div className="side-list-footer">
            <div className="side-list-summary">
              <span className="summary-count">
                {addCount > 0 && `${addCount} to add`} 
                {addCount > 0 && deleteCount > 0 && ', '}
                {deleteCount > 0 && `${deleteCount} to delete`}
              </span>
              <div className="summary-actions">
                <button className="btn-clear" onClick={onClearAll}>
                  Clear All
                </button>
                <button 
                  className="btn-process"
                  onClick={onProcessItems}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : 'Process All'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <button 
        className={`side-list-toggle ${pendingItems.length > 0 ? 'has-items' : ''}`}
        onClick={() => isOpen ? onClose() : onClose()} // This will be handled by parent
        title={`Pending changes (${pendingItems.length})`}
      >
        <Package size={24} />
        {pendingItems.length > 0 && (
          <span className="toggle-badge">{pendingItems.length}</span>
        )}
      </button>
    </>
  );
};

export default ProductSideList;
