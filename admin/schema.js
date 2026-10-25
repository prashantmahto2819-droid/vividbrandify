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
      ['visual', 'select', 'Visual', { choices: ['chat', 'voice', 'software', 'video', 'growth', 'website', 'crm', 'apps', 'image'], hint: 'Pick "image" to show the uploaded image, or "apps" for the four-app tiles. The site adds an "Our apps" slide by itself unless one slide uses "apps"' }],
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
  work: {
    kind: 'list', group: 'Content', label: 'Our work', noun: 'project', titleField: 'title',
    help: 'Case studies and portfolio. Real results build trust faster than any claim: add the client, what you did and the number that improved.',
    fields: [
      ['active', 'check', 'Show on the website'],
      ['title', 'text', 'Project name', { hint: 'e.g. Clinic appointment campaign' }],
      ['client', 'text', 'Client or business type', { hint: 'Use the name only with the client\'s permission, e.g. Dental clinic, Indore' }],
      ['service', 'text', 'What we did', { hint: 'e.g. WhatsApp campaign + landing page' }],
      ['result', 'text', 'Headline result', { hint: 'e.g. 3x enquiries in 60 days' }],
      ['summary', 'textarea', 'Short story', { hint: 'Problem, what we did, outcome. Two or three sentences' }],
      ['image', 'image', 'Screenshot or photo'],
      ['link', 'text', 'Link (optional)', { hint: 'Live website, video or full case study' }],
    ],
    blank: { active: true, title: 'New project', client: '', service: '', result: '', summary: '', image: '', link: '' },
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
  products: {
    kind: 'list', group: 'Store', label: 'Products & plans', noun: 'product', titleField: 'name',
    help: 'Apps and software you sell online. Each product gets its own page at /product/your-slug where customers pick a plan and pay with Razorpay (UPI, cards, netbanking). Switch on payments under Store → Payments & email.',
    fields: [
      ['published', 'check', 'Published', { hint: 'Untick to keep as a draft' }],
      ['name', 'text', 'Product name', { hint: 'e.g. WhatsApp Marketing Software' }],
      ['slug', 'text', 'URL slug', { hint: 'Leave empty to create from the name. Page address: /product/your-slug' }],
      ['category', 'text', 'Category', { hint: 'Small label, e.g. WhatsApp software, CRM, Website package' }],
      ['tagline', 'text', 'One-line pitch', { hint: 'Also used for Google and WhatsApp link previews' }],
      ['summary', 'textarea', 'Short description'],
      ['features', 'lines', 'Features', { hint: 'One per line' }],
      ['plans', 'lines', 'Plans and prices', { hint: 'One plan per line: Plan name | price | monthly, yearly or one-time | setup fee | note.  e.g.  Starter | 999 | monthly | 2999 | 1 user, 5,000 messages.  Prices in rupees. Setup fee and note are optional' }],
      ['badge', 'text', 'Badge', { hint: 'Optional, e.g. Most popular' }],
      ['icon', 'select', 'Icon (when there is no image)', { choices: ICONS }],
      ['image', 'image', 'Product image or screenshot'],
      ['details', 'tall', 'More details', { hint: 'Optional. Blank line between paragraphs. ## Heading, - bullet' }],
      ['buyLabel', 'text', 'Buy button label', { hint: 'Default: Buy now' }],
      ['demo', 'check', 'Show a "Book a free demo" button'],
    ],
    blank: { published: false, plans: '', icon: 'software', demo: true },
  },
  apps: {
    kind: 'list', group: 'Store', label: 'Our apps', noun: 'app', titleField: 'name',
    help: 'Your own products: Vividora, BizCRT, Vivid Relay, Drishti and any you add. Each app shows in the "Our apps" tabs on the home page, gets a page at /apps/your-slug, a link in the footer, and its own section on the Terms, Privacy, Refund and Delivery pages (Razorpay checks these). To take payment online, create a product under Store → Products & plans and put its slug in "Store product".',
    fields: [
      ['published', 'check', 'Published', { hint: 'Untick to hide the app everywhere, including the legal pages' }],
      ['showOnHome', 'check', 'Show in the "Our apps" tabs on the home page'],
      ['showInSlider', 'check', 'Add its own slide to the hero slider'],
      ['name', 'text', 'App name'],
      ['slug', 'text', 'URL slug', { hint: 'Page address: /apps/your-slug' }],
      ['category', 'text', 'Category', { hint: 'Short label, e.g. AI video studio' }],
      ['status', 'select', 'Status', { choices: ['Live', 'Early access', 'Coming soon'] }],
      ['mark', 'text', 'Two-letter mark', { hint: 'Shown in the coloured square when there is no logo, e.g. Vd', max: 3 }],
      ['color', 'color', 'App colour'],
      ['logo', 'image', 'App logo', { hint: 'Optional. Square PNG' }],
      ['screenshot', 'image', 'Screenshot', { hint: 'Optional. Replaces the drawn preview on the app page' }],
      ['visual', 'select', 'Drawn preview', { choices: ['vividora', 'bizcrt', 'relay', 'drishti', 'software'] }],
      ['tagline', 'text', 'One-line pitch', { hint: 'The headline on the app page and in the tabs' }],
      ['summary', 'textarea', 'What it is'],
      ['features', 'lines', 'Features', { hint: 'One per line. The first four show on the home page' }],
      ['whoFor', 'lines', 'Made for', { hint: 'One business type per line' }],
      ['plans', 'lines', 'Plans and prices', { hint: 'One plan per line: Plan name | price | period | note | popular.  e.g.  Growth | 1299 | per 30 days | 3 numbers | popular.  Use 0 for free, or words like "On request"' }],
      ['priceNote', 'textarea', 'Note under the prices'],
      ['product', 'text', 'Store product', { hint: 'Optional. Slug of a product under Store → Products & plans; its plans then get a Buy button with Razorpay checkout' }],
      ['ctaLabel', 'text', 'Main button label'],
      ['ctaUrl', 'text', 'Main button link', { hint: 'Optional. The app\'s own sign-up page, e.g. https://relay.vividbrandify.com. Empty: the button opens the enquiry form' }],
      ['page', 'text', 'Use another page instead', { hint: 'Optional, e.g. /bizcrt. Links to this app then go there' }],
      ['url', 'text', 'App website'],
      ['faqs', 'lines', 'FAQ', { hint: 'One per line: Question|Answer' }],
      ['slideTitle', 'text', 'Slide headline'],
      ['slideText', 'textarea', 'Slide text'],
      ['policyUrl', 'text', 'Full policies link', { hint: 'Optional. If the app has its own policy pages' }],
      ['legalTerms', 'tall', 'Terms for this app', { hint: 'Shown under "Our software products" on /legal/terms. Blank line between paragraphs' }],
      ['legalPrivacy', 'tall', 'Privacy for this app', { hint: 'What the app collects, where it is stored and who controls it. Shown on /legal/privacy' }],
      ['legalRefunds', 'tall', 'Refunds for this app', { hint: 'Shown on /legal/refunds' }],
      ['legalDelivery', 'tall', 'Delivery for this app', { hint: 'How and when it is activated or installed. Shown on /legal/delivery' }],
    ],
    blank: { published: false, showOnHome: true, showInSlider: false, status: 'Live', color: '#F7941D', visual: 'software', plans: '' },
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
  bizcrt: {
    kind: 'object', group: 'Store', label: 'BizCRT page',
    help: 'Your BizCRT product page at /bizcrt and its spotlight on the home page. Plans, module prices and add-ons come live from BizCRT, so they update when you change them there.',
    fields: [
      ['published', 'check', 'Show the BizCRT page'],
      ['showOnHome', 'check', 'Show the BizCRT spotlight on the home page'],
      ['livePricing', 'check', 'Show live plans and prices from BizCRT'],
      ['name', 'text', 'Product name'],
      ['logo', 'image', 'Product logo', { hint: 'Optional. Square or wide PNG' }],
      ['screenshot', 'image', 'App screenshot', { hint: 'Optional. Replaces the drawn app preview at the top of the page' }],
      ['tagline', 'text', 'Tagline'],
      ['headline', 'text', 'Headline'],
      ['intro', 'textarea', 'Intro paragraph', { hint: 'Also used for Google and WhatsApp link previews' }],
      ['ctaLabel', 'text', 'Main button label'],
      ['ctaUrl', 'text', 'Main button link', { hint: 'Sign-up or trial page on bizcrt.com' }],
      ['loginLabel', 'text', 'Log-in link label'],
      ['loginUrl', 'text', 'Log-in link'],
      ['demoLabel', 'text', 'Demo button label'],
      ['trialNote', 'text', 'Line under the buttons'],
      ['highlights', 'lines', 'Why BizCRT', { hint: 'One per line: Title|short text' }],
      ['whoFor', 'lines', 'Made for', { hint: 'One business type per line' }],
      ['steps', 'lines', 'How it works', { hint: 'One per line: Step|short text' }],
      ['bundleNote', 'textarea', 'Module pricing note'],
      ['priceNote', 'text', 'Note under prices'],
      ['resellerText', 'textarea', 'Reseller / white-label programme'],
      ['affiliateText', 'textarea', 'Affiliate programme'],
      ['faqs', 'lines', 'FAQ', { hint: 'One per line: Question|Answer' }],
      ['homeHeading', 'text', 'Home page spotlight heading'],
      ['homeText', 'textarea', 'Home page spotlight text'],
    ],
  },
  legal: {
    kind: 'object', group: 'Site', label: 'Legal & GST',
    help: 'Your business details from the GST certificate and the policy pages at /legal/terms, /legal/privacy, /legal/refunds, /legal/delivery and /legal/business. They are linked in the footer and at checkout; Razorpay asks for these pages. Have your CA or lawyer read the policies once.',
    fields: [
      ['published', 'check', 'Show the legal pages and the business line in the footer'],
      ['updated', 'date', 'Policies last updated'],
      ['tradeName', 'text', 'Trade name', { hint: 'As on the GST certificate, e.g. Vivid Brandify' }],
      ['legalName', 'text', 'Legal name', { hint: 'The proprietor or company name on the GST certificate' }],
      ['constitution', 'text', 'Type of business', { hint: 'e.g. Sole proprietorship' }],
      ['gstin', 'text', 'GSTIN'],
      ['gstSince', 'text', 'GST registered since'],
      ['gstType', 'text', 'Registration type', { hint: 'e.g. Regular' }],
      ['address', 'textarea', 'Registered address'],
      ['jurisdiction', 'text', 'Courts for disputes', { hint: 'City and state, e.g. Korba, Chhattisgarh' }],
      ['grievanceName', 'text', 'Grievance officer'],
      ['grievanceEmail', 'text', 'Grievance officer email'],
      ['grievancePhone', 'text', 'Grievance officer phone'],
      ['certificate', 'text', 'GST certificate link', { hint: 'Optional. Link to the certificate PDF; leave empty to hide the link' }],
      ['terms', 'tall', 'Terms and conditions', { hint: 'Blank line between paragraphs. ## Heading, - bullet, **bold**, [link text](/legal/privacy)' }],
      ['privacy', 'tall', 'Privacy policy'],
      ['refunds', 'tall', 'Refund and cancellation policy'],
      ['delivery', 'tall', 'Delivery policy'],
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

const SECTION_IDS = ['stats', 'services', 'apps', 'bizcrt', 'store', 'work', 'process', 'reviews', 'blog', 'faq', 'contact'];
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
  if (key === 'posts' || key === 'offers' || key === 'products' || key === 'apps') {
    const seen = new Set();
    for (const p of items) {
      let s = slugify(p.slug || p.title || p.name), base = s, n = 2;
      while (seen.has(s)) s = base + '-' + n++;
      seen.add(s); p.slug = s;
      if (key === 'posts' && !p.date) p.date = new Date().toISOString().slice(0, 10);
    }
  }
  return items;
}

window.VBSchema = { SCHEMA, SECTION_IDS, sanitize, slugify, newId };

})();
