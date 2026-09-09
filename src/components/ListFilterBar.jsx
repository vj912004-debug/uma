import React from 'react';
import { Search } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

/** Unique, trimmed, A→Z sorted option labels. */
export const uniqueSortedOptions = (values = []) =>
  [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

/**
 * Shared list filter bar: Search + All Parties + All Products (or custom labels).
 * Matches Under Process / Production Planning layout.
 */
const ListFilterBar = ({
  searchTerm = '',
  onSearchChange,
  placeholder = 'Search party, product or receipt…',
  partyFilter = '',
  onPartyChange,
  partyOptions = [],
  partyAllLabel = 'All Parties',
  productFilter = '',
  onProductChange,
  productOptions = [],
  productAllLabel = 'All Products',
  showParty = true,
  showProduct = true,
  style
}) => (
  <div className="search-bar list-filter-bar" style={{ marginTop: 0, marginBottom: '1rem', ...style }}>
    <Search size={16} color="#94a3b8" />
    <input
      type="text"
      className="input-field"
      placeholder={placeholder}
      value={searchTerm}
      onChange={(e) => onSearchChange?.(e.target.value)}
    />
    {showParty && (
      <div className="list-filter-select">
        <SearchableSelect
          className="input-field"
          value={partyFilter}
          onChange={(e) => onPartyChange?.(e.target.value)}
        >
          <option value="">{partyAllLabel}</option>
          {partyOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </SearchableSelect>
      </div>
    )}
    {showProduct && (
      <div className="list-filter-select">
        <SearchableSelect
          className="input-field"
          value={productFilter}
          onChange={(e) => onProductChange?.(e.target.value)}
        >
          <option value="">{productAllLabel}</option>
          {productOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </SearchableSelect>
      </div>
    )}
  </div>
);

export default ListFilterBar;
