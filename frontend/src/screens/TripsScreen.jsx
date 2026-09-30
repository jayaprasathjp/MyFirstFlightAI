import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';

export default function TripsScreen({ onSelect, onNew, busy, error }) {
  const { t } = useI18n();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.getTrips()
      .then(res => setTrips(res.trips || []))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="screen" style={{ alignContent: 'start' }}>
      <h2>{t('my_trips_title')}</h2>
      
      {(err || error) && <div className="err" role="alert">{err || error}</div>}
      
      {loading ? (
        <div className="reading" role="status"><span className="spin" aria-hidden="true"></span> {t('loading_trips')}</div>
      ) : trips.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '30px 14px' }}>
          <p style={{ color: 'var(--muted)', marginBottom: '16px' }}>{t('no_trips_yet')}</p>
          <button className="btn pri" onClick={onNew} disabled={busy}>{t('start_new_trip')}</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {trips.map(trip => {
            const hasTravellers = trip.travellers && trip.travellers.length > 0;
            const origCity = trip.summary?.origin_city || trip.summary?.origin_country;
            const destCity = trip.summary?.destination_city || trip.summary?.destination_country;
            const title = (origCity && destCity) ? `${origCity} → ${destCity}` : (destCity || origCity || t('destination_tbd'));
            return (
              <div key={trip.id} className="card" style={{ display: 'grid', gap: '12px', cursor: 'pointer' }} onClick={() => onSelect(trip)}>
                <div>
                  <h3 style={{ fontSize: '16px', color: 'var(--ink)' }}>{title}</h3>
                  <small style={{ color: 'var(--muted)' }}>
                    {hasTravellers ? `${trip.travellers.length} ${t('travellers_count')}` : t('no_travellers_added')} 
                    {trip.status !== 'empty' && ` • ${t('status_label')} ${trip.status}`}
                  </small>
                </div>
              </div>
            );
          })}
          
          <button className="btn pri full" onClick={onNew} disabled={busy} style={{ marginTop: '16px' }}>{t('start_new_trip')}</button>
        </div>
      )}
    </div>
  );
}
