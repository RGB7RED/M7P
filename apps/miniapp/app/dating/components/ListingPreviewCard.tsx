import { ListingPreview } from '../types';

const SECTION_LABELS: Record<ListingPreview['section'], string> = {
  market: 'Маркет',
  housing: 'Жильё',
  jobs: 'Работа',
};

export function ListingPreviewCard({ listing, onClick }: { listing: ListingPreview; onClick?: () => void }) {
  return (
    <div
      className="profile-card profile-card-compact listing-preview-card"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="card-header">
        <div>
          <div className="profile-title">{listing.title}</div>
          {listing.city ? <div className="profile-subtitle">{listing.city}</div> : null}
        </div>
        <span className="pill pill-active">{SECTION_LABELS[listing.section]}</span>
      </div>

      {listing.priceLabel ? <div className="label">{listing.priceLabel}</div> : null}
    </div>
  );
}
