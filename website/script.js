/* ============================================================
   MaliPen Landing Page — script.js
   Handles: reveal animations, navbar scroll, tab switching,
            TR/EN language switcher (i18n)
   ============================================================ */

'use strict';

// ============================================================
// NAVBAR SCROLL STATE
// ============================================================
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > 30) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}, { passive: true });

// ============================================================
// INTERSECTION OBSERVER — REVEAL
// ============================================================
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.12,
  rootMargin: '0px 0px -40px 0px'
});

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ============================================================
// USE CASE TABS
// ============================================================
function switchTab(id, btn) {
  document.querySelectorAll('.use-case-scene').forEach(scene => {
    scene.classList.remove('active');
  });
  document.querySelectorAll('.use-tab').forEach(t => t.classList.remove('active'));
  const target = document.getElementById('tab-' + id);
  if (target) target.classList.add('active');
  if (btn) btn.classList.add('active');
}

// ============================================================
// BOARD PATTERN BUTTONS
// ============================================================
function setPattern(type, btn) {
  document.querySelectorAll('.pattern-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  updateBoardPatterns(type);
}

function updateBoardPatterns(type) {
  const wbHalf = document.querySelector('.board-half.whiteboard .board-pattern svg');
  const bbHalf = document.querySelector('.board-half.blackboard .board-pattern svg');
  if (!wbHalf || !bbHalf) return;

  const patterns = {
    grid: {
      wb: `<defs><pattern id="wb-grid" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <line x1="30" y1="0" x2="30" y2="30" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>
              <line x1="0" y1="30" x2="30" y2="30" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>
           </pattern></defs><rect width="300" height="280" fill="url(#wb-grid)"/>`,
      bb: `<defs><pattern id="bb-grid" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <line x1="30" y1="0" x2="30" y2="30" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
              <line x1="0" y1="30" x2="30" y2="30" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
           </pattern></defs><rect width="300" height="280" fill="url(#bb-grid)"/>`
    },
    dots: {
      wb: `<defs><pattern id="wb-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="1.2" fill="rgba(0,0,0,0.12)"/>
           </pattern></defs><rect width="300" height="280" fill="url(#wb-dots)"/>`,
      bb: `<defs><pattern id="bb-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="1.2" fill="rgba(255,255,255,0.12)"/>
           </pattern></defs><rect width="300" height="280" fill="url(#bb-dots)"/>`
    },
    lines: {
      wb: `<defs><pattern id="wb-lines" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <line x1="0" y1="30" x2="30" y2="30" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>
           </pattern></defs><rect width="300" height="280" fill="url(#wb-lines)"/>`,
      bb: `<defs><pattern id="bb-lines" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <line x1="0" y1="30" x2="30" y2="30" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
           </pattern></defs><rect width="300" height="280" fill="url(#bb-lines)"/>`
    }
  };

  const current = patterns[type];
  if (!current) return;

  const wbDrawings = wbHalf.querySelector('.board-drawings');
  const bbDrawings = bbHalf.querySelector('.board-drawings');
  wbHalf.innerHTML = current.wb;
  bbHalf.innerHTML = current.bb;
  if (wbDrawings) wbHalf.appendChild(wbDrawings);
  if (bbDrawings) bbHalf.appendChild(bbDrawings);
}

// ============================================================
// SMOOTH SCROLL FOR NAV LINKS
// ============================================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      const offsetTop = target.getBoundingClientRect().top + window.pageYOffset - 72;
      window.scrollTo({ top: offsetTop, behavior: 'smooth' });
    }
  });
});

// ============================================================
// DYNAMIC GITHUB RELEASE DOWNLOAD LINKS (Direct Downloads)
// ============================================================
async function initDownloadLinks() {
  try {
    const res = await fetch('https://api.github.com/repos/maliyildirimtr/MaliPen/releases/latest');
    if (!res.ok) return;
    const release = await res.json();
    const assets = release.assets || [];
    
    // Find dmg and exe assets
    const dmgAsset = assets.find(a => a.name.endsWith('.dmg') || a.name.endsWith('.pkg'));
    const exeAsset = assets.find(a => a.name.endsWith('.exe') || a.name.endsWith('.msi'));
    
    if (dmgAsset) {
      document.querySelectorAll('.download-mac').forEach(el => {
        el.href = dmgAsset.browser_download_url;
      });
    }
    if (exeAsset) {
      document.querySelectorAll('.download-win').forEach(el => {
        el.href = exeAsset.browser_download_url;
      });
    }
  } catch (err) {
    console.debug('Using fallback static release URLs:', err);
  }
}

// ============================================================
// FAQ ACCORDION TOGGLE
// ============================================================
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      faqItems.forEach(other => {
        other.classList.remove('active');
        const otherBtn = other.querySelector('.faq-question');
        if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
      });
      if (!isActive) {
        item.classList.add('active');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

// ============================================================
// INIT ON LOAD
// ============================================================
window.addEventListener('load', () => {
  // Hero elements visible immediately
  document.querySelectorAll('.hero .reveal').forEach(el => {
    el.classList.add('visible');
  });

  // Fetch real download links from GitHub
  initDownloadLinks();

  // Initialize FAQ accordion
  initFaqAccordion();
});
