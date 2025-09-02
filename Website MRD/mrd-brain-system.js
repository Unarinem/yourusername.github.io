/**
 * MRD Brain System - Complete Self-Contained Website Intelligence
 * Version: 2.0 - Self-Contained Edition
 * 
 * This system provides:
 * - Local form handling and data storage
 * - SEO optimization and meta management
 * - Performance monitoring and optimization
 * - Responsive design management
 * - Analytics and user behavior tracking
 * - Complete independence from external services
 */

class MRDBrainSystem {
    constructor() {
        this.config = {
            debug: true,
            enableAnalytics: true,
            enablePerformanceMonitoring: true,
            enableSEOManagement: true,
            enableExternalSubmission: true, // realtime external submission enabled
            // Route submissions through same-origin PHP to avoid CORS/redirects; PHP forwards to Apps Script
            externalWebhookUrl: '/api/submit.php',
            analyticsWebhookUrl: 'https://script.google.com/macros/s/AKfycbyl76rAby3CB5QOjYV86bTrskCOhh1xphKNFbE4mm3Mva67HZnloja6ox4Uf3R-I4xKQg/exec', // analytics webhook
            emailRecipient: '', // emailing disabled
            batchIntervalMs: 2 * 60 * 60 * 1000, // 2 hours
            localStoragePrefix: 'mrd_brain_',
            sessionTimeout: 30 * 60 * 1000, // 30 minutes
            maxLocalStorageSize: 10 * 1024 * 1024, // 10MB
            performanceThresholds: {
                pageLoad: 3000, // 3 seconds
                interaction: 100, // 100ms
                animation: 16 // 16ms (60fps)
            }
        };
        
        this.data = {
            sessions: {},
            analytics: {},
            forms: {},
            performance: {},
            seo: {}
        };
        
        this.currentSession = null;
        this.performanceObserver = null;
        this.intersectionObserver = null;
        this.resizeObserver = null;
        
        this.init();
    }

    /**
     * Initialize the MRD Brain System
     */
    init() {
        try {
            this.setupEventListeners();
            this.initializeAnalytics();
            this.initializePerformanceMonitoring();
            this.initializeSEOManagement();
            this.initializeResponsiveDesign();
            this.loadLocalData();
            this.startSessionTracking();
            this.startBatchScheduler();
            
            if (this.config.debug) {
                console.log('🚀 MRD Brain System initialized successfully');
                this.logStatus();
            }
        } catch (error) {
            console.error('❌ MRD Brain System initialization failed:', error);
        }
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Form submission handling
        document.addEventListener('submit', (e) => this.handleFormSubmission(e));
        
        // Performance monitoring
        window.addEventListener('load', () => this.trackPageLoad());
        window.addEventListener('beforeunload', () => this.trackPageUnload());
        
        // User interaction tracking
        document.addEventListener('click', (e) => this.trackInteraction('click', e.target));
        document.addEventListener('scroll', this.debounce(() => this.trackScroll(), 100));
        
        // Responsive design management
        window.addEventListener('resize', this.debounce(() => this.handleResize(), 250));
        
        // SEO and accessibility improvements
        document.addEventListener('DOMContentLoaded', () => this.enhanceAccessibility());
    }

    /**
     * Handle form submissions completely locally
     */
    async handleFormSubmission(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        const formId = form.id || 'unknown_form';
        
        // Collect form data
        const submissionData = {
            timestamp: new Date().toISOString(),
            page_source: this.getCurrentPage(),
            form_id: formId,
            session_id: this.getCurrentSessionId(),
            data: {}
        };
        
        // Process form fields
        for (let [key, value] of formData.entries()) {
            if (value && value.trim()) {
                submissionData.data[key] = value.trim();
            }
        }
        
        // Store locally
        this.saveFormSubmission(submissionData);
        
        // Track analytics
        this.trackEvent('form_submission', {
            form_id: formId,
            page: this.getCurrentPage(),
            fields_count: Object.keys(submissionData.data).length
        });
        
        // Show success feedback
        this.showFormFeedback(form, 'success', 'Thank you! Your submission has been received.');
        
        // Reset form
        form.reset();
        
        // Realtime external send (non-blocking)
        this.sendSingleIfConfigured(submissionData);
    }

