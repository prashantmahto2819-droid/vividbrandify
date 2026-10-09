(function () {
// Content schema: drives both server-side validation and the admin panel forms.
// Field tuple: [key, type, label, options?]  options = { choices, hint, max }
// Types: text, textarea, tall (long article), code, select, check, number, date, color, image, lines

const ICONS = ['chat', 'voice', 'software', 'video', 'growth', 'web', 'crm', 'app', 'bot', 'star'];

const SCHEMA = {
  // ---------- page content (lists) ----------
  slides: {
    kind: 'list', group: 'Content', label: 'Hero slider', noun: 'slide', titleField: 'title',
    help: 'Slides rotate at the top of the home page. Use the arrows to change their order.',
    fields: [
      ['active', 'check', 'Show this slide', { hint: 'Untick to hide without deleting' }],
      ['eyebrow', 'text', 'Small label'],
      ['title', 'text', 'Headline'],
      ['text', 'textarea', 'Supporting text'],
      ['cta', 'text', 'Main button label', { hint: 'Leave empty to hide the button' }],
      ['target', 'select', 'Main button goes to', { choices: ['contact', 'services', 'process', 'reviews', 'blog', 'whatsapp', 'custom link'] }],
      ['link', 'text', 'Custom link', { hint: 'Used when "custom link" is chosen, e.g. https://… or /blog/…' }],
      ['cta2', 'text', 'Second button label', { hint: 'Optional outline button that goes to Services' }],
      ['visual', 'select', 'Visual', { choices: ['chat', 'voice', 'software', 'video', 'growth', 'website', 'crm', 'image'], hint: 'Pick "image" to show the uploaded image' }],
      ['image', 'image', 'Slide image'],
    ],
    blank: { active: true, eyebrow: 'New', title: 'New slide headline', text: '', cta: 'Contact us', target: 'contact', link: '', cta2: 'All services', visual: 'chat', image: '' },
  },
  services: {
    kind: 'list', group: 'Content', label: 'Services', noun: 'service', titleField: 'name',
    fields: [
      ['name', 'text', 'Service name'],
      ['tag', 'text', 'Short tag'],
      ['summary', 'textarea', 'Summary'],
      ['points', 'lines', 'Bullet points', { hint: 'One per line' }],
      ['icon', 'select', 'Icon', { choices: ICONS }],
      ['featured', 'check', 'Feature this service', { hint: 'Shows as a large dark card with a live visual' }],
      ['cta', 'text', 'Featured card button label'],
    ],
    blank: { name: 'New service', tag: '', summary: '', points: '', icon: 'star', featured: false, cta: 'Book a demo' },
  },
  steps: {
    kind: 'list', group: 'Content', label: 'Process', noun: 'step', titleField: 'title',
    fields: [
      ['stage', 'text', 'Stage label'],
      ['title', 'text', 'Title'],
      ['text', 'textarea', 'Description'],
    ],
    blank: { stage: 'Stage', title: 'New step', text: '' },
  },
  testimonials: {
    kind: 'list', group: 'Content', label: 'Reviews', noun: 'review', titleField: 'name',
    fields: [
      ['quote', 'textarea', 'Review text'],
      ['name', 'text', 'Client name'],
      ['role', 'text', 'Business and city'],
      ['photo', 'image', 'Client photo or logo'],
      ['rating', 'select', 'Star rating', { choices: ['', '5', '4', '3'] }],
      ['sample', 'check', 'Mark as sample', { hint: 'Shows a "Sample" label. Untick once this is a real review' }],
    ],
    blank: { quote: '', name: 'Client name', role: '', photo: '', rating: '5', sample: false },
  },
  posts: {
    kind: 'list', group: 'Content', label: 'Blog posts', noun: 'post', titleField: 'title',
    fields: [
      ['published', 'check', 'Published', { hint: 'Untick to keep as a draft' }],
      ['title', 'text', 'Title'],
      ['slug', 'text', 'URL slug', { hint: 'Leave empty to create from the title. Page address: /blog/your-slug' }],
      ['category', 'text', 'Category'],
      ['date', 'date', 'Publish date'],
      ['readTime', 'text', 'Read time'],
      ['author', 'text', 'Author'],
      ['excerpt', 'textarea', 'Excerpt', { hint: 'Also used as the Google description' }],
      ['body', 'tall', 'Article', { hint: 'Blank line between paragraphs. ## Heading, - bullet, **bold**, [link text](https://…)' }],
      ['cover', 'image', 'Cover image'],
      ['visual', 'select', 'Cover icon (when no image)', { choices: ICONS }],
    ],
    blank: { published: true, title: 'New post', slug: '', category: 'Guides', date: '', readTime: '3 min', author: '', excerpt: '', body: '', cover: '', visual: 'star' },
  },
  offers: {
    kind: 'list', group: 'Content', label: 'Festival offers', noun: 'offer', titleField: 'title',
    help: 'Each offer gets its own page at /offer/your-slug with an enquiry form, call and WhatsApp buttons. It shows on the home page automatically between its start and end dates.',
    fields: [
      ['published', 'check', 'Published', { hint: 'Untick to keep as a draft' }],
      ['title', 'text', 'Offer name', { hint: 'e.g. Diwali Business Booster' }],
      ['slug', 'text', 'URL slug', { hint: 'Leave empty to create from the name. Page address: /offer/your-slug' }],
      ['festival', 'select', 'Festival theme', { choices: ['diwali', 'holi', 'navratri', 'eid', 'christmas', 'new-year', 'independence-day', 'general'] }],
      ['badge', 'text', 'Small label', { hint: 'e.g. Diwali special' }],
      ['headline', 'text', 'Headline'],
      ['subtitle', 'textarea', 'Short description', { hint: 'Also used for Google and WhatsApp link previews' }],
      ['discount', 'text', 'Offer highlight', { hint: 'e.g. Flat 30% off, or Free logo design' }],
      ['priceNote', 'text', 'Price line', { hint: 'Optional, e.g. Websites from ₹9,999' }],
      ['startDate', 'date', 'Starts on', { hint: 'Empty = show from now' }],
      ['endDate', 'date', 'Ends on', { hint: 'Last day of the offer. A countdown shows on the page' }],
      ['points', 'lines', "What's included", { hint: 'One per line' }],
      ['details', 'tall', 'Details and terms', { hint: 'Blank line between paragraphs. ## Heading, - bullet' }],
      ['image', 'image', 'Offer image or poster'],
      ['ctaLabel', 'text', 'Enquiry button label'],
      ['formHeading', 'text', 'Form heading'],
      ['showOnHome', 'check', 'Show on the home page', { hint: 'Adds the offer to the home page and the bar at the top while it is running' }],
      ['barText', 'text', 'Top bar text', { hint: 'Optional. Short line for the bar at the top of the site' }],
    ],
    blank: { published: false, title: 'New festival offer', slug: '', festival: 'diwali', badge: 'Festival special', headline: 'Your offer headline', subtitle: '', discount: '', priceNote: '', startDate: '', endDate: '', points: '', details: '', image: '', ctaLabel: 'Claim this offer', formHeading: 'Get this offer', showOnHome: true, barText: '' },
  },
  faqs: {
    kind: 'list', group: 'Content', label: 'FAQ', noun: 'question', titleField: 'q',
    fields: [['q', 'text', 'Question'], ['a', 'textarea', 'Answer']],
    blank: { q: 'New question', a: '' },
  },
  sections: {
    kind: 'list', group: 'Layout', label: 'Sections & menu', noun: 'section', titleField: 'label', fixed: true,
    help: 'Reorder the home page sections, hide any of them, and set their menu labels and headings.',
    fields: [
      ['visible', 'check', 'Show on the home page'],
      ['inNav', 'check', 'Show in the top menu'],
      ['label', 'text', 'Menu label'],
      ['eyebrow', 'text', 'Small label above the heading'],
      ['heading', 'text', 'Heading'],
      ['intro', 'textarea', 'Intro text'],
    ],
    blank: {},
  },

  // ---------- single-object settings ----------
  settings: {
    kind: 'object', group: 'Site', label: 'Brand & contact',
    fields: [
      ['brand', 'text', 'Brand name'],
      ['logoSub', 'text', 'Tagline under the logo', { hint: 'Shown in the footer with the logo, e.g. Brand loud. Stand proud.' }],
      ['logo', 'image', 'Logo image', { hint: 'Optional. Replaces the tick mark next to the name' }],
      ['favicon', 'image', 'Browser tab icon', { hint: 'Square PNG, 64×64 or larger' }],
      ['tagline', 'text', 'Tagline'],
      ['whatsapp', 'text', 'WhatsApp number', { hint: 'Country code + number, digits only, e.g. 919876543210' }],
      ['phone', 'text', 'Phone'],
      ['email', 'text', 'Email'],
      ['address', 'textarea', 'Address'],
      ['hours', 'text', 'Working hours'],
      ['heroNote', 'text', 'Note under the slider'],
      ['stats', 'lines', 'Numbers strip', { hint: 'One per line: value|label' }],
      ['navCta', 'text', 'Menu button label'],
      ['businessTypes', 'lines', 'Business categories in the enquiry form', { hint: 'One per line. Visitors pick one so you know what kind of business each lead runs' }],
      ['contactButton', 'text', 'Contact form button label'],
      ['contactSuccess', 'textarea', 'Message after the form is sent'],
      ['footer', 'textarea', 'Footer text'],
      ['social', 'lines', 'Social links', { hint: 'One per line: Name|https://…  e.g. Instagram|https://instagram.com/yourpage' }],
    ],
  },
  theme: {
    kind: 'object', group: 'Site', label: 'Colours',
    fields: [
      ['accent', 'color', 'Accent colour', { hint: 'Buttons and highlights' }],
      ['hero', 'color', 'Brand dark colour', { hint: 'Header, slider and featured cards' }],
      ['tick', 'color', 'Tick / link colour'],
    ],
  },
  seo: {
    kind: 'object', group: 'Site', label: 'SEO & sharing',
    fields: [
      ['title', 'text', 'Home page title', { hint: 'Shown in Google and the browser tab. Aim for under 60 characters' }],
      ['description', 'textarea', 'Home page description', { hint: 'Aim for 140–160 characters' }],
      ['ogImage', 'image', 'Share image', { hint: '1200×630 image shown when the link is shared on WhatsApp, Facebook, LinkedIn' }],
      ['siteUrl', 'text', 'Site address', { hint: 'e.g. https://vividbrandify.com (used for the sitemap and share links)' }],
      ['noindex', 'check', 'Hide the site from search engines', { hint: 'Tick while the site is still being set up' }],
    ],
  },
  widget: {
    kind: 'object', group: 'WhatsApp', label: 'WhatsApp chat widget',
    help: 'Choose the built-in chat bubble, or paste the widget code from your WhatsApp software or provider.',
    fields: [
      ['mode', 'select', 'Widget', { choices: ['built-in', 'custom code', 'off'] }],
      ['customCode', 'code', 'Custom widget code', { hint: 'Paste the full <script> snippet from your provider. Used only when "custom code" is selected. It is added to every page just before </body>' }],
      ['position', 'select', 'Position', { choices: ['right', 'left'] }],
      ['color', 'color', 'Button colour'],
      ['buttonLabel', 'text', 'Button label', { hint: 'Leave empty for an icon-only round button' }],
      ['agentName', 'text', 'Name in the chat header'],
      ['agentPhoto', 'image', 'Photo in the chat header'],
      ['status', 'text', 'Status line', { hint: 'e.g. Typically replies within minutes' }],
      ['greeting', 'textarea', 'Greeting message', { hint: 'Shown as the first chat bubble. Blank line = new bubble' }],
      ['agents', 'lines', 'Departments', { hint: 'Optional. One per line: Label|WhatsApp number|Pre-filled message. Leave empty to use the site number' }],
      ['prefill', 'text', 'Pre-filled message', { hint: 'Text placed in the visitor\'s WhatsApp when they start the chat' }],
      ['delay', 'number', 'Show the bubble after (seconds)'],
      ['autoOpen', 'number', 'Open the chat automatically after (seconds)', { hint: '0 = never. Opens once per visit' }],
      ['showMobile', 'check', 'Show on phones'],
      ['showDesktop', 'check', 'Show on computers'],
    ],
  },
  code: {
    kind: 'object', group: 'Advanced', label: 'Custom code',
    help: 'For Google Analytics, Meta Pixel, Search Console verification and similar snippets.',
    fields: [
      ['head', 'code', 'Code inside <head>'],
      ['bodyEnd', 'code', 'Code before </body>'],
      ['css', 'code', 'Extra CSS', { hint: 'Plain CSS, without <style> tags' }],
    ],
  },
};

const SECTION_IDS = ['stats', 'services', 'process', 'reviews', 'blog', 'faq', 'contact'];
const IMAGE_RE = /^(\/uploads\/[A-Za-z0-9._-]+|\/assets\/[A-Za-z0-9._\/-]+|https:\/\/[^\s"'<>]+)$/;

function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 80) || 'post';
}
function newId(prefix) { return (prefix || 'i') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function coerce(type, v, opts) {
  switch (type) {
    case 'check': return v === true || v === 'true' || v === 1;
    case 'number': { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(n, 3600)) : 0; }
    case 'color': return /^#[0-9a-fA-F]{6}$/.test(v || '') ? v : '';
    case 'image': return IMAGE_RE.test(v || '') ? v : '';
    case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '';
    case 'select': { const c = (opts && opts.choices) || []; return c.includes(v) ? v : c[0] || ''; }
    case 'code': return String(v == null ? '' : v).slice(0, 50000);
    case 'tall': return String(v == null ? '' : v).slice(0, 100000);
    default: return String(v == null ? '' : v).slice(0, 5000);
  }
}
function cleanObject(fields, input) {
  const out = {};
  for (const [k, type, , opts] of fields) out[k] = coerce(type, input ? input[k] : undefined, opts);
  return out;
}

/** Validate a value for a content key. Returns the cleaned value or throws. */
function sanitize(key, value, previous) {
  const sc = SCHEMA[key];
  if (!sc) throw new Error('Unknown section: ' + key);
  if (sc.kind === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object');
    return cleanObject(sc.fields, value);
  }
  if (!Array.isArray(value)) throw new Error('Expected a list');
  if (value.length > 300) throw new Error('Too many items (300 max)');
  let items = value.map(it => {
    const o = cleanObject(sc.fields, it || {});
    o.id = typeof it.id === 'string' && /^[\w-]{1,40}$/.test(it.id) ? it.id : newId(key[0]);
    return o;
  });
  if (key === 'sections') {
    // fixed set: keep only known ids, add any missing ones back from previous
    const byId = new Map(items.filter(i => SECTION_IDS.includes(i.id)).map(i => [i.id, i]));
    for (const p of previous || []) if (!byId.has(p.id)) byId.set(p.id, p);
    items = [...byId.values()];
  }
  if (key === 'posts' || key === 'offers') {
    const seen = new Set();
    for (const p of items) {
      let s = slugify(p.slug || p.title), base = s, n = 2;
      while (seen.has(s)) s = base + '-' + n++;
      seen.add(s); p.slug = s;
      if (key === 'posts' && !p.date) p.date = new Date().toISOString().slice(0, 10);
    }
  }
  return items;
}

window.VBSchema = { SCHEMA, SECTION_IDS, sanitize, slugify, newId };

})();
