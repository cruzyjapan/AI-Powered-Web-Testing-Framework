// 完全版HTMLタグ要素収集システム - すべてのHTML要素を網羅

import { TEST_DATA } from './ai-test-prompts.js';

export class CompleteHTMLCollector {
  
  /**
   * すべてのHTML要素を完全に収集
   */
  async collectAllHTMLElements(page) {
    // スクロール可能な全領域を取得
    await this.scrollToLoadAllContent(page);
    
    // 動的コンテンツの読み込みを待機
    await this.waitForDynamicContent(page);
    
    // すべてのHTML要素を収集
    const elements = await page.evaluate(() => {
      const collectedElements = {
        // ========== ドキュメントメタデータ ==========
        base: [],          // <base> - ベースURL
        head: [],          // <head> - ヘッダ情報
        link: [],          // <link> - 外部リソースリンク
        meta: [],          // <meta> - メタデータ
        style: [],         // <style> - スタイル定義
        title: [],         // <title> - ページタイトル
        
        // ========== セクショニング ==========
        body: [],          // <body> - ボディ
        article: [],       // <article> - 記事
        section: [],       // <section> - セクション
        nav: [],           // <nav> - ナビゲーション
        aside: [],         // <aside> - サイドバー
        h1: [], h2: [], h3: [], h4: [], h5: [], h6: [], // 見出し
        header: [],        // <header> - ヘッダ
        footer: [],        // <footer> - フッタ
        address: [],       // <address> - 連絡先
        main: [],          // <main> - メインコンテンツ
        
        // ========== コンテンツグループ ==========
        p: [],             // <p> - 段落
        hr: [],            // <hr> - 水平線
        pre: [],           // <pre> - 整形済みテキスト
        blockquote: [],    // <blockquote> - 引用ブロック
        ol: [],            // <ol> - 順序付きリスト
        ul: [],            // <ul> - 順序なしリスト
        li: [],            // <li> - リスト項目
        dl: [],            // <dl> - 定義リスト
        dt: [],            // <dt> - 定義語
        dd: [],            // <dd> - 定義説明
        figure: [],        // <figure> - 図表
        figcaption: [],    // <figcaption> - 図表キャプション
        div: [],           // <div> - 汎用ブロック
        
        // ========== テキストレベルセマンティクス ==========
        a: [],             // <a> - リンク
        em: [],            // <em> - 強調
        strong: [],        // <strong> - 重要
        small: [],         // <small> - 小さい文字
        s: [],             // <s> - 取り消し線
        cite: [],          // <cite> - 引用元
        q: [],             // <q> - インライン引用
        dfn: [],           // <dfn> - 定義
        abbr: [],          // <abbr> - 略語
        data: [],          // <data> - 機械可読データ
        time: [],          // <time> - 時刻
        code: [],          // <code> - コード
        var: [],           // <var> - 変数
        samp: [],          // <samp> - サンプル出力
        kbd: [],           // <kbd> - キーボード入力
        sub: [],           // <sub> - 下付き文字
        sup: [],           // <sup> - 上付き文字
        i: [],             // <i> - イタリック
        b: [],             // <b> - 太字
        u: [],             // <u> - 下線
        mark: [],          // <mark> - マーク
        ruby: [],          // <ruby> - ルビ
        rt: [],            // <rt> - ルビテキスト
        rp: [],            // <rp> - ルビ括弧
        bdi: [],           // <bdi> - 双方向分離
        bdo: [],           // <bdo> - 双方向上書き
        span: [],          // <span> - 汎用インライン
        br: [],            // <br> - 改行
        wbr: [],           // <wbr> - 改行可能位置
        
        // ========== 編集 ==========
        ins: [],           // <ins> - 挿入
        del: [],           // <del> - 削除
        
        // ========== 埋め込みコンテンツ ==========
        img: [],           // <img> - 画像
        iframe: [],        // <iframe> - インラインフレーム
        embed: [],         // <embed> - 埋め込み
        object: [],        // <object> - オブジェクト
        param: [],         // <param> - パラメータ
        picture: [],       // <picture> - レスポンシブ画像
        source: [],        // <source> - メディアソース
        video: [],         // <video> - ビデオ
        audio: [],         // <audio> - オーディオ
        track: [],         // <track> - テキストトラック
        map: [],           // <map> - イメージマップ
        area: [],          // <area> - イメージマップ領域
        
        // ========== SVGとMathML ==========
        svg: [],           // <svg> - SVGグラフィックス
        math: [],          // <math> - 数式
        
        // ========== テーブル ==========
        table: [],         // <table> - テーブル
        caption: [],       // <caption> - テーブルキャプション
        colgroup: [],      // <colgroup> - 列グループ
        col: [],           // <col> - 列
        tbody: [],         // <tbody> - テーブルボディ
        thead: [],         // <thead> - テーブルヘッダ
        tfoot: [],         // <tfoot> - テーブルフッタ
        tr: [],            // <tr> - テーブル行
        td: [],            // <td> - テーブルデータ
        th: [],            // <th> - テーブル見出し
        
        // ========== フォーム ==========
        form: [],          // <form> - フォーム
        label: [],         // <label> - ラベル
        input: [],         // <input> - 入力フィールド
        button: [],        // <button> - ボタン
        select: [],        // <select> - 選択リスト
        datalist: [],      // <datalist> - データリスト
        optgroup: [],      // <optgroup> - オプショングループ
        option: [],        // <option> - オプション
        textarea: [],      // <textarea> - テキストエリア
        output: [],        // <output> - 出力
        progress: [],      // <progress> - 進捗
        meter: [],         // <meter> - メーター
        fieldset: [],      // <fieldset> - フィールドセット
        legend: [],        // <legend> - 凡例
        
        // ========== インタラクティブ要素 ==========
        details: [],       // <details> - 詳細
        summary: [],       // <summary> - 要約
        dialog: [],        // <dialog> - ダイアログ
        menu: [],          // <menu> - メニュー
        
        // ========== スクリプティング ==========
        script: [],        // <script> - スクリプト
        noscript: [],      // <noscript> - スクリプト無効時
        template: [],      // <template> - テンプレート
        canvas: [],        // <canvas> - キャンバス
        slot: [],          // <slot> - スロット
        
        // ========== Web Components ==========
        webComponents: [], // カスタム要素（ハイフン含む）
        
        // ========== 廃止予定だが使用される要素 ==========
        center: [],        // <center> - 中央揃え（非推奨）
        font: [],          // <font> - フォント（非推奨）
        marquee: [],       // <marquee> - マーキー（非推奨）
        blink: [],         // <blink> - 点滅（非推奨）
        
        // ========== 特殊な分類 ==========
        shadowRoots: [],   // Shadow DOM
        customElements: [], // カスタム要素
        contentEditable: [], // contenteditable要素
        draggable: [],     // ドラッグ可能要素
        interactive: [],   // インタラクティブ要素全般
        focusable: [],     // フォーカス可能要素
        clickable: [],     // クリック可能要素
        formControls: [],  // フォームコントロール全般
      };

      /**
       * 要素の詳細情報を収集する統一関数
       */
      function collectElementInfo(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        // 要素の可視性判定
        const isVisible = () => {
          if (rect.width === 0 && rect.height === 0) return false;
          if (style.display === 'none') return false;
          if (style.visibility === 'hidden') return false;
          if (style.opacity === '0' && !element.matches(':hover')) return false;
          return true;
        };
        
        // テキストコンテンツの取得
        const getTextContent = () => {
          // 特殊な要素のテキスト取得
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            return element.value || element.placeholder || '';
          }
          if (element.tagName === 'SELECT') {
            const selected = element.options[element.selectedIndex];
            return selected ? selected.text : '';
          }
          if (element.tagName === 'IMG') {
            return element.alt || element.title || '';
          }
          if (element.tagName === 'BUTTON') {
            return element.textContent?.trim() || element.value || '';
          }
          
          // 通常の要素
          return element.textContent?.trim().substring(0, 200) || '';
        };
        
        // アクセシブルな名前の取得
        const getAccessibleName = () => {
          // aria-labelledby
          if (element.getAttribute('aria-labelledby')) {
            const labelIds = element.getAttribute('aria-labelledby').split(' ');
            const labels = labelIds.map(id => {
              const label = document.getElementById(id);
              return label ? label.textContent.trim() : '';
            }).filter(text => text);
            if (labels.length > 0) return labels.join(' ');
          }
          
          // aria-label
          if (element.getAttribute('aria-label')) {
            return element.getAttribute('aria-label');
          }
          
          // label要素
          if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) return label.textContent.trim();
          }
          
          // title属性
          if (element.title) return element.title;
          
          // placeholder
          if (element.placeholder) return element.placeholder;
          
          // alt属性
          if (element.alt) return element.alt;
          
          return '';
        };
        
        // セレクタの生成
        const generateSelector = () => {
          // ID優先
          if (element.id && !/^\d/.test(element.id)) {
            return `#${CSS.escape(element.id)}`;
          }
          
          // data-testid
          if (element.getAttribute('data-testid')) {
            return `[data-testid="${element.getAttribute('data-testid')}]`;
          }
          
          // name属性
          if (element.name) {
            return `[name="${CSS.escape(element.name)}"]`;
          }
          
          // クラス名
          if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ').filter(c => c);
            if (classes.length > 0) {
              return `.${classes.map(c => CSS.escape(c)).join('.')}`;
            }
          }
          
          // タグ名とインデックス
          const parent = element.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children);
            const sameTagSiblings = siblings.filter(s => s.tagName === element.tagName);
            const index = sameTagSiblings.indexOf(element);
            if (index > 0) {
              return `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
            }
          }
          
          return element.tagName.toLowerCase();
        };
        
        // イベントリスナーの検出
        const getEventHandlers = () => {
          const handlers = [];
          const eventTypes = [
            'click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout',
            'mouseenter', 'mouseleave', 'mousemove', 'contextmenu',
            'keydown', 'keyup', 'keypress',
            'focus', 'blur', 'change', 'input', 'submit', 'reset',
            'scroll', 'resize', 'load', 'unload', 'error',
            'touchstart', 'touchend', 'touchmove', 'touchcancel',
            'drag', 'dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop'
          ];
          
          eventTypes.forEach(type => {
            if (element[`on${type}`] !== null) {
              handlers.push(type);
            }
          });
          
          // data属性のイベント
          if (element.hasAttribute('data-toggle')) handlers.push('toggle');
          if (element.hasAttribute('data-dismiss')) handlers.push('dismiss');
          if (element.hasAttribute('data-slide')) handlers.push('slide');
          
          return handlers;
        };
        
        // フォーム関連情報
        const getFormInfo = () => {
          if (!element.form) return null;
          
          return {
            formId: element.form.id,
            formName: element.form.name,
            formAction: element.form.action,
            formMethod: element.form.method,
            fieldName: element.name,
            fieldType: element.type,
            required: element.required,
            pattern: element.pattern,
            minLength: element.minLength,
            maxLength: element.maxLength
          };
        };
        
        // メディア情報
        const getMediaInfo = () => {
          if (element.tagName === 'VIDEO' || element.tagName === 'AUDIO') {
            return {
              src: element.src || element.querySelector('source')?.src,
              duration: element.duration,
              paused: element.paused,
              muted: element.muted,
              volume: element.volume,
              controls: element.controls,
              autoplay: element.autoplay,
              loop: element.loop
            };
          }
          
          if (element.tagName === 'IMG') {
            return {
              src: element.src,
              alt: element.alt,
              naturalWidth: element.naturalWidth,
              naturalHeight: element.naturalHeight,
              loading: element.loading,
              decoding: element.decoding
            };
          }
          
          return null;
        };
        
        // リンク情報
        const getLinkInfo = () => {
          if (element.tagName === 'A') {
            return {
              href: element.href,
              target: element.target,
              rel: element.rel,
              download: element.download,
              type: element.type,
              isExternal: element.hostname !== window.location.hostname,
              isAnchor: element.href?.startsWith('#'),
              isEmail: element.href?.startsWith('mailto:'),
              isTel: element.href?.startsWith('tel:')
            };
          }
          return null;
        };
        
        // テーブル情報
        const getTableInfo = () => {
          if (element.tagName === 'TABLE') {
            return {
              rows: element.rows.length,
              cols: element.rows[0]?.cells.length || 0,
              hasHeader: !!element.querySelector('thead'),
              hasFooter: !!element.querySelector('tfoot'),
              caption: element.caption?.textContent
            };
          }
          
          if (element.tagName === 'TD' || element.tagName === 'TH') {
            return {
              rowIndex: element.parentElement.rowIndex,
              cellIndex: element.cellIndex,
              colspan: element.colspan,
              rowspan: element.rowspan
            };
          }
          
          return null;
        };
        
        // インタラクティブ性の判定
        const isInteractive = () => {
          const interactiveTags = [
            'A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL',
            'DETAILS', 'SUMMARY', 'DIALOG', 'MENU', 'IFRAME', 'EMBED', 'OBJECT',
            'VIDEO', 'AUDIO', 'CANVAS', 'MAP', 'AREA'
          ];
          
          if (interactiveTags.includes(element.tagName)) return true;
          if (element.hasAttribute('onclick')) return true;
          if (element.hasAttribute('tabindex')) return true;
          if (element.hasAttribute('contenteditable')) return true;
          if (element.hasAttribute('draggable')) return true;
          if (element.getAttribute('role') === 'button') return true;
          if (element.getAttribute('role') === 'link') return true;
          if (style.cursor === 'pointer') return true;
          
          return false;
        };
        
        return {
          // 基本情報
          tagName: element.tagName.toLowerCase(),
          id: element.id || null,
          className: element.className || null,
          
          // コンテンツ
          textContent: getTextContent(),
          innerHTML: element.innerHTML?.substring(0, 500),
          accessibleName: getAccessibleName(),
          
          // 属性
          attributes: Array.from(element.attributes).reduce((acc, attr) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {}),
          
          // 状態
          isVisible: isVisible(),
          isInteractive: isInteractive(),
          isDisabled: element.disabled || false,
          isReadonly: element.readOnly || false,
          isRequired: element.required || false,
          isChecked: element.checked || false,
          isSelected: element.selected || false,
          
          // 位置とサイズ
          position: {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            bottom: Math.round(rect.bottom),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            x: Math.round(rect.x),
            y: Math.round(rect.y)
          },
          
          // スタイル
          styles: {
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            position: style.position,
            zIndex: style.zIndex,
            overflow: style.overflow,
            cursor: style.cursor,
            pointerEvents: style.pointerEvents,
            userSelect: style.userSelect,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            color: style.color,
            backgroundColor: style.backgroundColor,
            borderStyle: style.borderStyle,
            borderWidth: style.borderWidth,
            borderColor: style.borderColor,
            margin: style.margin,
            padding: style.padding
          },
          
          // セレクタ
          selector: generateSelector(),
          xpath: null, // 後で生成可能
          
          // イベント
          eventHandlers: getEventHandlers(),
          
          // 関連情報
          formInfo: getFormInfo(),
          mediaInfo: getMediaInfo(),
          linkInfo: getLinkInfo(),
          tableInfo: getTableInfo(),
          
          // WAI-ARIA
          role: element.getAttribute('role'),
          ariaLabel: element.getAttribute('aria-label'),
          ariaLabelledBy: element.getAttribute('aria-labelledby'),
          ariaDescribedBy: element.getAttribute('aria-describedby'),
          ariaExpanded: element.getAttribute('aria-expanded'),
          ariaHidden: element.getAttribute('aria-hidden'),
          ariaLive: element.getAttribute('aria-live'),
          ariaAtomic: element.getAttribute('aria-atomic'),
          ariaBusy: element.getAttribute('aria-busy'),
          ariaControls: element.getAttribute('aria-controls'),
          ariaFlowTo: element.getAttribute('aria-flowto'),
          ariaHasPopup: element.getAttribute('aria-haspopup'),
          
          // データ属性
          dataAttributes: Object.keys(element.dataset).reduce((acc, key) => {
            acc[key] = element.dataset[key];
            return acc;
          }, {}),
          
          // 親要素情報
          parent: {
            tagName: element.parentElement?.tagName.toLowerCase(),
            id: element.parentElement?.id,
            className: element.parentElement?.className
          },
          
          // 子要素情報
          children: {
            count: element.children.length,
            tags: Array.from(element.children).map(child => child.tagName.toLowerCase())
          }
        };
      }

      /**
       * Shadow DOM内の要素を収集
       */
      function collectFromShadowDOM(root = document) {
        const shadowHosts = root.querySelectorAll('*');
        
        shadowHosts.forEach(host => {
          if (host.shadowRoot) {
            collectedElements.shadowRoots.push({
              host: collectElementInfo(host),
              shadowRoot: true
            });
            
            // Shadow DOM内の要素も収集
            host.shadowRoot.querySelectorAll('*').forEach(element => {
              const info = collectElementInfo(element);
              info.inShadowDOM = true;
              info.shadowHost = host.tagName.toLowerCase();
              
              // 適切なカテゴリに分類
              categorizeElement(element, info);
            });
            
            // 再帰的に探索
            collectFromShadowDOM(host.shadowRoot);
          }
        });
      }

      /**
       * 要素を適切なカテゴリに分類
       */
      function categorizeElement(element, info) {
        const tagName = element.tagName.toLowerCase();
        
        // タグ名別のコレクションに追加
        if (collectedElements[tagName]) {
          collectedElements[tagName].push(info);
        }
        
        // 特殊な分類
        // カスタム要素（Web Components）
        if (tagName.includes('-')) {
          collectedElements.customElements.push(info);
          collectedElements.webComponents.push(info);
        }
        
        // contenteditable要素
        if (element.contentEditable === 'true') {
          collectedElements.contentEditable.push(info);
        }
        
        // ドラッグ可能要素
        if (element.draggable) {
          collectedElements.draggable.push(info);
        }
        
        // インタラクティブ要素
        if (info.isInteractive) {
          collectedElements.interactive.push(info);
        }
        
        // フォーカス可能要素
        if (element.tabIndex >= 0 || info.isInteractive) {
          collectedElements.focusable.push(info);
        }
        
        // クリック可能要素
        if (element.onclick || element.hasAttribute('onclick') || 
            tagName === 'a' || tagName === 'button' || 
            info.eventHandlers.includes('click')) {
          collectedElements.clickable.push(info);
        }
        
        // フォームコントロール
        const formControls = [
          'input', 'select', 'textarea', 'button', 
          'output', 'progress', 'meter', 'datalist'
        ];
        if (formControls.includes(tagName)) {
          collectedElements.formControls.push(info);
        }
      }

      // すべての要素を収集
      document.querySelectorAll('*').forEach(element => {
        const info = collectElementInfo(element);
        categorizeElement(element, info);
      });
      
      // Shadow DOM内の要素も収集
      collectFromShadowDOM();
      
      // 統計情報を追加
      const stats = {
        totalElements: document.querySelectorAll('*').length,
        visibleElements: Object.values(collectedElements).flat().filter(el => el.isVisible).length,
        interactiveElements: collectedElements.interactive.length,
        formElements: collectedElements.formControls.length,
        links: collectedElements.a.length,
        images: collectedElements.img.length,
        videos: collectedElements.video.length,
        tables: collectedElements.table.length,
        customElements: collectedElements.customElements.length,
        shadowDOMs: collectedElements.shadowRoots.length
      };
      
      return {
        elements: collectedElements,
        stats: stats
      };
    });
    
    // iframe内の要素も収集
    const iframeElements = await this.collectFromIframes(page);
    
    // 結果をマージ
    if (iframeElements && iframeElements.elements) {
      Object.keys(iframeElements.elements).forEach(key => {
        if (Array.isArray(elements.elements[key]) && Array.isArray(iframeElements.elements[key])) {
          elements.elements[key].push(...iframeElements.elements[key]);
        }
      });
    }
    
    return elements;
  }

  /**
   * 動的コンテンツが読み込まれるまで待機
   */
  async waitForDynamicContent(page, timeout = 5000) {
    try {
      // ローディングインジケーターが消えるまで待機
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
      const scrollStep = 500;
      const scrollDelay = 300;
      const maxScrolls = 50;
      
      let scrollCount = 0;
      let lastHeight = document.body.scrollHeight;
      
      // 垂直スクロール
      while (scrollCount < maxScrolls) {
        window.scrollBy(0, scrollStep);
        await new Promise(resolve => setTimeout(resolve, scrollDelay));
        
        const newHeight = document.body.scrollHeight;
        if (newHeight === lastHeight) {
          break;
        }
        lastHeight = newHeight;
        scrollCount++;
      }
      
      // トップに戻る
      window.scrollTo(0, 0);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 水平スクロール可能な要素も処理
      const horizontalScrollables = document.querySelectorAll(
        '[style*="overflow-x"], [style*="overflow: auto"], .carousel, .slider, .scrollable'
      );
      
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
      elements: {},
      stats: {}
    };
    
    try {
      const frames = page.frames();
      
      for (const frame of frames) {
        if (frame === page.mainFrame()) continue;
        
        try {
          const frameElements = await frame.evaluate(() => {
            const elements = {};
            
            // 簡易収集（主要な要素のみ）
            ['a', 'button', 'input', 'select', 'textarea', 'form', 'img', 'video'].forEach(tag => {
              elements[tag] = Array.from(document.querySelectorAll(tag)).map(el => ({
                tagName: tag,
                text: el.textContent?.trim() || el.value || '',
                selector: `iframe ${tag}`,
                isIframeElement: true
              }));
            });
            
            return elements;
          });
          
          // マージ
          Object.keys(frameElements).forEach(key => {
            if (!iframeElements.elements[key]) {
              iframeElements.elements[key] = [];
            }
            iframeElements.elements[key].push(...frameElements[key]);
          });
        } catch (e) {
          console.log('iframe収集エラー:', e.message);
        }
      }
    } catch (e) {
      console.log('iframe処理エラー:', e.message);
    }
    
    return iframeElements;
  }

  /**
   * 収集した要素からテストケースを生成
   */
  generateTestCasesFromElements(elements, url) {
    const testCases = [];
    let testIdCounter = 1;
    const processedNames = new Set(); // 重複チェック用
    
    // 統計情報を表示
    if (elements.stats) {
      console.log('\n📊 HTML要素収集統計:');
      console.log(`  総要素数: ${elements.stats.totalElements}`);
      console.log(`  可視要素: ${elements.stats.visibleElements}`);
      console.log(`  インタラクティブ要素: ${elements.stats.interactiveElements}`);
      console.log(`  フォーム要素: ${elements.stats.formElements}`);
      console.log(`  リンク: ${elements.stats.links}`);
      console.log(`  画像: ${elements.stats.images}`);
      console.log(`  動画: ${elements.stats.videos}`);
      console.log(`  テーブル: ${elements.stats.tables}`);
      console.log(`  カスタム要素: ${elements.stats.customElements}`);
      console.log(`  Shadow DOM: ${elements.stats.shadowDOMs}\n`);
    }
    
    // 無意味な要素名をフィルタリングする関数
    const isValidElementName = (name) => {
      if (!name || typeof name !== 'string') return false;
      const trimmed = name.trim();
      // 空、数字のみ、単一文字、特殊文字のみを除外
      if (trimmed === '' || 
          /^\d+$/.test(trimmed) || 
          trimmed.length <= 1 ||
          /^[\u00a5\$\u20ac\u00a3]+\d*$/.test(trimmed) || // 通貨記号
          /^0+$/.test(trimmed)) {
        return false;
      }
      return true;
    };
    
    const els = elements.elements || elements;
    
    // インタラクティブ要素を優先的にテスト
    if (els.interactive) {
      els.interactive.forEach(element => {
        // 意味のある要素のみをテスト対象にする
        const elementName = element.accessibleName || element.textContent || element.value || element.placeholder || element.id || element.name || '';
        const hasValidContent = isValidElementName(elementName);
        
        // 重複チェック
        const testKey = `${element.tagName}_${elementName}`.substring(0, 50);
        
        if (element.isVisible && hasValidContent && !processedNames.has(testKey)) {
          processedNames.add(testKey);
          testCases.push({
            test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
            test_case_name: `${element.tagName || 'element'}_${(element.accessibleName || element.textContent || element.value || element.placeholder || element.id || element.name || 'インタラクション').toString().substring(0, 20).replace(/undefined/g, '')}`,
            test_category: 'インタラクティブ',
            priority: 'high',
            target_url: url,
            selector: element.selector,
            action: this.determineAction(element),
            expected_result: `${element.tagName}要素が正常に動作する`
          });
        }
      });
    }
    
    // フォーム要素のテスト（重複を除外）
    if (els.form) {
      const processedForms = new Set();
      els.form.forEach(form => {
        const formName = form.accessibleName || form.id || 'form';
        const formKey = `form_${formName}`;
        
        // 重複したフォームをスキップ
        if (processedForms.has(formKey)) return;
        processedForms.add(formKey);
        const formTestCase = {
          test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
          test_case_name: `フォーム_${form.accessibleName || form.id || 'フォーム'}送信`,
          test_category: 'フォーム',
          priority: 'high',
          target_url: url,
          test_steps: []
        };
        
        // フォーム内のすべての入力要素を処理
        ['input', 'textarea', 'select'].forEach(tag => {
          if (els[tag]) {
            els[tag].forEach(field => {
              if (field.formInfo && field.formInfo.formId === form.id) {
                formTestCase.test_steps.push({
                  action: 'fill',
                  selector: field.selector,
                  value: this.generateSampleValue(field),
                  description: `${field.accessibleName || field.tagName}に入力`
                });
              }
            });
          }
        });
        
        // 送信ボタンを追加
        if (els.button) {
          const submitButton = els.button.find(btn => 
            btn.attributes?.type === 'submit' && btn.formInfo?.formId === form.id
          );
          if (submitButton) {
            formTestCase.test_steps.push({
              action: 'click',
              selector: submitButton.selector,
              description: 'フォームを送信'
            });
          }
        }
        
        formTestCase.expected_result = 'フォームが正常に送信される';
        testCases.push(formTestCase);
      });
    }
    
    // リンクのテスト
    if (els.a) {
      els.a.slice(0, 30).forEach(link => {
        // 無効なリンクを除外
        const href = link.linkInfo?.href;
        const linkText = link.textContent?.trim() || link.accessibleName?.trim();
        const isValidLink = href && 
                           href !== '#' && 
                           !href.startsWith('javascript:void') &&
                           !href.startsWith('javascript:;') &&
                           href.trim() !== '' &&
                           isValidElementName(linkText);
        
        const linkKey = `link_${linkText}_${href}`; // hrefも含めて重複チェック
        
        if (isValidLink && link.isVisible && !processedNames.has(linkKey)) {
          processedNames.add(linkKey);
          // リンクテキストが空または"リンク"の場合はスキップ
          if (!linkText || linkText === 'リンク') return;
          
          testCases.push({
            test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
            test_case_name: `リンク_${linkText.substring(0, 30)}`,
            test_category: 'リンク',
            priority: link.linkInfo.isExternal ? 'low' : 'medium',
            target_url: url,
            selector: link.selector,
            action: 'click',
            expected_result: `${link.linkInfo.href}へ遷移する`
          });
        }
      });
    }
    
    // ボタンのテスト
    if (els.button) {
      els.button.forEach(button => {
        // 無効なボタンや空のボタンを除外
        const buttonText = button.textContent?.trim() || button.value?.trim() || button.accessibleName?.trim();
        const hasValidText = isValidElementName(buttonText);
        const buttonKey = `button_${buttonText}`;
        
        // ページネーションボタンは除外（"1 of 3"など）
        const isPaginationButton = /^\d+\s+of\s+\d+$/.test(buttonText);
        
        if (button.isVisible && !button.isDisabled && hasValidText && 
            !isPaginationButton && !processedNames.has(buttonKey)) {
          processedNames.add(buttonKey);
          testCases.push({
            test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
            test_case_name: `ボタン_${(button.textContent || button.value || button.accessibleName || 'ボタン').toString().substring(0, 30).replace(/undefined/g, '')}クリック`,
            test_category: 'ボタン',
            priority: 'medium',
            target_url: url,
            selector: button.selector,
            action: 'click',
            expected_result: 'ボタンがクリックされ、期待される動作が実行される'
          });
        }
      });
    }
    
    // メディア要素のテスト
    if (els.video) {
      els.video.forEach(video => {
        if (video.isVisible) {
          testCases.push({
            test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
            test_case_name: `ビデオ_${(video.mediaInfo?.src || 'ビデオ').toString().substring(0, 30).replace(/undefined/g, '')}再生`,
            test_category: 'メディア',
            priority: 'low',
            target_url: url,
            selector: video.selector,
            action: 'play',
            expected_result: 'ビデオが正常に再生される'
          });
        }
      });
    }
    
    // テーブルのテスト
    if (els.table) {
      els.table.forEach(table => {
        if (table.isVisible && table.tableInfo) {
          testCases.push({
            test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
            test_case_name: `テーブル_${table.tableInfo.caption || 'データテーブル'}確認`,
            test_category: 'テーブル',
            priority: 'low',
            target_url: url,
            selector: table.selector,
            action: 'verify',
            expected_result: `テーブル（${table.tableInfo.rows}行×${table.tableInfo.cols}列）が正しく表示される`
          });
        }
      });
    }
    
    // ダイアログのテスト
    if (els.dialog) {
      els.dialog.forEach(dialog => {
        testCases.push({
          test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
          test_case_name: `ダイアログ_${dialog.accessibleName || 'ダイアログ'}表示`,
          test_category: 'ダイアログ',
          priority: 'medium',
          target_url: url,
          selector: dialog.selector,
          action: 'open',
          expected_result: 'ダイアログが正しく表示される'
        });
      });
    }
    
    // details/summaryのテスト
    if (els.details) {
      els.details.forEach(details => {
        if (details.isVisible) {
          testCases.push({
            test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
            test_case_name: `詳細_${(details.textContent || details.accessibleName || '詳細').toString().substring(0, 30).replace(/undefined/g, '')}開閉`,
            test_category: '詳細',
            priority: 'low',
            target_url: url,
            selector: details.selector,
            action: 'toggle',
            expected_result: '詳細セクションが開閉される'
          });
        }
      });
    }
    
    // カスタム要素のテスト
    if (els.customElements) {
      els.customElements.slice(0, 10).forEach(element => {
        if (element.isVisible && element.isInteractive) {
          testCases.push({
            test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
            test_case_name: `カスタム要素_${element.tagName}`,
            test_category: 'Web Components',
            priority: 'medium',
            target_url: url,
            selector: element.selector,
            action: this.determineAction(element),
            expected_result: `${element.tagName}カスタム要素が正常に動作する`
          });
        }
      });
    }
    
    // Shadow DOMのテスト
    if (els.shadowRoots) {
      els.shadowRoots.forEach(shadow => {
        testCases.push({
          test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
          test_case_name: `Shadow DOM_${shadow.host?.tagName || 'Shadow'}`,
          test_category: 'Shadow DOM',
          priority: 'low',
          target_url: url,
          selector: shadow.host?.selector,
          action: 'verify',
          expected_result: 'Shadow DOM内のコンテンツが正しく表示される'
        });
      });
    }
    
    // contentEditableのテスト
    if (els.contentEditable) {
      els.contentEditable.forEach(element => {
        if (element.isVisible) {
          testCases.push({
            test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
            test_case_name: `編集可能領域_${element.accessibleName || '編集領域'}`,
            test_category: 'ContentEditable',
            priority: 'medium',
            target_url: url,
            selector: element.selector,
            action: 'edit',
            test_data: 'テスト編集テキスト',
            expected_result: 'コンテンツが編集可能で、テキストが入力される'
          });
        }
      });
    }
    
    // セキュリティテストの追加（最初のテキスト入力フィールドに対して）
    const textInputs = (els.input || []).filter(input => 
      ['text', 'email', 'search', 'url', 'tel'].includes(input.attributes?.type) ||
      !input.attributes?.type
    );
    
    if (textInputs.length > 0) {
      const targetInput = textInputs[0];
      
      // XSSテスト
      TEST_DATA.invalid.xss.forEach((payload, index) => {
        testCases.push({
          test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
          test_case_name: `セキュリティ_XSS攻撃テスト_パターン${index + 1}`,
          test_category: 'セキュリティ',
          test_type: 'security',
          priority: 'critical',
          target_url: url,
          selector: targetInput.selector,
          action: 'fill',
          value: payload, // 実際のペイロードをvalueに設定
          test_data: {
            payload: payload,
            attack_type: 'XSS',
            pattern: `パターン${index + 1}/${TEST_DATA.invalid.xss.length}`
          },
          expected_result: `XSS攻撃が防御される（スクリプトが実行されない）\nペイロード: ${payload}`
        });
      });
      
      // SQLインジェクションテスト
      TEST_DATA.invalid.sql.forEach((payload, index) => {
        testCases.push({
          test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
          test_case_name: `セキュリティ_SQLインジェクション攻撃テスト_パターン${index + 1}`,
          test_category: 'セキュリティ',
          test_type: 'security',
          priority: 'critical',
          target_url: url,
          selector: targetInput.selector,
          action: 'fill',
          value: payload, // 実際のペイロードをvalueに設定
          test_data: {
            payload: payload,
            attack_type: 'SQL_INJECTION',
            pattern: `パターン${index + 1}/${TEST_DATA.invalid.sql.length}`
          },
          expected_result: `SQLインジェクション攻撃が防御される\nペイロード: ${payload}`
        });
      });
    }
    
    return testCases;
  }

  /**
   * 要素に応じたアクションを決定
   */
  determineAction(element) {
    const tagName = element.tagName.toLowerCase();
    const type = element.attributes?.type;
    
    if (tagName === 'a' || tagName === 'button') return 'click';
    if (tagName === 'input') {
      if (type === 'checkbox' || type === 'radio') return 'check';
      if (type === 'submit' || type === 'button') return 'click';
      return 'fill';
    }
    if (tagName === 'select') return 'select';
    if (tagName === 'textarea') return 'fill';
    if (tagName === 'details') return 'toggle';
    if (tagName === 'dialog') return 'open';
    if (tagName === 'video' || tagName === 'audio') return 'play';
    if (element.attributes?.contenteditable === 'true') return 'edit';
    
    return 'click';
  }

  /**
   * フィールドに応じたサンプル値を生成
   */
  generateSampleValue(field) {
    const type = field.attributes?.type;
    const name = field.attributes?.name?.toLowerCase() || '';
    const placeholder = field.attributes?.placeholder?.toLowerCase() || '';
    
    // タイプ別のサンプルデータ
    if (type === 'email') return 'test@example.com';
    if (type === 'tel') return '090-1234-5678';
    if (type === 'url') return 'https://example.com';
    if (type === 'number') return '100';
    if (type === 'date') return '2024-01-01';
    if (type === 'time') return '12:00';
    if (type === 'datetime-local') return '2024-01-01T12:00';
    if (type === 'month') return '2024-01';
    if (type === 'week') return '2024-W01';
    if (type === 'password') return 'TestPassword123!';
    if (type === 'color') return '#ff0000';
    if (type === 'range') return '50';
    if (type === 'search') return 'テスト検索';
    
    // textarea
    if (field.tagName === 'textarea') {
      return 'これはテストメッセージです。\n複数行のテキストを入力できます。';
    }
    
    // 名前やプレースホルダーから推測
    if (name.includes('name') || placeholder.includes('名前')) return '山田太郎';
    if (name.includes('email') || placeholder.includes('メール')) return 'test@example.com';
    if (name.includes('phone') || placeholder.includes('電話')) return '090-1234-5678';
    if (name.includes('address') || placeholder.includes('住所')) return '東京都渋谷区1-2-3';
    if (name.includes('message') || placeholder.includes('メッセージ')) {
      return 'テストメッセージです。よろしくお願いします。';
    }
    
    // デフォルト
    return 'テストデータ';
  }
}