    /**
     * Save form submission locally
     */
    saveFormSubmission(data) {
        try {
            const submissions = this.getLocalData('form_submissions') || [];
            submissions.push(data);
            
            // Keep only last 100 submissions to prevent storage bloat
            if (submissions.length > 100) {
                submissions.splice(0, submissions.length - 100);
            }
            
            this.saveLocalData('form_submissions', submissions);
            
            if (this.config.debug) {
                console.log('📝 Form submission saved locally:', data);
            }
            // Realtime external send (non-blocking)
            this.sendSingleIfConfigured(data);
        } catch (error) {
            console.error('❌ Failed to save form submission:', error);
        }
    }

    /**
     * Batch scheduler - sends accumulated submissions every N ms
     */
    startBatchScheduler() {
        try {
            // Attempt immediately on load if due
            this.trySendBatchIfDue();
            // Schedule interval
            setInterval(() => this.trySendBatchIfDue(), this.config.batchIntervalMs / 4);
        } catch (err) {
            if (this.config.debug) console.warn('⚠️ Batch scheduler error', err);
        }
    }

    markPendingForBatch() {
        this.saveLocalData('pending_batch', { updated_at: Date.now() });
    }

    trySendBatchIfDue() {
        if (!this.config.enableExternalSubmission || !this.config.externalWebhookUrl) return;
        const lastSentAt = this.getLocalData('last_batch_sent_at') || 0;
        const now = Date.now();
        const due = now - lastSentAt >= this.config.batchIntervalMs;
        if (!due) return;
        this.sendBatchSubmissions().catch(err => {
            if (this.config.debug) console.warn('⚠️ Batch send failed, will retry later', err);
        });
    }

