// 強化された要素収集機能 - すべての要素を確実に取得

import { TEST_DATA } from './ai-test-prompts.js';

export class EnhancedElementCollector {
  
  /**
   * ページ上のすべての要素を包括的に収集（改善版）
   */
  async collectAllElements(page) {
    // スクロール可能な全領域を取得
    await this.scrollToLoadAllContent(page);
    
    // 動的コンテンツの読み込みを待機
    await this.waitForDynamicContent(page);
    
    // メイン要素収集
    const elements = await page.evaluate(() => {
      const collectedElements = {
        links: [],
        buttons: [],
        inputs: [],
        textareas: [],
        selects: [],
        checkboxes: [],
        radios: [],
        images: [],
        icons: [],
        labels: [],
        headings: [],
        tables: [],
        footerLinks: [],
        navigationItems: [],
        forms: [],
        tabs: [],
        accordions: [],
        dropdowns: [],
        modals: [],
        tooltips: [],
        breadcrumbs: [],
        pagination: [],
        sliders: [],
        toggles: [],
        datepickers: [],
        fileInputs: [],
        colorPickers: [],
        rangeInputs: [],
        contentEditables: [],
        videos: [],
        audios: [],
        canvases: [],
        svgElements: [],
        iframes: [],
        webComponents: [],
        shadowRoots: []
      };

      /**
       * 要素の可視性を詳細にチェック（改善版）
       */
      function isElementInteractable(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        // 基本的な可視性チェック
        if (rect.width === 0 && rect.height === 0) {
          // 例外: position:absoluteで意図的に隠されているが、JavaScriptで表示される要素
          if (style.position === 'absolute' || style.position === 'fixed') {
            // クリックイベントがある場合は対話可能と判定
            if (element.onclick || element.getAttribute('onclick') || 
                element.hasAttribute('data-toggle') || element.hasAttribute('data-bs-toggle')) {
              return true;
            }
          }
          return false;
        }
        
        // opacity が 0 でもtransitionで表示される可能性がある
        if (style.opacity === '0') {
          // hover や focus で表示される要素をチェック
          if (style.transition || style.animation || 
              element.matches(':hover') || element.matches(':focus')) {
            return true;
          }
          return false;
        }
        
        // visibility: hidden でも子要素は visible の可能性
        if (style.visibility === 'hidden') {
          const hasVisibleChild = element.querySelector('[style*="visibility: visible"]');
          if (hasVisibleChild) return true;
          return false;
        }
        
        // display: none は基本的に非表示だが、動的に表示される可能性をチェック
        if (style.display === 'none') {
          // クラスやdata属性で制御されている可能性
          const classes = element.className.toLowerCase();
          const isToggleable = classes.includes('dropdown') || classes.includes('collapse') ||
                              classes.includes('modal') || classes.includes('popup') ||
                              classes.includes('menu') || classes.includes('submenu') ||
                              element.hasAttribute('data-toggle') || 
                              element.hasAttribute('data-bs-toggle') ||
                              element.hasAttribute('aria-expanded') ||
                              element.hasAttribute('aria-controls');
          if (isToggleable) return true;
          return false;
        }
        
        // スクロール領域外でもスクロール可能な要素は取得
        const isScrollable = element.scrollHeight > element.clientHeight || 
                           element.scrollWidth > element.clientWidth;
        
        // z-indexが低くても、実際には操作可能な場合がある
        const zIndex = parseInt(style.zIndex) || 0;
        if (zIndex < 0) {
          // 負のz-indexでもクリック可能な要素をチェック
          const isClickable = element.tagName === 'A' || element.tagName === 'BUTTON' ||
                             element.type === 'submit' || element.type === 'button';
          if (!isClickable) return false;
        }
        
        return true;
      }

      /**
       * 要素の詳細情報を収集（拡張版）
       */
        function collectDetailedElementInfo(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        // アクセシブルな名前を取得
        function getAccessibleName(elem) {
          // aria-labelledby
          if (elem.getAttribute('aria-labelledby')) {
            const labelIds = elem.getAttribute('aria-labelledby').split(' ');
            const labels = labelIds.map(id => {
              const label = document.getElementById(id);
              return label ? label.textContent.trim() : '';
            }).filter(text => text);
            if (labels.length > 0) return labels.join(' ');
          }
          
          // aria-label
          if (elem.getAttribute('aria-label')) {
            return elem.getAttribute('aria-label');
          }
          
          // label要素
          if (elem.id) {
            const label = document.querySelector(`label[for="${elem.id}"]`);
            if (label) return label.textContent.trim();
          }
          
          // 親label
          const parentLabel = elem.closest('label');
          if (parentLabel) {
            const text = Array.from(parentLabel.childNodes)
              .filter(node => node.nodeType === Node.TEXT_NODE)
              .map(node => node.textContent.trim())
              .join(' ');
            if (text) return text;
          }
          
          // title属性
          if (elem.title) return elem.title;
          
          // placeholder
          if (elem.placeholder) return elem.placeholder;
          
          // ボタンやリンクのテキスト
          if (elem.tagName === 'BUTTON' || elem.tagName === 'A') {
            const text = elem.textContent.trim();
            if (text) return text;
          }
          
          // value属性（ボタンの場合）
          if (elem.type === 'submit' || elem.type === 'button' || elem.type === 'reset') {
            if (elem.value) return elem.value;
          }
          
          // alt属性（画像の場合）
          if (elem.tagName === 'IMG' && elem.alt) {
            return elem.alt;
          }
          
          return '';
        }

        // イベントリスナーの検出
        function getEventListeners(elem) {
          const events = [];
          const eventTypes = ['click', 'change', 'submit', 'focus', 'blur', 'input', 
                            'keydown', 'keyup', 'mouseenter', 'mouseleave', 'touchstart'];
          
          eventTypes.forEach(type => {
            // インラインイベント
            if (elem[`on${type}`]) {
              events.push(type);
            }
            // data属性によるイベント
            if (elem.hasAttribute(`data-${type}`)) {
              events.push(type);
            }
          });
          
          // 特殊なdata属性
          if (elem.hasAttribute('data-toggle') || elem.hasAttribute('data-bs-toggle')) {
            events.push('toggle');
          }
          if (elem.hasAttribute('data-dismiss') || elem.hasAttribute('data-bs-dismiss')) {
            events.push('dismiss');
          }
          
          return events;
        }

        // セレクタの生成（改善版）
        function generateSelector(elem) {
          // ID優先
          if (elem.id && !/\d{10,}/.test(elem.id)) { // 長い数字のIDは避ける
            return `#${CSS.escape(elem.id)}`;
          }
          
          // data-testid属性
          if (elem.getAttribute('data-testid')) {
            return `[data-testid="${elem.getAttribute('data-testid')}]`;
          }
          
          // data-test属性
          if (elem.getAttribute('data-test')) {
            return `[data-test="${elem.getAttribute('data-test')}]`;
          }
          
          // name属性
          if (elem.name) {
            const nameSelector = `[name="${CSS.escape(elem.name)}"]`;
            if (document.querySelectorAll(nameSelector).length === 1) {
              return nameSelector;
            }
          }
          
          // aria-label
          if (elem.getAttribute('aria-label')) {
            const ariaSelector = `[aria-label="${CSS.escape(elem.getAttribute('aria-label'))}"]`;
            if (document.querySelectorAll(ariaSelector).length === 1) {
              return ariaSelector;
            }
          }
          
          // 一意なクラスの組み合わせ
          if (elem.className) {
            // classNameが文字列でない場合（SVGElement等）の対応
            const classNameStr = typeof elem.className === 'string' 
              ? elem.className 
              : elem.className.baseVal || elem.getAttribute('class') || '';
            const classes = classNameStr.split(' ')
              .filter(c => c && !c.match(/^(active|disabled|hidden|show|fade|in|out|open|close)/))
              .slice(0, 3);
            if (classes.length > 0) {
              const classSelector = classes.map(c => `.${CSS.escape(c)}`).join('');
              if (document.querySelectorAll(classSelector).length === 1) {
                return classSelector;
              }
            }
          }
          
          // XPath風のセレクタ
          let path = [];
          let current = elem;
          while (current && current.nodeType === Node.ELEMENT_NODE) {
            let selector = current.tagName.toLowerCase();
            if (current.id && !/\d{10,}/.test(current.id)) {
              path.unshift(`#${CSS.escape(current.id)}`);
              break;
            } else {
              const siblings = current.parentNode ? Array.from(current.parentNode.children) : [];
              const sameTagSiblings = siblings.filter(s => s.tagName === current.tagName);
              if (sameTagSiblings.length > 1) {
                const index = sameTagSiblings.indexOf(current) + 1;
                selector += `:nth-of-type(${index})`;
              }
              path.unshift(selector);
            }
            current = current.parentNode;
            if (path.length > 4) break; // 深すぎる場合は打ち切り
          }
          
          return path.join(' > ');
        }

        // フォーム関連の情報取得
        function getFormContext(elem) {
          const form = elem.closest('form');
          if (!form) return null;
          
          return {
            formId: form.id || null,
            formName: form.name || null,
            formAction: form.action || null,
            formMethod: form.method || 'GET',
            formEnctype: form.enctype || null,
            fieldIndex: Array.from(form.elements).indexOf(elem)
          };
        }

        const accessibleName = getAccessibleName(element);
        const events = getEventListeners(element);
        const selector = generateSelector(element);
          const formContext = getFormContext(element);
          // 追加: 目的地URLの推定（アイコン/ボタン対応）
          let resolvedHref = null;
          try {
            if (element.tagName === 'A' && element.href) {
              resolvedHref = element.href;
            } else {
              const dh = element.getAttribute('data-href') || element.getAttribute('data-url');
              if (dh) {
                const a = document.createElement('a');
                a.href = dh;
                resolvedHref = a.href;
              } else if (element.getAttribute('onclick')) {
                const oc = element.getAttribute('onclick');
                const m = oc.match(/location\.(?:href|assign)\(['\"]([^'\"]+)['\"]\)/);
                if (m && m[1]) {
                  const a = document.createElement('a');
                  a.href = m[1];
                  resolvedHref = a.href;
                }
              }
            }
          } catch (e) {}
        
          return {
          // 基本情報
          tagName: element.tagName.toLowerCase(),
          type: element.type || element.tagName.toLowerCase(),
          id: element.id || null,
          name: element.name || null,
          className: element.className || null,
          
          // テキスト情報
          text: element.textContent?.trim().substring(0, 200) || '',
          value: element.value || '',
          accessibleName: accessibleName,
          
          // 属性
          href: element.href || null,
          dataHref: element.getAttribute('data-href') || element.getAttribute('data-url') || null,
          resolvedHref: resolvedHref,
          src: element.src || null,
          alt: element.alt || null,
          title: element.title || null,
          placeholder: element.placeholder || null,
          
          // 状態
          required: element.required || false,
          disabled: element.disabled || false,
          readonly: element.readOnly || false,
          checked: element.checked || false,
          selected: element.selected || false,
          
          // 制約
          maxLength: element.maxLength > 0 ? element.maxLength : null,
          minLength: element.minLength > 0 ? element.minLength : null,
          min: element.min || null,
          max: element.max || null,
          pattern: element.pattern || null,
          step: element.step || null,
          
          // 位置とサイズ
          position: {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            bottom: Math.round(rect.bottom),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            centerX: Math.round(rect.left + rect.width / 2),
            centerY: Math.round(rect.top + rect.height / 2)
          },
          
          // スタイル情報
          style: {
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            zIndex: style.zIndex,
            position: style.position,
            overflow: style.overflow,
            cursor: style.cursor
          },
          
          // セレクタと識別子
          selector: selector,
          xpath: null, // 後で生成
          
          // インタラクション情報
          isInteractable: isElementInteractable(element),
          events: events,
          formContext: formContext,
          
          // WAI-ARIA
          role: element.getAttribute('role') || null,
          ariaLabel: element.getAttribute('aria-label') || null,
          ariaLabelledBy: element.getAttribute('aria-labelledby') || null,
          ariaDescribedBy: element.getAttribute('aria-describedby') || null,
          ariaExpanded: element.getAttribute('aria-expanded') || null,
          ariaControls: element.getAttribute('aria-controls') || null,
          ariaHidden: element.getAttribute('aria-hidden') || null,
          
          // data属性
          dataAttributes: Array.from(element.attributes)
            .filter(attr => attr.name.startsWith('data-'))
            .reduce((acc, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {}),
          
          // フォームコンテキスト
          formContext: formContext,
          
          // 親要素の情報
          parentTag: element.parentElement?.tagName.toLowerCase() || null,
          parentId: element.parentElement?.id || null,
          parentClass: element.parentElement?.className || null
        };
      }

      /**
       * Shadow DOM内の要素を収集
       */
      function collectFromShadowRoots(root = document, collected = new Set()) {
        // Shadow rootを持つ要素を検索
        root.querySelectorAll('*').forEach(element => {
          if (element.shadowRoot && !collected.has(element.shadowRoot)) {
            collected.add(element.shadowRoot);
            
            // Shadow DOM内の要素を収集
            element.shadowRoot.querySelectorAll('*').forEach(shadowElement => {
              if (isElementInteractable(shadowElement)) {
                const info = collectDetailedElementInfo(shadowElement);
                info.isShadowElement = true;
                info.shadowHost = element.tagName.toLowerCase();
                
                // 要素の種類に応じて分類
                categorizeElement(shadowElement, info);
              }
            });
            
            // 再帰的にShadow DOMを探索
            collectFromShadowRoots(element.shadowRoot, collected);
          }
        });
      }

      /**
       * 要素を適切なカテゴリに分類
       */
      function categorizeElement(element, info) {
        const tagName = element.tagName.toLowerCase();
        const type = element.type?.toLowerCase();
        
        // リンク
        if (tagName === 'a' && element.href) {
          collectedElements.links.push(info);
          
          // ナビゲーションリンクかチェック
          const nav = element.closest('nav, [role="navigation"], .nav, .navbar, .menu');
          if (nav) {
            info.isNavigation = true;
            collectedElements.navigationItems.push(info);
          }
          
          // フッターリンクかチェック
          const footer = element.closest('footer, [role="contentinfo"], .footer');
          if (footer) {
            info.isFooter = true;
            collectedElements.footerLinks.push(info);
          }
          
          // パンくずリンクかチェック
          const breadcrumb = element.closest('.breadcrumb, [aria-label*="breadcrumb"], nav[aria-label*="Breadcrumb"]');
          if (breadcrumb) {
            info.isBreadcrumb = true;
            collectedElements.breadcrumbs.push(info);
          }
          
          // ページネーションリンクかチェック
          const pagination = element.closest('.pagination, [role="navigation"][aria-label*="pagination"], .pager');
          if (pagination) {
            info.isPagination = true;
            collectedElements.pagination.push(info);
          }
        }
        
        // ボタン
        if (tagName === 'button' || type === 'button' || type === 'submit' || 
            type === 'reset' || element.getAttribute('role') === 'button') {
          collectedElements.buttons.push(info);
          
          // ドロップダウントリガーかチェック
          if (element.hasAttribute('data-toggle') && element.getAttribute('data-toggle') === 'dropdown' ||
              element.hasAttribute('data-bs-toggle') && element.getAttribute('data-bs-toggle') === 'dropdown' ||
              element.getAttribute('aria-haspopup') === 'true') {
            info.isDropdownTrigger = true;
            collectedElements.dropdowns.push(info);
          }
          
          // モーダルトリガーかチェック
          if (element.hasAttribute('data-toggle') && element.getAttribute('data-toggle') === 'modal' ||
              element.hasAttribute('data-bs-toggle') && element.getAttribute('data-bs-toggle') === 'modal') {
            info.isModalTrigger = true;
            collectedElements.modals.push(info);
          }
          
          // タブトリガーかチェック
          if (element.getAttribute('role') === 'tab' || 
              element.hasAttribute('data-toggle') && element.getAttribute('data-toggle') === 'tab' ||
              element.hasAttribute('data-bs-toggle') && element.getAttribute('data-bs-toggle') === 'tab') {
            info.isTab = true;
            collectedElements.tabs.push(info);
          }
        }
        
        // 入力フィールド
        if (tagName === 'input') {
          if (type === 'checkbox') {
            collectedElements.checkboxes.push(info);
            
            // トグルスイッチかチェック
            const classNameStr = typeof element.className === 'string' 
                               ? element.className 
                               : element.className.baseVal || element.getAttribute('class') || '';
            const isToggle = classNameStr.includes('toggle') || 
                           classNameStr.includes('switch') ||
                           element.closest('.toggle, .switch');
            if (isToggle) {
              info.isToggle = true;
              collectedElements.toggles.push(info);
            }
          } else if (type === 'radio') {
            collectedElements.radios.push(info);
          } else if (type === 'file') {
            collectedElements.fileInputs.push(info);
          } else if (type === 'color') {
            collectedElements.colorPickers.push(info);
          } else if (type === 'range') {
            collectedElements.rangeInputs.push(info);
          } else if (type === 'date' || type === 'datetime-local' || type === 'time') {
            collectedElements.datepickers.push(info);
          } else if (type !== 'hidden') {
            collectedElements.inputs.push(info);
            
            // スライダーかチェック
            const classNameStr2 = typeof element.className === 'string' 
                               ? element.className 
                               : element.className.baseVal || element.getAttribute('class') || '';
            if (type === 'range' || classNameStr2.includes('slider')) {
              info.isSlider = true;
              collectedElements.sliders.push(info);
            }
          }
        }
        
        // テキストエリア
        if (tagName === 'textarea') {
          collectedElements.textareas.push(info);
        }
        
        // セレクトボックス
        if (tagName === 'select') {
          // オプションを収集
          info.options = Array.from(element.options || []).map(option => ({
            value: option.value,
            text: option.textContent.trim(),
            selected: option.selected,
            disabled: option.disabled
          }));
          collectedElements.selects.push(info);
        }
        
        // 画像
        if (tagName === 'img') {
          collectedElements.images.push(info);
        }
        
        // アイコン（FontAwesome, Material Icons など）
        const classNameStr3 = typeof element.className === 'string' 
                           ? element.className 
                           : element.className.baseVal || element.getAttribute('class') || '';
        if (tagName === 'i' || tagName === 'svg' || 
            classNameStr3.includes('icon') || classNameStr3.includes('fa-') ||
            classNameStr3.includes('material-icons')) {
          info.isIcon = true;
          collectedElements.icons.push(info);
        }
        
        // SVG要素
        if (tagName === 'svg' || element instanceof SVGElement) {
          collectedElements.svgElements.push(info);
        }
        
        // ラベル
        if (tagName === 'label') {
          collectedElements.labels.push(info);
        }
        
        // 見出し
        if (/^h[1-6]$/.test(tagName)) {
          info.level = parseInt(tagName.charAt(1));
          collectedElements.headings.push(info);
        }
        
        // テーブル
        if (tagName === 'table') {
          info.tableInfo = {
            rows: element.rows?.length || 0,
            columns: element.rows[0]?.cells?.length || 0,
            hasHeader: !!element.querySelector('thead'),
            caption: element.caption?.textContent || null
          };
          collectedElements.tables.push(info);
        }
        
        // contenteditable要素
        if (element.contentEditable === 'true' || element.getAttribute('contenteditable') === 'true') {
          collectedElements.contentEditables.push(info);
        }
        
        // ビデオ
        if (tagName === 'video') {
          info.videoInfo = {
            src: element.src || element.querySelector('source')?.src || null,
            duration: element.duration || null,
            controls: element.controls || false,
            autoplay: element.autoplay || false
          };
          collectedElements.videos.push(info);
        }
        
        // オーディオ
        if (tagName === 'audio') {
          info.audioInfo = {
            src: element.src || element.querySelector('source')?.src || null,
            duration: element.duration || null,
            controls: element.controls || false,
            autoplay: element.autoplay || false
          };
          collectedElements.audios.push(info);
        }
        
        // キャンバス
        if (tagName === 'canvas') {
          info.canvasInfo = {
            width: element.width,
            height: element.height,
            context: element.getContext ? '2d/webgl available' : 'not available'
          };
          collectedElements.canvases.push(info);
        }
        
        // iframe
        if (tagName === 'iframe') {
          info.iframeInfo = {
            src: element.src || null,
            srcdoc: element.srcdoc ? 'inline HTML' : null,
            sandbox: element.sandbox?.value || null,
            loading: element.loading || 'eager'
          };
          collectedElements.iframes.push(info);
        }
        
        // Web Components (カスタム要素)
        if (tagName.includes('-')) {
          info.isWebComponent = true;
          collectedElements.webComponents.push(info);
        }
        
        // アコーディオン
        if (element.hasAttribute('data-toggle') && element.getAttribute('data-toggle') === 'collapse' ||
            element.hasAttribute('data-bs-toggle') && element.getAttribute('data-bs-toggle') === 'collapse' ||
            element.getAttribute('aria-expanded') !== null) {
          info.isAccordion = true;
          collectedElements.accordions.push(info);
        }
        
        // ツールチップ
        if (element.hasAttribute('data-toggle') && element.getAttribute('data-toggle') === 'tooltip' ||
            element.hasAttribute('data-bs-toggle') && element.getAttribute('data-bs-toggle') === 'tooltip' ||
            element.hasAttribute('title') || element.hasAttribute('data-tooltip')) {
          info.hasTooltip = true;
          collectedElements.tooltips.push(info);
        }
      }

      // メインのDOM要素を収集
      document.querySelectorAll('*').forEach(element => {
        if (isElementInteractable(element)) {
          const info = collectDetailedElementInfo(element);
          categorizeElement(element, info);
        }
      });
      
      // Shadow DOM内の要素を収集
      collectFromShadowRoots();
      
      // フォーム要素をグループ化
      document.querySelectorAll('form').forEach(form => {
        const formInfo = collectDetailedElementInfo(form);
        formInfo.fields = [];
        
        // フォーム内のフィールドを収集
        form.querySelectorAll('input, textarea, select, button[type="submit"], [contenteditable="true"]').forEach(field => {
          const fieldInfo = collectDetailedElementInfo(field);
          formInfo.fields.push(fieldInfo);
        });
        
        if (formInfo.fields.length > 0 || isElementInteractable(form)) {
          collectedElements.forms.push(formInfo);
        }
      });
      
      // 座標順でソート（上から下、左から右）
      Object.keys(collectedElements).forEach(key => {
        if (Array.isArray(collectedElements[key])) {
          collectedElements[key].sort((a, b) => {
            // Y座標優先
            const yDiff = a.position.top - b.position.top;
            if (Math.abs(yDiff) > 10) return yDiff;
            // 同じ高さならX座標でソート
            return a.position.left - b.position.left;
          });
        }
      });
      
      return collectedElements;
    });
    
    // iframe内のコンテンツも収集
    const iframeElements = await this.collectFromIframes(page);
    
    // 結果をマージ
    Object.keys(iframeElements).forEach(key => {
      if (Array.isArray(elements[key]) && Array.isArray(iframeElements[key])) {
        elements[key].push(...iframeElements[key]);
      }
    });
    
    return elements;
  }

  /**
   * 動的コンテンツが読み込まれるまで待機
   */
  async waitForDynamicContent(page, timeout = 5000) {
    try {
      // 一般的なローディングインジケーターが消えるまで待機
      await page.waitForFunction(() => {
        const indicators = [
          '.loading', '.loader', '.spinner', '.progress',
          '[class*="loading"]', '[class*="spinner"]',
          '[aria-busy="true"]', '[data-loading="true"]'
        ];
        
        for (const selector of indicators) {
          const element = document.querySelector(selector);
          if (element && window.getComputedStyle(element).display !== 'none') {
            return false;
          }
        }
        return true;
      }, { timeout });
    } catch (e) {
      // タイムアウトしても続行
    }
    
    // Ajax呼び出しが完了するまで待機
    try {
      await page.waitForLoadState('networkidle', { timeout: 3000 });
    } catch (e) {
      // タイムアウトしても続行
    }
    
    // 追加の待機
    await page.waitForTimeout(1000);
  }

  /**
   * ページ全体をスクロールして遅延読み込みコンテンツを表示
   */
  async scrollToLoadAllContent(page) {
    await page.evaluate(async () => {
      // スクロール関数
      const scrollToBottom = async () => {
        const distance = 500; // スクロール距離
        const delay = 300; // スクロール間の遅延
        const maxScrolls = 50; // 最大スクロール回数
        
        let scrollCount = 0;
        let lastHeight = document.body.scrollHeight;
        
        while (scrollCount < maxScrolls) {
          window.scrollBy(0, distance);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          const newHeight = document.body.scrollHeight;
          if (newHeight === lastHeight) {
            // 高さが変わらなくなったら終了
            break;
          }
          lastHeight = newHeight;
          scrollCount++;
        }
        
        // トップに戻る
        window.scrollTo(0, 0);
        await new Promise(resolve => setTimeout(resolve, 500));
      };
      
      await scrollToBottom();
      
      // 横スクロール可能な要素も処理
      const horizontalScrollables = document.querySelectorAll('[style*="overflow-x"], [style*="overflow: auto"], .carousel, .slider');
      for (const element of horizontalScrollables) {
        if (element.scrollWidth > element.clientWidth) {
          element.scrollLeft = element.scrollWidth;
          await new Promise(resolve => setTimeout(resolve, 300));
          element.scrollLeft = 0;
        }
      }
    });
  }

  /**
   * iframe内の要素を収集
   */
  async collectFromIframes(page) {
    const iframeElements = {
      links: [],
      buttons: [],
      inputs: [],
      textareas: [],
      selects: [],
      checkboxes: [],
      radios: [],
      forms: []
    };
    
    try {
      const frames = page.frames();
      
      for (const frame of frames) {
        if (frame === page.mainFrame()) continue;
        
        try {
          // iframe内で要素収集スクリプトを実行
          const frameElements = await frame.evaluate(() => {
            const elements = {
              links: [],
              buttons: [],
              inputs: [],
              textareas: [],
              selects: [],
              checkboxes: [],
              radios: [],
              forms: []
            };
            
            // 簡易版の収集（主要な要素のみ）
            document.querySelectorAll('a[href]').forEach(el => {
              elements.links.push({
                text: el.textContent.trim(),
                href: el.href,
                selector: `iframe a[href="${el.href}"]`,
                isIframeElement: true
              });
            });
            
            document.querySelectorAll('button, input[type="button"], input[type="submit"]').forEach(el => {
              elements.buttons.push({
                text: el.textContent.trim() || el.value,
                type: el.type,
                selector: `iframe ${el.tagName.toLowerCase()}`,
                isIframeElement: true
              });
            });
            
            document.querySelectorAll('input:not([type="hidden"])').forEach(el => {
              const category = el.type === 'checkbox' ? 'checkboxes' : 
                             el.type === 'radio' ? 'radios' : 'inputs';
              elements[category].push({
                type: el.type,
                name: el.name,
                id: el.id,
                selector: `iframe input[type="${el.type}"]`,
                isIframeElement: true
              });
            });
            
            return elements;
          });
          
          // 収集した要素をマージ
          Object.keys(frameElements).forEach(key => {
            if (Array.isArray(iframeElements[key]) && Array.isArray(frameElements[key])) {
              iframeElements[key].push(...frameElements[key]);
            }
          });
        } catch (e) {
          // iframe内でのエラーは無視（クロスオリジンなど）
          console.log('iframe収集エラー（クロスオリジンの可能性）:', e.message);
        }
      }
    } catch (e) {
      console.log('iframe処理エラー:', e.message);
    }
    
    return iframeElements;
  }

  /**
   * 要素からテストケースを生成（セキュリティテスト含む）
   */
  generateTestCasesFromElements(elements, url) {
    const testCases = [];
    let testIdCounter = 1;
    
    // 各カテゴリーの要素に対してテストケースを生成
    
    // リンクテスト（手順付きで生成）
    elements.links.forEach(link => {
      const href = link.href || link.resolvedHref || link.dataHref;
      const hasText = (link.text?.trim() || link.accessibleName?.trim());
      const isValid = href && href !== '#' && !/^javascript:/i.test(href);
      if (!isValid) return;

      const steps = [
        { step_number: 1, action: 'goto', target: url, description: 'ページにアクセス' },
        { step_number: 2, action: 'click', target: link.selector, description: `リンク「${link.accessibleName || link.text || link.selector}」をクリック` }
      ];
      if (href) {
        steps.push({ step_number: 3, action: 'wait_for_navigation', target: href, description: `リンク先（${href}）への遷移を待つ` });
      }

      testCases.push({
        test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
        test_case_name: `リンク_${link.accessibleName || link.text || 'リンク'}クリック`,
        test_category: 'リンク',
        priority: link.isNavigation ? 'high' : 'medium',
        target_url: url,
        selector: link.selector,
        destination_url: href,
        test_steps: steps,
        expected_result: `「${link.accessibleName || link.text || 'リンク'}」をクリックし、${href || '遷移先'}に遷移する`
      });
    });
    
    // ボタンテスト（遷移先推定）
    elements.buttons.forEach(button => {
      const label = button.accessibleName || button.text || 'ボタン';
      if (button.disabled) return;
      const formAction = button.formContext?.formAction || button.formAction || null;
      const dataHref = button.dataHref || null;
      const dest = formAction || dataHref || null;

      const steps = [
        { step_number: 1, action: 'goto', target: url, description: 'ページにアクセス' },
        { step_number: 2, action: 'click', target: button.selector, description: `「${label}」ボタンをクリック` }
      ];
      if (dest) {
        steps.push({ step_number: 3, action: 'wait_for_navigation', target: dest, description: `ボタンの遷移先（${dest}）への遷移を待つ` });
      } else if (button.type === 'submit' || button.formContext) {
        // フォーム送信による遷移（URL特定不可）
        steps.push({ step_number: 3, action: 'wait_for_navigation', target: '', description: '送信による遷移を待つ' });
      }

      testCases.push({
        test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
        test_case_name: `ボタン_${label}クリック`,
        test_category: 'ボタン',
        priority: button.type === 'submit' ? 'high' : 'medium',
        target_url: url,
        selector: button.selector,
        destination_url: dest,
        test_steps: steps,
        expected_result: `「${label}」ボタンのクリックで期待動作（${dest || '遷移/送信'}）が行われる`
      });
    });
    
    // フォームテスト（セキュリティテスト含む）
    elements.forms.forEach(form => {
      // 正常系テスト
      const normalTestCase = {
        test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
        test_case_name: `フォーム_${form.accessibleName || form.id || 'フォーム'}送信`,
        test_category: 'フォーム',
        priority: 'high',
        target_url: url,
        test_steps: []
      };
      
      // フィールドに値を入力
      form.fields?.forEach(field => {
        if (field.type !== 'submit' && field.type !== 'button') {
          normalTestCase.test_steps.push({
            action: 'fill',
            selector: field.selector,
            value: this.generateSampleValue(field),
            description: `${field.accessibleName || field.name || field.type}に入力`
          });
        }
      });
      
      // 送信
      const submitButton = form.fields?.find(f => f.type === 'submit');
      if (submitButton) {
        normalTestCase.test_steps.push({
          action: 'click',
          selector: submitButton.selector,
          description: 'フォームを送信'
        });
      }
      
      normalTestCase.expected_result = 'フォームが正常に送信される';
      testCases.push(normalTestCase);
      
      // セキュリティテスト追加
      const textFields = form.fields?.filter(f => {
        // textareaはtagNameで判定
        if (f.tagName === 'textarea') return true;
        // input要素のテキスト系type
        return f.type === 'text' || f.type === 'email' || f.type === 'search' ||
               f.type === 'url' || f.type === 'tel' || f.type === 'password' ||
               !f.type; // typeが未定義の場合はtextとして扱う
      }) || [];
      
      if (textFields.length > 0) {
        const targetField = textFields[0];
        
        // XSSテスト（全パターン）
        TEST_DATA.invalid.xss.forEach((payload, index) => {
          testCases.push({
            test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
            test_case_name: `セキュリティ_XSS攻撃テスト_パターン${index + 1}`,
            test_category: 'セキュリティ',
            test_type: 'security',
            priority: 'critical',
            target_url: url,
            selector: targetField.selector,
            action: 'fill',
            test_data: {
              payload: payload,
              attack_type: 'XSS'
            },
            expected_result: 'XSS攻撃が防御される（スクリプトが実行されない）'
          });
        });
        
        // SQLインジェクションテスト（全パターン）
        TEST_DATA.invalid.sql.forEach((payload, index) => {
          testCases.push({
            test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
            test_case_name: `セキュリティ_SQLインジェクション攻撃テスト_パターン${index + 1}`,
            test_category: 'セキュリティ',
            test_type: 'security',
            priority: 'critical',
            target_url: url,
            selector: targetField.selector,
            action: 'fill',
            test_data: {
              payload: payload,
              attack_type: 'SQL_INJECTION'
            },
            expected_result: 'SQLインジェクション攻撃が防御される'
          });
        });
      }
    });
    
    // ドロップダウンメニューのテスト
    elements.dropdowns.forEach(dropdown => {
      testCases.push({
        test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
        test_case_name: `ドロップダウン_${dropdown.accessibleName || 'メニュー'}展開`,
        test_category: 'ドロップダウン',
        priority: 'medium',
        target_url: url,
        selector: dropdown.selector,
        action: 'click',
        expected_result: 'ドロップダウンメニューが展開される'
      });
    });
    
    // セレクトボックスのテスト
    elements.selects.forEach(select => {
      if (select.options && select.options.length > 0) {
        select.options.forEach((option, index) => {
          if (!option.disabled && index < 5) { // 最初の5個まで
            testCases.push({
              test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
              test_case_name: `セレクト_${select.accessibleName || select.name}_${option.text}選択`,
              test_category: 'セレクト',
              priority: 'medium',
              target_url: url,
              selector: select.selector,
              action: 'select',
              value: option.value,
              expected_result: `「${option.text}」が選択される`
            });
          }
        });
      }
    });
    
    // チェックボックスのテスト
    elements.checkboxes.forEach(checkbox => {
      testCases.push({
        test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
        test_case_name: `チェックボックス_${checkbox.accessibleName || checkbox.name}_切り替え`,
        test_category: 'チェックボックス',
        priority: 'low',
        target_url: url,
        selector: checkbox.selector,
        action: 'check',
        expected_result: 'チェックボックスの状態が切り替わる'
      });
    });
    
    // ラジオボタンのテスト
    const radioGroups = {};
    elements.radios.forEach(radio => {
      const groupName = radio.name || 'default';
      if (!radioGroups[groupName]) {
        radioGroups[groupName] = [];
      }
      radioGroups[groupName].push(radio);
    });
    
    Object.entries(radioGroups).forEach(([groupName, radios]) => {
      radios.forEach(radio => {
        testCases.push({
          test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
          test_case_name: `ラジオボタン_${groupName}_${radio.accessibleName || radio.value}選択`,
          test_category: 'ラジオボタン',
          priority: 'low',
          target_url: url,
          selector: radio.selector,
          action: 'check',
          expected_result: `${groupName}グループで選択される`
        });
      });
    });
    
    // タブのテスト
    elements.tabs.forEach(tab => {
      testCases.push({
        test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
        test_case_name: `タブ_${tab.accessibleName || tab.text}切り替え`,
        test_category: 'タブ',
        priority: 'medium',
        target_url: url,
        selector: tab.selector,
        action: 'click',
        expected_result: 'タブが切り替わり、対応するコンテンツが表示される'
      });
    });
    
    // アコーディオンのテスト
    elements.accordions.forEach(accordion => {
      testCases.push({
        test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
        test_case_name: `アコーディオン_${accordion.accessibleName || accordion.text}開閉`,
        test_category: 'アコーディオン',
        priority: 'low',
        target_url: url,
        selector: accordion.selector,
        action: 'click',
        expected_result: 'アコーディオンが開閉される'
      });
    });
    
    // モーダルのテスト
    elements.modals.forEach(modal => {
      testCases.push({
        test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
        test_case_name: `モーダル_${modal.accessibleName || 'ダイアログ'}表示`,
        test_category: 'モーダル',
        priority: 'medium',
        target_url: url,
        selector: modal.selector,
        action: 'click',
        expected_result: 'モーダルダイアログが表示される'
      });
    });
    
    return testCases;
  }

  /**
   * フィールドに応じたサンプル値を生成
   */
  generateSampleValue(field) {
    const type = field.type?.toLowerCase();
    const name = field.name?.toLowerCase() || '';
    const placeholder = field.placeholder?.toLowerCase() || '';
    
    // タイプ別のサンプルデータ
    if (type === 'email') return 'test@example.com';
    if (type === 'tel') return '090-1234-5678';
    if (type === 'url') return 'https://example.com';
    if (type === 'number') return '100';
    if (type === 'date') return '2024-01-01';
    if (type === 'time') return '12:00';
    if (type === 'password') return 'TestPassword123!';
    
    // 名前やプレースホルダーから推測
    if (name.includes('name') || placeholder.includes('名前')) return '山田太郎';
    if (name.includes('email') || placeholder.includes('メール')) return 'test@example.com';
    if (name.includes('phone') || placeholder.includes('電話')) return '090-1234-5678';
    if (name.includes('address') || placeholder.includes('住所')) return '東京都渋谷区1-2-3';
    if (name.includes('search') || placeholder.includes('検索')) return 'テスト検索';
    
    // デフォルト
    return 'テストデータ';
  }
}
