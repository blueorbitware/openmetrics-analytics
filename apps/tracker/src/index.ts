interface Config {
  autotrack: {
    page_views: boolean;
    clicks: boolean;
    forms: boolean;
    scroll_depth: boolean;
    outbound_links: boolean;
    web_vitals: boolean;
    spa_navigation: boolean;
  };
  mask_selectors: string[];
  sample_rate: number;
  session_timeout: number;
  banners: BannerConfig[];
}

interface BannerConfig {
  id: string;
  targeting: BannerTargeting;
  variants: BannerVariant[];
  frequency_cap: number;
  frequency_days: number;
}

interface BannerTargeting {
  url_patterns?: string[];
  user_props?: Record<string, string>;
  countries?: string[];
  devices?: string[];
  event_trigger?: string;
  percentage?: number;
}

interface BannerVariant {
  id: string;
  weight: number;
  html: string;
  css: string;
  cta_url?: string;
  cta_text?: string;
}

interface EventPayload {
  event: string;
  type: string;
  ts: number;
  anon_id: string;
  user_id?: string;
  session_id: string;
  is_new_session: boolean;
  url: string;
  path: string;
  referrer: string;
  title: string;
  hash: string;
  search: string;
  utm?: Record<string, string>;
  locale: string;
  screen_width: number;
  screen_height: number;
  props?: Record<string, unknown>;
  user_props?: Record<string, string>;
  revenue?: number;
  currency?: string;
  order_id?: string;
  product_id?: string;
  product_name?: string;
  product_category?: string;
  quantity?: number;
  banner_id?: string;
  banner_variant?: string;
  lcp?: number;
  fid?: number;
  cls?: number;
  ttfb?: number;
  fcp?: number;
  scroll_depth?: number;
}

interface Product {
  id?: string;
  product_id?: string;
  name?: string;
  price?: number;
  quantity?: number;
  category?: string;
  currency?: string;
}

interface Order {
  order_id: string;
  revenue: number;
  currency?: string;
  products?: Product[];
}