    /**
     * Send batched submissions to external webhook (Make/Apps Script)
     */
    async sendBatchSubmissions() {
        const submissions = this.getLocalData('form_submissions') || [];
        if (!submissions.length) return;

        const payload = {
            type: 'mrd_batch_submit',
            site: window.location.origin || 'local',
            sent_at: new Date().toISOString(),
            submissions
        };

        try {
            const res = await fetch(this.config.externalWebhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                mode: 'cors'
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            // On success, mark last sent time and optionally clear local submissions
            this.saveLocalData('last_batch_sent_at', Date.now());
            // Keep data but mark snapshot to avoid re-sending same entries; simplest is to clear after send
            this.saveLocalData('form_submissions', []);

            this.trackEvent('batch_sent', { count: submissions.length });
            if (this.config.debug) console.log(`📤 Sent batch of ${submissions.length} submissions`);
        } catch (error) {
            console.error('❌ Failed to send batch submissions:', error);
            this.trackEvent('batch_send_failed', { error: String(error) });
        }
    }

    /**
     * Legacy single submission sender (kept for completeness)
     */
    async sendToExternalService(submissionData) {
        if (!this.config.externalWebhookUrl) return;
        try {
            await fetch(this.config.externalWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'mrd_single_submit',
                    submission: submissionData
                }),
                mode: 'cors'
            });
        } catch (error) {
            if (this.config.debug) console.warn('⚠️ sendToExternalService failed', error);
        }
    }

    async sendSingleIfConfigured(submissionData) {
        if (!this.config.enableExternalSubmission || !this.config.externalWebhookUrl) return;
        try {
            await fetch(this.config.externalWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'mrd_single_submit', submission: submissionData }),
                mode: 'cors'
            });
            this.trackEvent('single_submit_sent', { form_id: submissionData.form_id });
        } catch (error) {
            this.trackEvent('single_submit_failed', { error: String(error) });
            if (this.config.debug) console.warn('⚠️ Realtime submission failed', error);
        }
    }

    /**
     * Show form feedback to user
     */
    showFormFeedback(form, type, message) {
        const feedbackDiv = document.getElementById('form-feedback') || this.createFeedbackElement(form);
        
        feedbackDiv.className = `form-feedback ${type}`;
        feedbackDiv.textContent = message;
        feedbackDiv.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            feedbackDiv.classList.add('hidden');
        }, 5000);
    }

    /**
     * Create feedback element if it doesn't exist
     */
    createFeedbackElement(form) {
        const feedbackDiv = document.createElement('div');
        feedbackDiv.id = 'form-feedback';
        feedbackDiv.className = 'form-feedback hidden';
        form.appendChild(feedbackDiv);
        return feedbackDiv;
    }

    /**
     * Initialize analytics system
     */
    initializeAnalytics() {
        if (!this.config.enableAnalytics) return;
        
        this.trackPageView();
        this.setupAnalyticsTracking();
        
        if (this.config.debug) {
            console.log('📊 Analytics system initialized');
        }
    }

    /**
     * Track page view
     */
    trackPageView() {
        const pageData = {
            url: window.location.href,
            title: document.title,
            timestamp: new Date().toISOString(),
            session_id: this.getCurrentSessionId(),
            referrer: document.referrer,
            user_agent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        };
        
        this.saveAnalyticsData('page_views', pageData);
        this.trackEvent('page_view', pageData);
    }

    /**
     * Track user interactions
     */
    trackInteraction(type, element) {
        const interactionData = {
            type: type,
            element: this.getElementInfo(element),
            timestamp: new Date().toISOString(),
            session_id: this.getCurrentSessionId(),
            page: this.getCurrentPage()
        };
        
        this.trackEvent('interaction', interactionData);
    }

    /**
     * Track scroll behavior
     */
    trackScroll() {
        const scrollData = {
            scrollY: window.scrollY,
            scrollX: window.scrollX,
            maxScrollY: document.documentElement.scrollHeight - window.innerHeight,
            scrollPercentage: Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100)
        };
        
        this.trackEvent('scroll', scrollData);
    }

    /**
     * Initialize performance monitoring
     */
    initializePerformanceMonitoring() {
        if (!this.config.enablePerformanceMonitoring) return;
        
        this.setupPerformanceObserver();
        this.monitorCoreWebVitals();
        
        if (this.config.debug) {
            console.log('⚡ Performance monitoring initialized');
        }
    }

    /**
     * Setup performance observer
     */
    setupPerformanceObserver() {
        if ('PerformanceObserver' in window) {
            try {
                this.performanceObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        this.analyzePerformanceEntry(entry);
                    }
                });
                
                this.performanceObserver.observe({ entryTypes: ['navigation', 'resource', 'paint'] });
            } catch (error) {
                console.warn('⚠️ PerformanceObserver setup failed:', error);
            }
        }
    }

    /**
     * Monitor Core Web Vitals
     */
    monitorCoreWebVitals() {
        // LCP (Largest Contentful Paint)
        if ('PerformanceObserver' in window) {
            try {
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    this.trackCoreWebVital('LCP', lastEntry.startTime);
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            } catch (error) {
                console.warn('⚠️ LCP monitoring failed:', error);
            }
        }
        
        // FID (First Input Delay)
        if ('PerformanceObserver' in window) {
            try {
                const fidObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        this.trackCoreWebVital('FID', entry.processingStart - entry.startTime);
                    });
                });
                fidObserver.observe({ entryTypes: ['first-input'] });
            } catch (error) {
                console.warn('⚠️ FID monitoring failed:', error);
            }
        }
        
        // CLS (Cumulative Layout Shift)
        if ('PerformanceObserver' in window) {
            try {
                let clsValue = 0;
                const clsObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    }
                    this.trackCoreWebVital('CLS', clsValue);
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
            } catch (error) {
                console.warn('⚠️ CLS monitoring failed:', error);
            }
        }
    }

    /**
     * Track Core Web Vitals
     */
    trackCoreWebVital(metric, value) {
        const vitalData = {
            metric: metric,
            value: value,
            timestamp: new Date().toISOString(),
            page: this.getCurrentPage(),
            session_id: this.getCurrentSessionId()
        };
        
        this.saveAnalyticsData('core_web_vitals', vitalData);
        
        // Alert if performance is poor
        if (metric === 'LCP' && value > 4000) {
            this.alertPerformanceIssue('LCP', value);
        } else if (metric === 'FID' && value > 300) {
            this.alertPerformanceIssue('FID', value);
        } else if (metric === 'CLS' && value > 0.25) {
            this.alertPerformanceIssue('CLS', value);
        }
    }

    /**
     * Initialize SEO management
     */
    initializeSEOManagement() {
        if (!this.config.enableSEOManagement) return;
        
        this.optimizeMetaTags();
        this.setupStructuredData();
        this.enhanceInternalLinking();
        
        if (this.config.debug) {
            console.log('🔍 SEO management initialized');
        }
    }

    /**
     * Optimize meta tags
     */
    optimizeMetaTags() {
        // Ensure proper meta description
        if (!document.querySelector('meta[name="description"]')) {
            const meta = document.createElement('meta');
            meta.name = 'description';
            meta.content = 'MRD AI & Blockchain Consulting - Master AI automation and blockchain technology with cutting-edge no-code solutions.';
            document.head.appendChild(meta);
        }
        
        // Ensure proper viewport meta tag
        if (!document.querySelector('meta[name="viewport"]')) {
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0';
            document.head.appendChild(meta);
        }
        
        // Add Open Graph tags
        this.addOpenGraphTags();
    }

    /**
     * Add Open Graph tags for social media
     */
    addOpenGraphTags() {
        const ogTags = [
            { property: 'og:title', content: document.title },
            { property: 'og:description', content: 'MRD AI & Blockchain Consulting - Master AI automation and blockchain technology.' },
            { property: 'og:type', content: 'website' },
            { property: 'og:url', content: window.location.href },
            { property: 'og:site_name', content: 'MRD AI & Blockchain Consulting' }
        ];
        
        ogTags.forEach(tag => {
            if (!document.querySelector(`meta[property="${tag.property}"]`)) {
                const meta = document.createElement('meta');
                meta.setAttribute('property', tag.property);
                meta.content = tag.content;
                document.head.appendChild(meta);
            }
        });
    }

    /**
     * Initialize responsive design management
     */
    initializeResponsiveDesign() {
        this.setupIntersectionObserver();
        this.setupResizeObserver();
        this.optimizeImages();
        
        if (this.config.debug) {
            console.log('📱 Responsive design management initialized');
        }
    }

    /**
     * Setup intersection observer for animations
     */
    setupIntersectionObserver() {
        if ('IntersectionObserver' in window) {
            this.intersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate');
                        this.trackEvent('element_visible', {
                            element: entry.target.tagName,
                            class: entry.target.className
                        });
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            });
            
            // Observe all animated elements
            document.querySelectorAll('.fade-in, .slide-in-left, .slide-in-right, .scale-in').forEach(el => {
                this.intersectionObserver.observe(el);
            });
        }
    }

    /**
     * Setup resize observer for responsive behavior
     */
    setupResizeObserver() {
        if ('ResizeObserver' in window) {
            this.resizeObserver = new ResizeObserver((entries) => {
                entries.forEach(entry => {
                    this.handleElementResize(entry);
                });
            });
            
            // Observe main content areas
            const mainContent = document.querySelector('.main-content, .cover-glass-container');
            if (mainContent) {
                this.resizeObserver.observe(mainContent);
            }
        }
    }

    /**
     * Optimize images for performance
     */
    optimizeImages() {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            // Add loading="lazy" for images below the fold
            if (!img.hasAttribute('loading')) {
                img.loading = 'lazy';
            }
            
            // Add alt text if missing
            if (!img.alt) {
                img.alt = 'MRD AI & Blockchain Consulting';
            }
            
            // Optimize srcset for responsive images
            this.optimizeImageSrcset(img);
        });
    }

    /**
     * Optimize image srcset for responsive design
     */
    optimizeImageSrcset(img) {
        if (img.src && !img.srcset) {
            const baseUrl = img.src;
            const extension = baseUrl.split('.').pop();
            const baseName = baseUrl.replace(`.${extension}`, '');
            
            // Create responsive srcset for common breakpoints
            const breakpoints = [
                { width: 320, suffix: '_sm' },
                { width: 768, suffix: '_md' },
                { width: 1024, suffix: '_lg' },
                { width: 1440, suffix: '_xl' }
            ];
            
            const srcset = breakpoints.map(bp => 
                `${baseName}${bp.suffix}.${extension} ${bp.width}w`
            ).join(', ');
            
            img.srcset = srcset;
            img.sizes = '(max-width: 320px) 320px, (max-width: 768px) 768px, (max-width: 1024px) 1024px, 1440px';
        }
    }

    /**
     * Handle element resize
     */
    handleElementResize(entry) {
        const element = entry.target;
        const { width, height } = entry.contentRect;
        
        // Adjust layout based on size
        if (width < 768) {
            element.classList.add('mobile-layout');
            element.classList.remove('desktop-layout');
        } else {
            element.classList.add('desktop-layout');
            element.classList.remove('mobile-layout');
        }
        
        // Track responsive breakpoint changes
        this.trackEvent('breakpoint_change', {
            width: width,
            height: height,
            breakpoint: width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop'
        });
    }

    /**
     * Enhance accessibility
     */
    enhanceAccessibility() {
        // Add skip links
        this.addSkipLinks();
        
        // Enhance keyboard navigation
        this.enhanceKeyboardNavigation();
        
        // Add ARIA labels where needed
        this.addARIALabels();
        
        // Ensure proper heading hierarchy
        this.validateHeadingHierarchy();
    }

    /**
     * Add skip links for accessibility
     */
    addSkipLinks() {
        if (!document.querySelector('.skip-link')) {
            const skipLink = document.createElement('a');
            skipLink.href = '#main-content';
            skipLink.className = 'skip-link';
            skipLink.textContent = 'Skip to main content';
            skipLink.style.cssText = `
                position: absolute;
                top: -40px;
                left: 6px;
                background: #000;
                color: #fff;
                padding: 8px;
                text-decoration: none;
                z-index: 10000;
                transition: top 0.3s;
            `;
            
            skipLink.addEventListener('focus', () => {
                skipLink.style.top = '6px';
            });
            
            skipLink.addEventListener('blur', () => {
                skipLink.style.top = '-40px';
            });
            
            document.body.insertBefore(skipLink, document.body.firstChild);
        }
    }

    /**
     * Session management
     */
    startSessionTracking() {
        this.currentSession = {
            id: this.generateSessionId(),
            startTime: new Date().toISOString(),
            page: this.getCurrentPage(),
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        };
        
        this.saveLocalData('current_session', this.currentSession);
        this.trackEvent('session_start', this.currentSession);
        
        // Session timeout
        setTimeout(() => {
            this.endSession();
        }, this.config.sessionTimeout);
    }

    /**
     * End current session
     */
    endSession() {
        if (this.currentSession) {
            this.currentSession.endTime = new Date().toISOString();
            this.currentSession.duration = new Date(this.currentSession.endTime) - new Date(this.currentSession.startTime);
            
            this.trackEvent('session_end', this.currentSession);
            this.saveLocalData('completed_sessions', this.currentSession);
            
            this.currentSession = null;
        }
    }

    /**
     * Utility methods
     */
    getCurrentPage() {
        const path = window.location.pathname;
        if (path === '/' || path === '/index.html') return 'home_page';
        if (path.includes('courses')) return 'courses_page';
        if (path.includes('learn')) return 'learn_page';
        if (path.includes('contact')) return 'contact_page';
        if (path.includes('join')) return 'join_page';
        if (path.includes('cryptocurrency')) return 'cryptocurrency_page';
        return 'unknown_page';
    }

    getCurrentSessionId() {
        return this.currentSession ? this.currentSession.id : 'no_session';
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getElementInfo(element) {
        if (!element) return {};
        
        return {
            tag: element.tagName,
            id: element.id || '',
            class: element.className || '',
            text: element.textContent ? element.textContent.substring(0, 50) : '',
            type: element.type || ''
        };
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    saveLocalData(key, data) {
        try {
            const fullKey = this.config.localStoragePrefix + key;
            localStorage.setItem(fullKey, JSON.stringify(data));
        } catch (error) {
            console.warn('⚠️ Failed to save to localStorage:', error);
        }
    }

    getLocalData(key) {
        try {
            const fullKey = this.config.localStoragePrefix + key;
            const data = localStorage.getItem(fullKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn('⚠️ Failed to read from localStorage:', error);
            return null;
        }
    }

    saveAnalyticsData(key, data) {
        try {
            const analytics = this.getLocalData('analytics') || {};
            if (!analytics[key]) analytics[key] = [];
            analytics[key].push(data);
            
            // Keep only last 1000 entries per category
            if (analytics[key].length > 1000) {
                analytics[key] = analytics[key].slice(-1000);
            }
            
            this.saveLocalData('analytics', analytics);
        } catch (error) {
            console.warn('⚠️ Failed to save analytics data:', error);
        }
    }

    trackEvent(eventType, data) {
        const eventData = {
            type: eventType,
            timestamp: new Date().toISOString(),
            session_id: this.getCurrentSessionId(),
            page: this.getCurrentPage(),
            user_agent: navigator.userAgent,
            screen_size: `${window.screen.width}x${window.screen.height}`,
            referrer: document.referrer,
            data: data
        };
        
        this.saveAnalyticsData('events', eventData);
        
        // Send to analytics webhook in real-time
        this.sendAnalyticsToWebhook(eventData);
        
        if (this.config.debug) {
            console.log('📊 Event tracked:', eventData);
        }
    }

    /**
     * Send analytics data to webhook
     */
    async sendAnalyticsToWebhook(eventData) {
        if (!this.config.analyticsWebhookUrl) return;
        
        try {
            await fetch(this.config.analyticsWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_type: eventData.type,
                    session_id: eventData.session_id,
                    page: eventData.page,
                    user_agent: eventData.user_agent,
                    screen_size: eventData.screen_size,
                    referrer: eventData.referrer,
                    event_data: eventData.data,
                    timestamp: eventData.timestamp
                }),
                mode: 'cors'
            });
            
            if (this.config.debug) console.log('📊 Analytics sent to webhook');
        } catch (error) {
            if (this.config.debug) console.warn('⚠️ Analytics webhook failed', error);
        }
    }

    /**
     * Configuration and status methods
     */
    configure(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (this.config.debug) {
            console.log('⚙️ Configuration updated:', this.config);
        }
    }

    setDebugMode(enabled) {
        this.config.debug = enabled;
        console.log(`🔧 Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    getStatus() {
        return {
            initialized: !!this.currentSession,
            sessionActive: !!this.currentSession,
            analyticsEnabled: this.config.enableAnalytics,
            performanceMonitoring: this.config.enablePerformanceMonitoring,
            seoEnabled: this.config.enableSEOManagement,
            currentPage: this.getCurrentPage(),
            sessionId: this.getCurrentSessionId()
        };
    }

    logStatus() {
        console.log('📊 MRD Brain System Status:', this.getStatus());
    }

    /**
     * Data export methods
     */
    exportToCSV(dataType = 'all') {
        const data = this.getLocalData(dataType === 'all' ? 'analytics' : dataType);
        if (!data) return null;
        
        return this.convertToCSV(data);
    }

    convertToCSV(data) {
        if (Array.isArray(data)) {
            if (data.length === 0) return '';
            
            const headers = Object.keys(data[0]);
            const csvContent = [
                headers.join(','),
                ...data.map(row => headers.map(header => JSON.stringify(row[header] || '')).join(','))
            ].join('\n');
            
            return csvContent;
        }
        
        return '';
    }

    downloadCSV(data, filename = 'mrd_data.csv') {
        const csv = this.convertToCSV(data);
        if (!csv) return;
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    /**
     * Cleanup methods
     */
    clearAllData() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.config.localStoragePrefix)) {
                    localStorage.removeItem(key);
                }
            });
            
            if (this.config.debug) {
                console.log('🧹 All MRD Brain data cleared');
            }
        } catch (error) {
            console.error('❌ Failed to clear data:', error);
        }
    }

    destroy() {
        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
        }
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        this.endSession();
        
        if (this.config.debug) {
            console.log('💀 MRD Brain System destroyed');
        }
    }
}

// Initialize globally
window.MRDBrain = new MRDBrainSystem();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MRDBrainSystem;
}
