import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const eventsCollected = new Counter('events_collected');
const collectLatency = new Trend('collect_latency');

export const options = {
  scenarios: {
    collector_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 500 },
        { duration: '10m', target: 1000 },
        { duration: '5m', target: 1000 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration{name:collect}': ['p(95)<50', 'p(99)<100'],
    'http_req_failed{name:collect}': ['rate<0.01'],
    errors: ['rate<0.01'],
  },
};

const COLLECTOR_URL = __ENV.COLLECTOR_URL || 'http://localhost:8081';
const PUBLIC_KEY = __ENV.PUBLIC_KEY || 'pk_test_demo';

function generateEvent() {
  const eventTypes = ['page_view', 'click', 'form_submit', 'add_to_cart', 'purchase', 'sign_up', 'login'];
  const paths = ['/', '/products', '/cart', '/checkout', '/about', '/contact', '/pricing'];
  const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
  const oses = ['Windows', 'macOS', 'Linux', 'iOS', 'Android'];
  const countries = ['US', 'UK', 'DE', 'FR', 'JP', 'BR', 'IN', 'AU'];

  return {
    event: eventTypes[Math.floor(Math.random() * eventTypes.length)],
    type: 'custom',
    ts: Date.now(),
    anon_id: `anon_${Math.random().toString(36).slice(2, 14)}`,
    session_id: `sess_${Math.random().toString(36).slice(2, 14)}`,
    is_new_session: Math.random() > 0.8,
    url: `https://example.com${paths[Math.floor(Math.random() * paths.length)]}`,
    path: paths[Math.floor(Math.random() * paths.length)],
    referrer: Math.random() > 0.5 ? 'https://google.com' : '',
    title: 'Test Page',
    locale: 'en-US',
    screen_width: 1920,
    screen_height: 1080,
    utm: Math.random() > 0.7 ? { source: 'google', medium: 'cpc', campaign: 'test' } : undefined,
    props: {
      button_id: `btn_${Math.floor(Math.random() * 100)}`,
      value: Math.random() * 100,
    },
  };
}

export default function () {
  const batchSize = Math.floor(Math.random() * 10) + 1;
  const events = Array.from({ length: batchSize }, generateEvent);

  const payload = JSON.stringify({
    k: PUBLIC_KEY,
    events: events,
  });

  const startTime = Date.now();
  
  const res = http.post(`${COLLECTOR_URL}/v1/collect`, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'collect' },
  });

  const latency = Date.now() - startTime;
  collectLatency.add(latency);

  const success = check(res, {
    'status is 204': (r) => r.status === 204,
    'latency < 50ms': () => latency < 50,
  });

  if (!success) {
    errorRate.add(1);
  } else {
    eventsCollected.add(batchSize);
  }

  sleep(Math.random() * 0.1);
}

export function handleSummary(data) {
  const totalEvents = data.metrics.events_collected?.values?.count || 0;
  const duration = data.state.testRunDurationMs / 1000;
  const eventsPerSecond = totalEvents / duration;

  console.log(`
=== Load Test Summary ===
Total Events Collected: ${totalEvents.toLocaleString()}
Test Duration: ${duration.toFixed(1)}s
Events per Second: ${eventsPerSecond.toFixed(0)}
P95 Latency: ${data.metrics.collect_latency?.values?.['p(95)']?.toFixed(1)}ms
P99 Latency: ${data.metrics.collect_latency?.values?.['p(99)']?.toFixed(1)}ms
Error Rate: ${(data.metrics.errors?.values?.rate * 100 || 0).toFixed(2)}%
=========================
  `);

  return {
    'stdout': JSON.stringify(data, null, 2),
    'summary.json': JSON.stringify(data, null, 2),
  };
}