class Analytics {
  private publicKey: string = '';
  private collectorUrl: string = '';
  private apiUrl: string = '';
  private config: Config | null = null;
  private anonId: string = '';
  private userId: string | null = null;
  private sessionId: string = '';
  private isNewSession: boolean = false;
  private userProps: Record<string, string> = {};
  private eventQueue: EventPayload[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private scrollDepthTracked: Set<number> = new Set();
  private lastActivityTs: number = Date.now();
  private initialized: boolean = false;
  private bannerContainer: HTMLElement | null = null;
  private shownBanners: Set<string> = new Set();

  constructor() {
    this.init();
  }

  private init(): void {
    if (typeof window === 'undefined') return;

    const script = document.currentScript as HTMLScriptElement;
    if (!script?.src) return;

    const url = new URL(script.src);
    this.publicKey = url.searchParams.get('k') || '';
    
    const origin = url.origin;
    this.collectorUrl = origin;
    this.apiUrl = origin.replace(':8081', ':8080');

    if (!this.publicKey) {
      console.warn('[Analytics] No public key found');
      return;
    }

    this.initIdentity();
    this.initSession();
    this.loadConfig();
    
    this.initialized = true;
  }

  private initIdentity(): void {
    this.anonId = this.getCookie('_anon_id') || this.getStorage('_anon_id') || '';
    
    if (!this.anonId) {
      this.anonId = 'anon_' + this.generateId();
      this.setCookie('_anon_id', this.anonId, 365);
      this.setStorage('_anon_id', this.anonId);
    }

    this.userId = this.getStorage('_user_id');
    
    const storedProps = this.getStorage('_user_props');
    if (storedProps) {
      try {
        this.userProps = JSON.parse(storedProps);
      } catch {}
    }
  }

  private initSession(): void {
    const sessionTimeout = (this.config?.session_timeout || 30) * 60 * 1000;
    const storedSession = this.getStorage('_session');
    
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession);
        const timeSinceLastActivity = Date.now() - session.lastActivity;
        
        if (timeSinceLastActivity < sessionTimeout) {
          this.sessionId = session.id;
          this.isNewSession = false;
          this.lastActivityTs = session.lastActivity;
        } else {
          this.startNewSession();
        }
      } catch {
        this.startNewSession();
      }
    } else {
      this.startNewSession();
    }

    this.updateSessionActivity();
  }

  private startNewSession(): void {
    this.sessionId = 'sess_' + this.generateId();
    this.isNewSession = true;
    this.lastActivityTs = Date.now();
    this.scrollDepthTracked.clear();
  }

  private updateSessionActivity(): void {
    this.lastActivityTs = Date.now();
    this.setStorage('_session', JSON.stringify({
      id: this.sessionId,
      lastActivity: this.lastActivityTs
    }));
  }

  private async loadConfig(): Promise<void> {
    const cached = sessionStorage.getItem(`_config_${this.publicKey}`);
    if (cached) {
      try {
        this.config = JSON.parse(cached);
        this.setupAutotrack();
        this.setupBanners();
        return;
      } catch {}
    }

    try {
      const response = await fetch(`${this.collectorUrl}/v1/config/${this.publicKey}`);
      if (response.ok) {
        this.config = await response.json();
        sessionStorage.setItem(`_config_${this.publicKey}`, JSON.stringify(this.config));
        this.setupAutotrack();
        this.setupBanners();
      }
    } catch (err) {
      console.warn('[Analytics] Failed to load config:', err);
      this.config = {
        autotrack: {
          page_views: true,
          clicks: true,
          forms: true,
          scroll_depth: true,
          outbound_links: true,
          web_vitals: true,
          spa_navigation: true,
        },
        mask_selectors: [],
        sample_rate: 1,
        session_timeout: 30,
        banners: [],
      };
      this.setupAutotrack();
    }
  }

  private setupAutotrack(): void {
    if (!this.config?.autotrack) return;

    const { autotrack } = this.config;

    if (autotrack.page_views) {
      this.trackPageView();
    }

    if (autotrack.spa_navigation) {
      this.setupSPATracking();
    }

    if (autotrack.clicks) {
      this.setupClickTracking();
    }

    if (autotrack.forms) {
      this.setupFormTracking();
    }

    if (autotrack.scroll_depth) {
      this.setupScrollTracking();
    }

    if (autotrack.outbound_links) {
      this.setupOutboundLinkTracking();
    }

    if (autotrack.web_vitals) {
      this.setupWebVitals();
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });

    window.addEventListener('pagehide', () => this.flush());
  }

  private setupSPATracking(): void {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.trackPageView();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.trackPageView();
    };

    window.addEventListener('popstate', () => {
      this.trackPageView();
    });
  }

  private setupClickTracking(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const trackable = target.closest('[data-track]');
      
      if (trackable) {
        const eventName = trackable.getAttribute('data-track') || 'click';
        let props: Record<string, unknown> = {};
        
        const propsAttr = trackable.getAttribute('data-track-props');
        if (propsAttr) {
          try {
            props = JSON.parse(propsAttr);
          } catch {}
        }

        this.track(eventName, {
          ...props,
          element_tag: trackable.tagName.toLowerCase(),
          element_text: (trackable.textContent || '').slice(0, 100),
        });
      }
    });
  }

  private setupFormTracking(): void {
    document.addEventListener('submit', (e) => {
      const form = e.target as HTMLFormElement;
      if (!form.tagName || form.tagName.toLowerCase() !== 'form') return;

      this.track('form_submit', {
        form_id: form.id || undefined,
        form_name: form.getAttribute('name') || undefined,
        form_action: form.action || undefined,
      });
    });
  }

  private setupScrollTracking(): void {
    const thresholds = [25, 50, 75, 100];
    
    const trackScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      
      const scrollPercent = Math.round((window.scrollY / scrollHeight) * 100);
      
      for (const threshold of thresholds) {
        if (scrollPercent >= threshold && !this.scrollDepthTracked.has(threshold)) {
          this.scrollDepthTracked.add(threshold);
          this.track('scroll_depth', { scroll_depth: threshold });
        }
      }
    };

    window.addEventListener('scroll', this.throttle(trackScroll, 500));
  }

  private setupOutboundLinkTracking(): void {
    document.addEventListener('click', (e) => {
      const link = (e.target as HTMLElement).closest('a');
      if (!link) return;

      const href = link.href;
      if (!href) return;

      try {
        const url = new URL(href);
        if (url.hostname !== window.location.hostname) {
          this.track('outbound_link_click', {
            url: href,
            hostname: url.hostname,
            text: (link.textContent || '').slice(0, 100),
          });
        }
      } catch {}
    });
  }

  private setupWebVitals(): void {
    if ('PerformanceObserver' in window) {
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'largest-contentful-paint') {
              this.queueEvent({
                event: 'web_vitals',
                type: 'performance',
                lcp: entry.startTime,
              });
            }
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'first-input') {
              const fidEntry = entry as PerformanceEventTiming;
              this.queueEvent({
                event: 'web_vitals',
                type: 'performance',
                fid: fidEntry.processingStart - fidEntry.startTime,
              });
            }
          }
        }).observe({ type: 'first-input', buffered: true });

        new PerformanceObserver((list) => {
          let cls = 0;
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              cls += (entry as any).value;
            }
          }
          this.queueEvent({
            event: 'web_vitals',
            type: 'performance',
            cls,
          });
        }).observe({ type: 'layout-shift', buffered: true });

        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (nav) {
          this.queueEvent({
            event: 'web_vitals',
            type: 'performance',
            ttfb: nav.responseStart - nav.requestStart,
            fcp: nav.domContentLoadedEventEnd - nav.startTime,
          });
        }
      } catch {}
    }
  }

  private setupBanners(): void {
    if (!this.config?.banners?.length) return;

    this.bannerContainer = document.createElement('div');
    this.bannerContainer.id = 'analytics-banners';
    this.bannerContainer.attachShadow({ mode: 'closed' });
    document.body.appendChild(this.bannerContainer);

    for (const banner of this.config.banners) {
      this.evaluateBanner(banner);
    }
  }

  private evaluateBanner(banner: BannerConfig): void {
    if (this.shownBanners.has(banner.id)) return;

    const shown = this.getBannerImpressions(banner.id);
    if (shown >= banner.frequency_cap) return;

    const { targeting } = banner;

    if (targeting.url_patterns?.length) {
      const matches = targeting.url_patterns.some(pattern => {
        try {
          return new RegExp(pattern).test(window.location.href);
        } catch {
          return window.location.href.includes(pattern);
        }
      });
      if (!matches) return;
    }

    if (targeting.percentage && Math.random() * 100 > targeting.percentage) {
      return;
    }

    const variant = this.selectVariant(banner.variants);
    if (!variant) return;

    this.showBanner(banner, variant);
  }

  private selectVariant(variants: BannerVariant[]): BannerVariant | null {
    if (!variants.length) return null;

    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    let random = Math.random() * totalWeight;

    for (const variant of variants) {
      random -= variant.weight;
      if (random <= 0) return variant;
    }

    return variants[0];
  }

  private showBanner(banner: BannerConfig, variant: BannerVariant): void {
    if (!this.bannerContainer?.shadowRoot) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'banner-wrapper';
    wrapper.innerHTML = `
      <style>
        .banner-wrapper {
          position: fixed;
          z-index: 999999;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        .banner-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: -1;
        }
        .banner-close {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #666;
        }
        .banner-content {
          position: relative;
          background: white;
          padding: 24px;
          border-radius: 8px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          max-width: 500px;
        }
        ${variant.css}
      </style>
      <div class="banner-backdrop"></div>
      <div class="banner-content">
        <button class="banner-close">&times;</button>
        ${variant.html}
      </div>
    `;

    const close = wrapper.querySelector('.banner-close');
    const backdrop = wrapper.querySelector('.banner-backdrop');

    const dismiss = () => {
      wrapper.remove();
      this.track('banner_dismiss', {
        banner_id: banner.id,
        banner_variant: variant.id,
      });
    };

    close?.addEventListener('click', dismiss);
    backdrop?.addEventListener('click', dismiss);

    wrapper.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.matches('a, button') || target.closest('a, button')) {
        this.track('banner_cta_click', {
          banner_id: banner.id,
          banner_variant: variant.id,
          cta_url: variant.cta_url,
        });
      }
    });

    this.bannerContainer.shadowRoot.appendChild(wrapper);
    this.shownBanners.add(banner.id);
    this.recordBannerImpression(banner.id);

    this.track('banner_impression', {
      banner_id: banner.id,
      banner_variant: variant.id,
    });
  }

  private getBannerImpressions(bannerId: string): number {
    const key = `_banner_${bannerId}`;
    const stored = this.getStorage(key);
    if (!stored) return 0;

    try {
      const data = JSON.parse(stored);
      const days = this.config?.banners?.find(b => b.id === bannerId)?.frequency_days || 7;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      return data.impressions?.filter((ts: number) => ts > cutoff).length || 0;
    } catch {
      return 0;
    }
  }

  private recordBannerImpression(bannerId: string): void {
    const key = `_banner_${bannerId}`;
    let data = { impressions: [] as number[] };
    
    const stored = this.getStorage(key);
    if (stored) {
      try {
        data = JSON.parse(stored);
      } catch {}
    }

    data.impressions.push(Date.now());
    this.setStorage(key, JSON.stringify(data));
  }

  private trackPageView(): void {
    this.updateSessionActivity();
    this.queueEvent({
      event: 'page_view',
      type: 'page',
    });
    this.scrollDepthTracked.clear();
  }

  track(eventName: string, props?: Record<string, unknown>): void {
    if (!this.initialized) return;
    this.updateSessionActivity();
    this.queueEvent({
      event: eventName,
      type: 'custom',
      props,
    });
  }

  identify(userId: string, traits?: Record<string, string>): void {
    if (!this.initialized) return;

    this.userId = userId;
    this.setStorage('_user_id', userId);

    if (traits) {
      this.userProps = { ...this.userProps, ...traits };
      this.setStorage('_user_props', JSON.stringify(this.userProps));
    }

    this.queueEvent({
      event: 'identify',
      type: 'auth',
      user_props: this.userProps,
    });
  }

  page(props?: Record<string, unknown>): void {
    if (!this.initialized) return;
    this.updateSessionActivity();
    this.queueEvent({
      event: 'page_view',
      type: 'page',
      props,
    });
  }

  ecommerce = {
    addToCart: (product: Product): void => {
      if (!this.initialized) return;
      this.queueEvent({
        event: 'add_to_cart',
        type: 'ecommerce',
        product_id: product.id || product.product_id,
        product_name: product.name,
        revenue: product.price,
        quantity: product.quantity || 1,
        product_category: product.category,
        currency: product.currency || 'USD',
        props: product as unknown as Record<string, unknown>,
      });
    },

    removeFromCart: (product: Product): void => {
      if (!this.initialized) return;
      this.queueEvent({
        event: 'remove_from_cart',
        type: 'ecommerce',
        product_id: product.id || product.product_id,
        product_name: product.name,
        revenue: product.price,
        quantity: product.quantity || 1,
        currency: product.currency || 'USD',
      });
    },

    checkout: (cart: { products?: Product[]; revenue?: number; currency?: string }): void => {
      if (!this.initialized) return;
      this.queueEvent({
        event: 'begin_checkout',
        type: 'ecommerce',
        revenue: cart.revenue,
        currency: cart.currency || 'USD',
        props: { products: cart.products } as unknown as Record<string, unknown>,
      });
    },

    purchase: (order: Order): void => {
      if (!this.initialized) return;
      this.queueEvent({
        event: 'purchase',
        type: 'ecommerce',
        order_id: order.order_id,
        revenue: order.revenue,
        currency: order.currency || 'USD',
        props: { products: order.products } as unknown as Record<string, unknown>,
      });
    },
  };

  auth = {
    signup: (userId: string, traits?: Record<string, string>): void => {
      if (!this.initialized) return;
      this.identify(userId, traits);
      this.queueEvent({
        event: 'sign_up',
        type: 'auth',
        user_props: traits,
      });
    },

    login: (userId: string): void => {
      if (!this.initialized) return;
      this.userId = userId;
      this.setStorage('_user_id', userId);
      this.queueEvent({
        event: 'login',
        type: 'auth',
      });
    },

    logout: (): void => {
      if (!this.initialized) return;
      this.queueEvent({
        event: 'logout',
        type: 'auth',
      });
      this.userId = null;
      localStorage.removeItem('_user_id');
    },
  };

  private queueEvent(partial: Partial<EventPayload>): void {
    if (!this.shouldTrack()) return;

    const event: EventPayload = {
      event: partial.event || 'unknown',
      type: partial.type || 'custom',
      ts: Date.now(),
      anon_id: this.anonId,
      user_id: this.userId || undefined,
      session_id: this.sessionId,
      is_new_session: this.isNewSession,
      url: window.location.href,
      path: window.location.pathname,
      referrer: document.referrer,
      title: document.title,
      hash: window.location.hash,
      search: window.location.search,
      utm: this.getUTMParams(),
      locale: navigator.language,
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      user_props: Object.keys(this.userProps).length ? this.userProps : undefined,
      ...partial,
    };

    this.eventQueue.push(event);
    this.isNewSession = false;

    if (this.eventQueue.length >= 20) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), 2000);
    }
  }

  private flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    const payload = JSON.stringify({
      k: this.publicKey,
      events,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${this.collectorUrl}/v1/collect`, payload);
    } else {
      fetch(`${this.collectorUrl}/v1/collect`, {
        method: 'POST',
        body: payload,
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
    }
  }

  private shouldTrack(): boolean {
    if (!this.config) return true;
    return Math.random() < this.config.sample_rate;
  }

  private getUTMParams(): Record<string, string> | undefined {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};

    for (const [key, value] of params.entries()) {
      if (value) {
        utm[key] = value;
      }
    }

    return Object.keys(utm).length ? utm : undefined;
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  private getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  private setCookie(name: string, value: string, days: number): void {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
  }

  private getStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private setStorage(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }

  private throttle<T extends (...args: unknown[]) => void>(fn: T, wait: number): T {
    let lastTime = 0;
    return ((...args: unknown[]) => {
      const now = Date.now();
      if (now - lastTime >= wait) {
        lastTime = now;
        fn(...args);
      }
    }) as T;
  }
}

declare global {
  interface Window {
    analytics: Analytics;
  }
}

window.analytics = new Analytics();
