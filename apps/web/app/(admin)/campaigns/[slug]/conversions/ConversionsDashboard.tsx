'use client';

import { Badge, Button, Stack, Text } from '@primitive/react';
import { useCallback, useEffect, useState } from 'react';

type Tab = 'summary' | 'funnel' | 'timeseries' | 'conversions' | 'audience' | 'lookup-log' | 'deliveries';

interface Summary {
  totalSessions: number;
  totalConversions: number;
  conversionRate: number;
  byTrigger: Record<string, number>;
}

interface Conversion {
  id: string;
  triggerType: string;
  triggerPageId: string | null;
  triggerElementId: string | null;
  convertedAt: string;
  ipAddress: string;
  payload: Record<string, unknown>;
}

interface AudienceRecord {
  id: string;
  name: string | null;
  email: string | null;
  fields: Record<string, unknown>;
  createdAt: string;
}

interface LookupEntry {
  id: string;
  outcome: 'matched' | 'no_match';
  ipAddress: string;
  attemptedAt: string;
}

interface Delivery {
  id: string;
  status: string;
  attemptNumber: number;
  responseStatus: number | null;
  deliveredAt: string | null;
  conversion: { id: string; triggerType: string; convertedAt: string };
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'funnel', label: 'Funnel' },
  { id: 'timeseries', label: 'Over time' },
  { id: 'conversions', label: 'Conversions' },
  { id: 'audience', label: 'Audience' },
  { id: 'lookup-log', label: 'Lookup log' },
  { id: 'deliveries', label: 'Deliveries' },
];

