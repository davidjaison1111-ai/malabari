/*
  MalabarRoots — PDP Description Parser
  Converts the long, unstructured product Body (HTML) into four clean,
  animated collapsible rows (matching the Taste theme's native accordion):
    1. The Story / Why You'll Love It
    2. What's Inside / Ingredients
    3. How to Use / Brewing Guide
    4. Storage & Freshness
  Gracefully degrades: if parsing finds nothing, the original description stays visible.
*/
(function () {
  'use strict';

  var SECTIONS = [
    {
      key: 'story',
      title: "The Story / Why You'll Love It",
      icon: '🌿',
      patterns: [/why you/i, /story/i, /love it/i, /taste\s*(&|and|&amp;)?\s*aroma/i, /flavou?r profile/i, /about (this|the)/i, /highlights?/i, /what makes/i]
    },
    {
      key: 'inside',
      title: "What's Inside / Ingredients",
      icon: '🧺',
      patterns: [/what'?s inside/i, /inside the (box|pack|jar)/i, /ingredients?/i, /contains?\b/i, /composition/i, /nutriti/i, /good to know/i]
    },
    {
      key: 'usage',
      title: 'How to Use / Brewing Guide',
      icon: '☕',
      patterns: [/how to (use|brew|apply|make|prepare|enjoy)/i, /best ways? to/i, /brewing/i, /usage/i, /directions?/i, /dosage/i, /serving/i, /recipes?/i, /ways to (use|enjoy)/i, /perfect for/i, /application/i]
    },
    {
      key: 'storage',
      title: 'Storage & Freshness',
      icon: '📦',
      patterns: [/storage/i, /store\b/i, /shelf[-\s]?life/i, /freshness/i, /pack size/i, /net weight/i, /keep (it|in|away|airtight)/i, /airtight/i, /best before/i]
    }
  ];

  function isHeadingNode(node) {
    if (!node || node.nodeType !== 1) return false;
    var tag = node.tagName;
    if (/^H[1-6]$/.test(tag)) return true;
    if (tag === 'P') {
      var strong = node.querySelector('strong, b');
      if (strong) {
        var full = (node.textContent || '').trim();
        var bold = (strong.textContent || '').trim();
        // A paragraph that is (almost) entirely bold acts as a heading
        if (bold.length > 0 && full.length <= bold.length + 3 && full.length < 90) return true;
      }
    }
    return false;
  }

  function matchSection(text) {
    for (var i = 0; i < SECTIONS.length; i++) {
      var s = SECTIONS[i];
      for (var j = 0; j < s.patterns.length; j++) {
        if (s.patterns[j].test(text)) return s.key;
      }
    }
    return null;
  }

  function buildAccordion(title, icon, nodes, open) {
    var details = document.createElement('details');
    details.className = 'mr-accordion';
    if (open) details.setAttribute('open', '');

    var summary = document.createElement('summary');
    summary.className = 'mr-accordion__summary';
    summary.innerHTML =
      '<span class="mr-accordion__title"><span class="mr-accordion__icon" aria-hidden="true">' +
      icon +
      '</span>' +
      title +
      '</span><span class="mr-accordion__caret" aria-hidden="true"></span>';

    var content = document.createElement('div');
    content.className = 'mr-accordion__content rte';
    nodes.forEach(function (n) {
      content.appendChild(n);
    });

    details.appendChild(summary);
    details.appendChild(content);
    return details;
  }

  function init() {
    var source = document.querySelector('[data-mr-description-source]');
    var target = document.querySelector('[data-mr-description-target]');
    if (!source || !target || target.dataset.mrParsed) return;

    var nodes = Array.prototype.slice.call(source.childNodes).filter(function (n) {
      return n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim() !== '');
    });
    if (!nodes.length) return;

    var buckets = { story: [], inside: [], usage: [], storage: [] };
    var currentKey = 'story'; // intro paragraphs before any heading → Story

    nodes.forEach(function (node) {
      if (isHeadingNode(node)) {
        var matched = matchSection(node.textContent || '');
        if (matched) {
          currentKey = matched;
          // Skip re-printing the raw heading if it's just the section label;
          // keep it when it carries extra info (e.g. "Taste & aroma").
          var t = (node.textContent || '').trim();
          if (t.length > 34) buckets[currentKey].push(node.cloneNode(true));
          else if (!/^(what'?s inside|ingredients?|how to use|storage|storage\s*(&|&amp;|and)\s*freshness)$/i.test(t)) {
            buckets[currentKey].push(node.cloneNode(true));
          }
          return;
        }
      } else if (node.nodeType === 1 && node.tagName === 'P') {
        // Paragraphs led by a short bold label (e.g. "<strong>Pack size:</strong> 500g")
        // switch to the matching section but keep the whole paragraph.
        var lead = node.querySelector('strong, b');
        if (lead) {
          var leadText = (lead.textContent || '').trim();
          if (leadText.length > 0 && leadText.length < 30) {
            var leadMatch = matchSection(leadText);
            if (leadMatch) currentKey = leadMatch;
          }
        }
      }
      buckets[currentKey].push(node.cloneNode(true));
    });

    // Require at least 2 populated buckets to be worth converting
    var populated = SECTIONS.filter(function (s) {
      return buckets[s.key].length > 0;
    });
    if (populated.length < 2) return; // leave original description as-is

    var frag = document.createDocumentFragment();
    populated.forEach(function (s, idx) {
      frag.appendChild(buildAccordion(s.title, s.icon, buckets[s.key], idx === 0));
    });

    target.appendChild(frag);
    target.hidden = false;
    target.dataset.mrParsed = 'true';
    source.setAttribute('hidden', '');
    source.setAttribute('aria-hidden', 'true');

    // Smooth open/close animation
    target.querySelectorAll('.mr-accordion').forEach(function (det) {
      var content = det.querySelector('.mr-accordion__content');
      det.querySelector('summary').addEventListener('click', function (e) {
        if (det.hasAttribute('open')) {
          e.preventDefault();
          content.style.maxHeight = content.scrollHeight + 'px';
          requestAnimationFrame(function () {
            content.style.maxHeight = '0px';
            content.style.opacity = '0';
          });
          content.addEventListener(
            'transitionend',
            function handler() {
              det.removeAttribute('open');
              content.style.maxHeight = '';
              content.style.opacity = '';
              content.removeEventListener('transitionend', handler);
            },
            { once: true }
          );
        } else {
          requestAnimationFrame(function () {
            content.style.maxHeight = '0px';
            content.style.opacity = '0';
            requestAnimationFrame(function () {
              content.style.maxHeight = content.scrollHeight + 'px';
              content.style.opacity = '1';
              content.addEventListener(
                'transitionend',
                function handler() {
                  content.style.maxHeight = '';
                  content.removeEventListener('transitionend', handler);
                },
                { once: true }
              );
            });
          });
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