export function ConversionsDashboard({
  campaignSlug,
}: {
  campaignSlug: string;
}) {
  const [tab, setTab] = useState<Tab>('summary');
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchTab = useCallback(
    async (t: Tab, p: number) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/campaigns/${campaignSlug}/conversions?view=${t}&page=${p}`,
        );
        const json = await res.json();
        setData(json);
      } finally {
        setLoading(false);
      }
    },
    [campaignSlug],
  );

  useEffect(() => {
    setPage(1);
    setData(null);
  }, [tab]);

  useEffect(() => {
    fetchTab(tab, page);
  }, [tab, page, fetchTab]);

  function exportCsv() {
    window.open(
      `/api/campaigns/${campaignSlug}/conversions?view=export`,
      '_blank',
    );
  }

  return (
    <Stack
      direction="vertical"
      size="lg"
    >
      <Stack
        direction="horizontal"
        align="center"
      >
        <Text
          as="h1"
          size="lg"
          weight="semibold"
          style={{ flex: 1 }}
        >
          Conversions
        </Text>
        <Button
          size="sm"
          appearance="outline"
          tone="neutral"
          onClick={exportCsv}
        >
          Export CSV
        </Button>
      </Stack>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid var(--border)',
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom:
                tab === t.id
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
              color: tab === t.id ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: tab === t.id ? 600 : 400,
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Text
          tone="secondary"
          size="sm"
        >
          Loading…
        </Text>
      ) : (
        <>
          {tab === 'summary' && <SummaryView data={data as Summary} />}
          {tab === 'funnel' && <FunnelView data={data as FunnelData} />}
          {tab === 'timeseries' && <TimeSeriesView data={data as TimeSeriesData} />}
          {tab === 'conversions' && (
            <PaginatedView
              data={
                data as {
                  conversions: Conversion[];
                  total: number;
                  page: number;
                  limit: number;
                }
              }
              page={page}
              setPage={setPage}
              renderRow={(c: Conversion) => (
                <tr key={c.id}>
                  <Td>{c.triggerType}</Td>
                  <Td>{new Date(c.convertedAt).toLocaleString()}</Td>
                  <Td
                    style={{
                      maxWidth: 300,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {JSON.stringify(c.payload)}
                  </Td>
                  <Td>{c.ipAddress}</Td>
                </tr>
              )}
              columns={['Trigger', 'Converted at', 'Payload', 'IP']}
              rows={(data as { conversions: Conversion[] }).conversions}
            />
          )}
          {tab === 'audience' && (
            <PaginatedView
              data={
                data as {
                  records: AudienceRecord[];
                  total: number;
                  page: number;
                  limit: number;
                }
              }
              page={page}
              setPage={setPage}
              renderRow={(r: AudienceRecord) => (
                <tr key={r.id}>
                  <Td>{r.name ?? '—'}</Td>
                  <Td>{r.email ?? '—'}</Td>
                  <Td>{new Date(r.createdAt).toLocaleString()}</Td>
                </tr>
              )}
              columns={['Name', 'Email', 'Imported at']}
              rows={(data as { records: AudienceRecord[] }).records}
            />
          )}
          {tab === 'lookup-log' && (
            <PaginatedView
              data={
                data as {
                  entries: LookupEntry[];
                  total: number;
                  page: number;
                  limit: number;
                }
              }
              page={page}
              setPage={setPage}
              renderRow={(e: LookupEntry) => (
                <tr key={e.id}>
                  <Td>
                    <Badge
                      tone={e.outcome === 'matched' ? 'success' : 'danger'}
                      appearance="soft"
                      size="sm"
                    >
                      {e.outcome}
                    </Badge>
                  </Td>
                  <Td>{e.ipAddress}</Td>
                  <Td>{new Date(e.attemptedAt).toLocaleString()}</Td>
                </tr>
              )}
              columns={['Outcome', 'IP', 'Attempted at']}
              rows={(data as { entries: LookupEntry[] }).entries}
            />
          )}
          {tab === 'deliveries' && (
            <PaginatedView
              data={
                data as { deliveries: Delivery[]; page: number; limit: number }
              }
              page={page}
              setPage={setPage}
              renderRow={(d: Delivery) => (
                <tr key={d.id}>
                  <Td>
                    <Badge
                      tone={
                        d.status === 'delivered'
                          ? 'success'
                          : d.status === 'failed'
                            ? 'danger'
                            : 'neutral'
                      }
                      appearance="soft"
                      size="sm"
                    >
                      {d.status}
                    </Badge>
                  </Td>
                  <Td>{d.conversion.triggerType}</Td>
                  <Td>{d.responseStatus ?? '—'}</Td>
                  <Td>{d.attemptNumber}</Td>
                  <Td>
                    {d.deliveredAt
                      ? new Date(d.deliveredAt).toLocaleString()
                      : '—'}
                  </Td>
                </tr>
              )}
              columns={[
                'Status',
                'Trigger',
                'HTTP',
                'Attempts',
                'Delivered at',
              ]}
              rows={(data as { deliveries: Delivery[] }).deliveries}
            />
          )}
        </>
      )}
    </Stack>
  );
}

function SummaryView({ data }: { data: Summary | null }) {
  if (!data) return null;

  return (
    <Stack
      direction="vertical"
      size="md"
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 16,
        }}
      >
        <StatCard
          label="Total sessions"
          value={data?.totalSessions}
        />
        <StatCard
          label="Conversions"
          value={data?.totalConversions}
        />
        <StatCard
          label="Conversion rate"
          value={`${(data?.conversionRate * 100).toFixed(1)}%`}
        />
      </div>

      {data?.byTrigger && Object?.keys(data.byTrigger).length > 0 && (
        <div style={tableWrap}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>Trigger type</Th>
                <Th>Count</Th>
              </tr>
            </thead>
            <tbody>
              {Object?.entries(data?.byTrigger).map(([type, count]) => (
                <tr key={type}>
                  <Td>{type}</Td>
                  <Td>{count}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Stack>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '16px 20px',
      }}
    >
      <Text
        size="sm"
        tone="secondary"
      >
        {label}
      </Text>
      <Text
        as="p"
        size="lg"
        weight="semibold"
        style={{ marginTop: 4 }}
      >
        {value}
      </Text>
    </div>
  );
}

function PaginatedView<T>({
  data,
  page,
  setPage,
  renderRow,
  columns,
  rows,
}: {
  data: { total?: number; page: number; limit: number } | null;
  page: number;
  setPage: (p: number) => void;
  renderRow: (row: T) => React.ReactNode;
  columns: string[];
  rows: T[];
}) {
  const total = (data as { total?: number })?.total;
  const limit = data?.limit ?? 50;
  const totalPages = total ? Math.ceil(total / limit) : 1;

  return (
    <Stack
      direction="vertical"
      size="md"
    >
      <div style={tableWrap}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {columns.map((c) => (
                <Th key={c}>{c}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows?.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                  }}
                >
                  No records
                </td>
              </tr>
            ) : (
              rows?.map(renderRow)
            )}
          </tbody>
        </table>
      </div>
      {total !== undefined && totalPages > 1 && (
        <Stack
          direction="horizontal"
          size="sm"
          align="center"
        >
          <Button
            size="sm"
            appearance="outline"
            tone="neutral"
            onClick={() => setPage(page - 1)}
            style={{ opacity: page <= 1 ? 0.4 : 1 }}
          >
            Prev
          </Button>
          <Text
            size="sm"
            tone="secondary"
          >
            {page} / {totalPages}
          </Text>
          <Button
            size="sm"
            appearance="outline"
            tone="neutral"
            onClick={() => setPage(page + 1)}
            style={{ opacity: page >= totalPages ? 0.4 : 1 }}
          >
            Next
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: '8px 14px',
        textAlign: 'left',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: '10px 14px',
        fontSize: 13,
        color: 'var(--text-primary)',
        borderBottom: '1px solid var(--border-subtle)',
        ...style,
      }}
    >
      {children}
    </td>
  );
}

const tableWrap: React.CSSProperties = {
  overflowX: 'auto',
  border: '1px solid var(--border)',
  borderRadius: 8,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

// ── Funnel ──────────────────────────────────────────────────────────────────────

interface FunnelStep {
  nodeId: string;
  label: string;
  path: string | null;
  sessions: number;
  pct: number;
}

interface FunnelData {
  totalSessions: number;
  converted: number;
  conversionRate: number;
  steps: FunnelStep[];
}

function FunnelView({ data }: { data: FunnelData | null }) {
  if (!data) return null;
  const max = Math.max(...(data.steps ?? []).map((s) => s.sessions), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 12, marginBottom: 8 }}>
        <StatCard label="Total sessions" value={data.totalSessions} />
        <StatCard label="Converted" value={data.converted} />
        <StatCard label="Conversion rate" value={`${data.conversionRate}%`} />
      </div>
      {(data.steps ?? []).length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
          No flow nodes configured yet. Build your flow in the Branching tab.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(data.steps ?? []).map((step) => (
            <div key={step.nodeId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: '0 0 180px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {step.label}
                {step.path && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{step.path}</span>}
              </div>
              <div style={{ flex: 1, background: 'var(--bg-raised)', borderRadius: 4, height: 20, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  width: `${Math.round((step.sessions / max) * 100)}%`,
                  background: 'var(--accent)', transition: 'width 0.4s',
                  minWidth: step.sessions > 0 ? 4 : 0,
                }} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', flex: '0 0 80px', textAlign: 'right' }}>
                {step.sessions.toLocaleString()} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({step.pct}%)</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Time Series ─────────────────────────────────────────────────────────────────

interface TimeSeriesData {
  days: { date: string; count: number }[];
}

function TimeSeriesView({ data }: { data: TimeSeriesData | null }) {
  if (!data) return null;
  const days = data.days ?? [];
  const max = Math.max(...days.map((d) => d.count), 1);

  if (days.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
        No conversions in the last 30 days.
      </p>
    );
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 20px 12px' }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
        Conversions — last 30 days
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
        {days.map((d) => (
          <div key={d.date} title={`${d.date}: ${d.count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{
              width: '100%', borderRadius: '2px 2px 0 0',
              background: d.count > 0 ? 'var(--accent)' : 'var(--bg-raised)',
              height: d.count > 0 ? `${Math.max(4, Math.round((d.count / max) * 72))}px` : '4px',
              transition: 'height 0.3s',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{days[0]?.date}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{days[days.length - 1]?.date}</span>
      </div>
    </div>
  );
}
