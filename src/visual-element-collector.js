// 画面に実際に表示されている要素のみを収集する機能

import { TEST_DATA } from './ai-test-prompts.js';
import { ECCubeAnalyzer } from './eccube-analyzer.js';

export class VisualElementCollector {
  constructor() {
    this.eccubeAnalyzer = new ECCubeAnalyzer();
  }
  
  /**
   * ページ上のすべての可視要素を収集（座標順）
   */
  async collectAllVisibleElements(page) {
    // EC-CUBE検出と専用解析
    try {
      const pageType = await this.eccubeAnalyzer.detectPageType(page);
      if (pageType !== this.eccubeAnalyzer.pageTypes.UNKNOWN) {
        console.log(`EC-CUBE ${pageType} ページを検出。専用解析を実行します。`);
        const eccubeElements = await this.eccubeAnalyzer.collectECCubeElements(page);
        
        // EC-CUBE要素を通常の要素収集結果とマージ
        const normalElements = await this._collectVisibleElements(page);
        return this._mergeECCubeElements(normalElements, eccubeElements);
      }
    } catch (error) {
      console.log('EC-CUBE検出スキップ:', error.message);
    }
    
    // 通常の要素収集
    return await this._collectVisibleElements(page);
  }

  /**
   * EC-CUBE要素と通常要素をマージ
   */
  _mergeECCubeElements(normalElements, eccubeElements) {
    const merged = { ...normalElements };
    
    // EC-CUBE固有情報を追加
    merged.eccube = {
      pageType: eccubeElements.pageType,
      isAdmin: eccubeElements.isAdmin,
      structure: eccubeElements.structure,
      products: eccubeElements.products,
      scenarios: this.eccubeAnalyzer.generateECCubeTestScenarios(eccubeElements.pageType, eccubeElements)
    };
    
    // EC-CUBE特有のフォーム要素を追加
    if (eccubeElements.forms && eccubeElements.forms.length > 0) {
      merged.forms = [...(merged.forms || []), ...eccubeElements.forms];
    }
    
    // EC-CUBEナビゲーション要素を追加
    if (eccubeElements.navigation && eccubeElements.navigation.length > 0) {
      merged.navigationItems = [...(merged.navigationItems || []), ...eccubeElements.navigation];
    }
    
    // EC-CUBEアクション要素を追加
    if (eccubeElements.actions && eccubeElements.actions.length > 0) {
      merged.buttons = [...(merged.buttons || []), ...eccubeElements.actions];
    }
    
    return merged;
  }

  /**
   * 通常の可視要素収集（既存のcollectAllVisibleElements内容）
   */
  async _collectVisibleElements(page) {
    return await page.evaluate(() => {
      const elements = {
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
        accordions: []
      };

      /**
       * 要素が実際に表示されているかチェック
       */
      function isElementVisible(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        
        // 画面外の要素は除外
        if (rect.width === 0 || rect.height === 0) return false;
        if (rect.top > window.innerHeight || rect.bottom < 0) return false;
        if (rect.left > window.innerWidth || rect.right < 0) return false;
        
        // スタイルチェック
        const style = window.getComputedStyle(element);
        if (style.display === 'none') return false;
        if (style.visibility === 'hidden') return false;
        if (style.opacity === '0') return false;
        
        // 親要素が非表示の場合も除外
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
          const parentStyle = window.getComputedStyle(parent);
          if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
            return false;
          }
          parent = parent.parentElement;
        }
        
        return true;
      }

      /**
       * ラベルテキストを取得
       */
      function getLabelText(element) {
        // label要素を探す
        if (element.id) {
          const label = document.querySelector(`label[for="${element.id}"]`);
          if (label) return label.textContent.trim();
        }
        
        // 親要素がlabelの場合
        const parentLabel = element.closest('label');
        if (parentLabel) {
          return parentLabel.textContent.trim().replace(element.value || '', '').trim();
        }
        
        // aria-label属性
        if (element.getAttribute('aria-label')) {
          return element.getAttribute('aria-label');
        }
        
        // placeholder属性
        if (element.placeholder) {
          return element.placeholder;
        }
        
        // 近くのテキスト要素を探す
        const previousSibling = element.previousElementSibling;
        if (previousSibling && previousSibling.tagName === 'LABEL') {
          return previousSibling.textContent.trim();
        }
        
        return '';
      }

      /**
       * 入力フィールドの内容から適切なサンプルデータを生成
       */
      function generateSampleData(element, labelText, contextText) {
        const name = (element.name || '').toLowerCase();
        const id = (element.id || '').toLowerCase();
        const type = element.type || 'text';
        const placeholder = element.placeholder || '';
        const placeholderLower = placeholder.toLowerCase();
        const label = labelText.toLowerCase();
        const context = (contextText || '').toLowerCase();
        const allText = `${name} ${id} ${placeholderLower} ${label} ${context}`;
        
        // プレースホルダーの高度な解析
        if (placeholder) {
          // 1. 具体例が含まれている場合は抽出
          const examplePatterns = [
            /(?:例|e\.?g\.?|ex(?:ample)?|sample)?\s*[:：]?\s*['"]?([^'"]+)['"]?/i,
            /\(([^)]+)\)/,  // 括弧内の例: "(田中太郎)"
            /「([^」]+)」/,  // 日本語括弧: 「田中太郎」
          ];
          
          for (const pattern of examplePatterns) {
            const match = placeholder.match(pattern);
            if (match && match[1] && match[1].length > 2) {
              const extracted = match[1].trim();
              // 抽出した内容が説明文でなく実際の例であることを確認
              if (!extracted.includes('入力') && !extracted.includes('記入') && 
                  !extracted.includes('please') && !extracted.includes('enter')) {
                return extracted;
              }
            }
          }
          
          // 2. 具体的なフォーマットパターンの検出と生成
          // メールアドレス
          if (placeholder.match(/@|メール|email|mail/i)) {
            const emailMatch = placeholder.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (emailMatch) return emailMatch[1];
            // ドメインの指定があれば使用
            if (placeholder.includes('@example.com')) return 'test.user@example.com';
            if (placeholder.includes('@gmail.com')) return 'testuser2024@gmail.com';
            if (placeholder.includes('@')) {
              const domain = placeholder.split('@')[1]?.trim();
              if (domain) return `testuser@${domain}`;
            }
            return 'test.user@example.com';
          }
          
          // 電話番号（フォーマットに応じて生成）
          if (placeholder.match(/電話|tel|phone|携帯/i)) {
            // ハイフンありフォーマット
            if (placeholder.includes('-')) {
              if (placeholder.match(/\d{3}-\d{4}-\d{4}/)) return '090-1234-5678';
              if (placeholder.match(/\d{2}-\d{4}-\d{4}/)) return '03-1234-5678';
            }
            // ハイフンなしフォーマット
            if (placeholder.match(/\d{10,11}/)) {
              const phoneMatch = placeholder.match(/(\d{10,11})/);
              if (phoneMatch) return phoneMatch[1];
            }
            // 携帯電話
            if (placeholder.includes('携帯') || placeholder.includes('mobile')) {
              return '090-1234-5678';
            }
            // 固定電話
            if (placeholder.includes('固定')) {
              return '03-1234-5678';
            }
            return '090-1234-5678';
          }
          
          // URL（プロトコル含む）
          if (placeholder.match(/https?:\/\/|url|website|サイト/i)) {
            const urlMatch = placeholder.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) return urlMatch[1];
            if (placeholder.includes('https://')) return 'https://www.example.com';
            return 'https://www.example-site.com';
          }
          
          // 日付（フォーマットを保持）
          if (placeholder.match(/\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2}|yyyy|date|日付/i)) {
            const today = new Date();
            // 指定フォーマットがある場合
            if (placeholder.includes('yyyy/mm/dd')) {
              return `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
            }
            if (placeholder.includes('yyyy-mm-dd')) {
              return today.toISOString().split('T')[0];
            }
            if (placeholder.includes('年')) {
              return `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
            }
            // 具体的な日付例がある場合
            const dateMatch = placeholder.match(/(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/);
            if (dateMatch) return dateMatch[1];
            return today.toISOString().split('T')[0];
          }
          
          // 郵便番号（フォーマット保持）
          if (placeholder.match(/〒|郵便|zip|postal/i)) {
            if (placeholder.match(/\d{3}-\d{4}/)) {
              const zipMatch = placeholder.match(/(\d{3}-\d{4})/);
              if (zipMatch) return zipMatch[1];
              return '100-0001';
            }
            if (placeholder.match(/\d{7}/)) {
              return '1000001';
            }
            return '100-0001';
          }
          
          // 数値範囲の指定
          if (placeholder.match(/\d+\s*[-~～]\s*\d+/)) {
            const rangeMatch = placeholder.match(/(\d+)\s*[-~～]\s*(\d+)/);
            if (rangeMatch) {
              const min = parseInt(rangeMatch[1]);
              const max = parseInt(rangeMatch[2]);
              return String(Math.floor((min + max) / 2));
            }
          }
        }
        
        // 3. プレースホルダーのセマンティック解析による生成
        // 名前関連
        if (placeholderLower.match(/名前|氏名|name|姓名/)) {
          // カタカナ指定
          if (placeholderLower.match(/カタカナ|カナ|kana/)) {
            if (placeholderLower.includes('姓') || placeholderLower.includes('セイ')) return 'ヤマダ';
            if (placeholderLower.includes('名') || placeholderLower.includes('メイ')) return 'タロウ';
            if (placeholderLower.includes('フル')) return 'ヤマダタロウ';
            return 'ヤマダ タロウ';
          }
          // ひらがな指定
          if (placeholderLower.match(/ひらがな|hiragana/)) {
            if (placeholderLower.includes('姓')) return 'やまだ';
            if (placeholderLower.includes('名')) return 'たろう';
            return 'やまだ たろう';
          }
          // ローマ字指定
          if (placeholderLower.match(/ローマ字|roma|alphabet/)) {
            if (placeholderLower.includes('姓') || placeholderLower.includes('last')) return 'Yamada';
            if (placeholderLower.includes('名') || placeholderLower.includes('first')) return 'Taro';
            return 'Taro Yamada';
          }
          // 漢字（デフォルト）
          if (placeholderLower.includes('姓') || placeholderLower.includes('last')) return '山田';
          if (placeholderLower.includes('名') || placeholderLower.includes('first')) return '太郎';
          if (placeholderLower.includes('フル') || placeholderLower.includes('full')) return '山田太郎';
          return '山田太郎';
        }
        
        // 検索フィールドの最適化
        if (placeholderLower.match(/検索|search|探す|find/)) {
          // コンテキストに応じた検索ワード生成
          if (placeholderLower.includes('商品') || placeholderLower.includes('product')) {
            return 'ノートパソコン';
          }
          if (placeholderLower.includes('店舗') || placeholderLower.includes('shop')) {
            return '東京駅';
          }
          if (placeholderLower.includes('地域') || placeholderLower.includes('area')) {
            return '渋谷区';
          }
          if (placeholderLower.includes('キーワード') || placeholderLower.includes('keyword')) {
            return 'テスト検索';
          }
          // プレースホルダーから検索対象を抽出
          const searchTarget = placeholder
            .replace(/を?検索/g, '')
            .replace(/search for/gi, '')
            .replace(/探す/g, '')
            .replace(/入力/g, '')
            .trim();
          if (searchTarget && searchTarget.length > 0 && searchTarget.length < 20) {
            // 検索対象に応じたサンプルを生成
            if (searchTarget.includes('商品')) return 'iPhone 15';
            if (searchTarget.includes('場所')) return '東京タワー';
            if (searchTarget.includes('人')) return '山田太郎';
            return searchTarget + ' サンプル';
          }
          return 'テスト検索キーワード';
        }
        
        // 住所関連の詳細入力
        if (placeholderLower.match(/住所|address|所在地/)) {
          if (placeholderLower.includes('都道府県') || placeholderLower.includes('prefecture')) {
            return '東京都';
          }
          if (placeholderLower.includes('市区町村') || placeholderLower.includes('city')) {
            return '千代田区';
          }
          if (placeholderLower.includes('番地') || placeholderLower.includes('street')) {
            return '千代田1-1-1';
          }
          if (placeholderLower.includes('建物') || placeholderLower.includes('building')) {
            return 'テストビル5F';
          }
          if (placeholderLower.includes('マンション') || placeholderLower.includes('apartment')) {
            return 'テストマンション101号室';
          }
          return '東京都千代田区千代田1-1-1';
        }
        
        // 会社・組織名
        if (placeholderLower.match(/会社|企業|組織|company|organization|corp/)) {
          if (placeholderLower.includes('カナ')) return 'カブシキガイシャテスト';
          if (placeholderLower.includes('英語') || placeholderLower.includes('english')) {
            return 'Test Corporation Ltd.';
          }
          return '株式会社テスト';
        }
        
        // 年齢
        if (placeholderLower.match(/年齢|age|歳/)) {
          // 範囲指定がある場合
          if (element.min && element.max) {
            return String(Math.floor((parseInt(element.min) + parseInt(element.max)) / 2));
          }
          return '30';
        }
        
        // 金額・価格
        if (placeholderLower.match(/金額|価格|値段|price|amount|円/)) {
          if (placeholderLower.includes('万')) return '100000';
          if (placeholderLower.includes('千')) return '5000';
          if (element.min && element.max) {
            return String(Math.floor((parseInt(element.min) + parseInt(element.max)) / 2));
          }
          return '10000';
        }
        
        // ID・コード類
        if (placeholderLower.match(/id|code|番号|number/)) {
          if (placeholderLower.includes('社員') || placeholderLower.includes('employee')) {
            return 'EMP001234';
          }
          if (placeholderLower.includes('会員') || placeholderLower.includes('member')) {
            return 'MEM2024001';
          }
          if (placeholderLower.includes('注文') || placeholderLower.includes('order')) {
            return 'ORD-20240001';
          }
          if (placeholderLower.includes('商品') || placeholderLower.includes('product')) {
            return 'PRD-12345';
          }
          return 'TEST-001';
        }
        
        // メールアドレス
        if (type === 'email' || allText.includes('email') || allText.includes('メール')) {
          return 'test@example.com';
        }
        
        // パスワード
        if (type === 'password' || allText.includes('password') || allText.includes('パスワード')) {
          return 'Test1234!';
        }
        
        // 電話番号
        if (type === 'tel' || allText.includes('tel') || allText.includes('phone') || 
            allText.includes('電話') || allText.includes('携帯')) {
          return '090-1234-5678';
        }
        
        // 郵便番号
        if (allText.includes('zip') || allText.includes('postal') || allText.includes('郵便番号')) {
          return '123-4567';
        }
        
        // 住所
        if (allText.includes('address') || allText.includes('住所')) {
          return '東京都渋谷区1-2-3';
        }
        
        // 名前
        if (allText.includes('name') || allText.includes('名前') || allText.includes('氏名')) {
          if (allText.includes('last') || allText.includes('姓') || allText.includes('苗字')) {
            return '山田';
          }
          if (allText.includes('first') || allText.includes('名')) {
            return '太郎';
          }
          return '山田太郎';
        }
        
        // 年齢
        if (allText.includes('age') || allText.includes('年齢')) {
          return '30';
        }
        
        // URL
        if (type === 'url' || allText.includes('url') || allText.includes('website')) {
          return 'https://example.com';
        }
        
        // 日付
        if (type === 'date' || allText.includes('date') || allText.includes('日付')) {
          return new Date().toISOString().split('T')[0];
        }
        
        // 数値
        if (type === 'number' || allText.includes('number') || allText.includes('数')) {
          if (element.min && element.max) {
            return String(Math.floor((parseFloat(element.min) + parseFloat(element.max)) / 2));
          }
          return '10';
        }
        
        // 検索
        if (type === 'search' || allText.includes('search') || allText.includes('検索')) {
          return 'テスト検索';
        }
        
        // その他のテキスト
        return 'テストデータ';
      }

      /**
       * 要素情報を収集
       */
      function collectElementInfo(element) {
        const rect = element.getBoundingClientRect();
        const labelText = getLabelText(element);
        
        // リンクテキストの取得（Aタグ用の特別処理）
        let linkText = '';
        if (element.tagName === 'A' || element.tagName === 'a') {  // 大文字小文字両方対応
          // 画像リンクの場合
          const img = element.querySelector('img');
          if (img) {
            linkText = img.alt || img.title || '';
          }
          
          // アイコンフォント（FontAwesome等）の場合
          const icon = element.querySelector('i, svg, [class*="icon"], [class*="fa-"]');
          if (icon && !linkText) {
            // アイコンの場合はaria-labelやdata属性を確認
            linkText = icon.getAttribute('aria-label') || 
                      icon.getAttribute('title') ||
                      element.getAttribute('aria-label') ||
                      element.getAttribute('title') || '';
          }
          
          // テキストノードを直接取得（子要素のテキストも含む）
          if (!linkText) {
            // innerTextを使用して見た目通りのテキストを取得
            linkText = element.innerText?.trim() || '';
            
            // innerTextが空の場合はtextContentを試す
            if (!linkText) {
              linkText = element.textContent?.trim() || '';
            }
            
            // それでも空の場合はtitle属性やaria-label属性を確認
            if (!linkText) {
              linkText = element.title || 
                        element.getAttribute('aria-label') || 
                        element.getAttribute('data-title') ||
                        element.getAttribute('data-text') ||
                        element.getAttribute('data-tooltip') || '';
            }
            
            // 最後の手段：hrefから推測
            if (!linkText && element.href) {
              const urlParts = element.href.split('/').filter(p => p);
              const lastPart = urlParts[urlParts.length - 1];
              if (lastPart && !lastPart.includes('.')) {
                // URLの最後の部分を人間が読める形式に変換
                linkText = lastPart
                  .replace(/[-_]/g, ' ')
                  .replace(/\b\w/g, l => l.toUpperCase());
              } else {
                // ファイル名の場合は拡張子を除去
                linkText = lastPart ? lastPart.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') : 'リンク';
              }
            }
            
            // それでも空の場合はデフォルト値
            if (!linkText) {
              linkText = 'リンク';
            }
          }
        }
        
        // リンク先URLの取得
        let targetUrl = null;
        if (element.href) {
          targetUrl = element.href; // 絶対URLを取得
        } else if (element.onclick || element.getAttribute('onclick')) {
          // onclickハンドラーから遷移先を推測
          const onclickStr = element.getAttribute('onclick') || '';
          const locationMatch = onclickStr.match(/(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/);
          const openMatch = onclickStr.match(/window\.open\s*\(['"]([^'"]+)['"]/);
          if (locationMatch) {
            targetUrl = new URL(locationMatch[1], window.location.href).href;
          } else if (openMatch) {
            targetUrl = new URL(openMatch[1], window.location.href).href;
          }
        } else if (element.tagName === 'BUTTON' || element.type === 'submit') {
          // フォームのaction属性を確認
          const form = element.closest('form');
          if (form && form.action) {
            targetUrl = form.action;
          }
        }
        
        // 前後のコンテキストを取得（フォームフィールド用）
        let contextText = '';
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
          // 親要素のテキストを取得
          const parent = element.parentElement;
          if (parent) {
            contextText = parent.textContent?.trim() || '';
          }
          
          // 前後の兄弟要素のテキストも含める
          const prevSibling = element.previousElementSibling;
          const nextSibling = element.nextElementSibling;
          if (prevSibling && prevSibling.textContent) {
            contextText = prevSibling.textContent.trim() + ' ' + contextText;
          }
          if (nextSibling && nextSibling.textContent) {
            contextText = contextText + ' ' + nextSibling.textContent.trim();
          }
          
          // フォームのラベルやfieldset legendも確認
          const fieldset = element.closest('fieldset');
          if (fieldset) {
            const legend = fieldset.querySelector('legend');
            if (legend) {
              contextText = legend.textContent.trim() + ' ' + contextText;
            }
          }
        }
        
        return {
          tagName: element.tagName.toLowerCase(),
          type: element.type || (element.tagName === 'TEXTAREA' ? 'textarea' : element.tagName.toLowerCase()),
          id: element.id || null,
          name: element.name || null,
          className: element.className || null,
          text: linkText || element.textContent?.trim().substring(0, 100) || '',
          linkText: linkText, // Aタグ専用のリンクテキスト
          value: element.value || '',
          href: element.href || null,
          targetUrl: targetUrl, // 実際の遷移先URL
          src: element.src || null,
          alt: element.alt || null,
          title: element.title || null,
          placeholder: element.placeholder || null,
          required: element.required || false,
          disabled: element.disabled || false,
          readonly: element.readOnly || false,
          checked: element.checked || false,
          selected: element.selected || false,
          maxLength: element.maxLength > 0 ? element.maxLength : null,
          minLength: element.minLength > 0 ? element.minLength : null,
          min: element.min || null,
          max: element.max || null,
          pattern: element.pattern || null,
          labelText: labelText,
          contextText: contextText, // 前後のコンテキスト
          sampleData: null,
          position: {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            bottom: Math.round(rect.bottom),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          selector: element.id ? `#${element.id}` :
                   element.name ? `[name="${element.name}"]` :
                   element.className ? `.${(typeof element.className === 'string' ? element.className : element.className.baseVal || '').split(' ')[0]}` :
                   `${element.tagName.toLowerCase()}`,
          isVisible: true,
          role: element.getAttribute('role') || null,
          ariaLabel: element.getAttribute('aria-label') || null
        };
      }

      // すべての対話可能な要素を収集
      const allSelectors = [
        // リンク
        'a[href]',
        // ボタン
        'button',
        'input[type="submit"]',
        'input[type="button"]',
        'input[type="reset"]',
        '[role="button"]',
        // 入力フィールド
        'input:not([type="hidden"])',
        'textarea',
        'select',
        // 画像
        'img',
        // クリック可能な要素
        '[onclick]',
        '[ng-click]',
        '[data-click]',
        '[v-on\\:click]',
        // その他のインタラクティブ要素
        '[contenteditable="true"]',
        '[tabindex]:not([tabindex="-1"])',
        // ラベル
        'label'
      ];

      // 各要素を収集
      document.querySelectorAll(allSelectors.join(', ')).forEach(element => {
        // 表示されていない要素はスキップ
        if (!isElementVisible(element)) return;
        
        const elementInfo = collectElementInfo(element);
        
        // 要素タイプごとに分類
        if (element.tagName === 'A' || element.tagName === 'a') {
          // デバッグ: リンクテキストが空の場合は警告
          if (!elementInfo.text && !elementInfo.linkText) {
            console.warn('⚠️ 空のリンクテキスト検出:', {
              href: elementInfo.href,
              selector: elementInfo.selector,
              hasImage: element.querySelector('img') ? true : false,
              innerHTML: element.innerHTML.substring(0, 100)
            });
            // 空の場合はURLから推測したテキストを使用
            if (!elementInfo.text && elementInfo.href) {
              const urlParts = elementInfo.href.split('/').filter(p => p);
              const lastPart = urlParts[urlParts.length - 1];
              if (lastPart && !lastPart.includes('.')) {
                elementInfo.text = lastPart.replace(/[-_]/g, ' ');
                elementInfo.linkText = elementInfo.text;
              }
            }
          }
          elements.links.push(elementInfo);
        } else if (element.tagName === 'BUTTON' || 
                   element.type === 'submit' || 
                   element.type === 'button' ||
                   element.getAttribute('role') === 'button') {
          elementInfo.buttonText = element.textContent?.trim() || element.value || '';
          elements.buttons.push(elementInfo);
        } else if (element.tagName === 'IMG') {
          elements.images.push(elementInfo);
        } else if (element.tagName === 'INPUT') {
          switch (element.type) {
            case 'checkbox':
              elements.checkboxes.push(elementInfo);
              break;
            case 'radio':
              elements.radios.push(elementInfo);
              break;
            default:
              elementInfo.sampleData = generateSampleData(element, elementInfo.labelText, elementInfo.contextText);
              elements.inputs.push(elementInfo);
              break;
          }
        } else if (element.tagName === 'TEXTAREA') {
          elementInfo.sampleData = generateSampleData(element, elementInfo.labelText, elementInfo.contextText);
          elements.textareas.push(elementInfo);
        } else if (element.tagName === 'SELECT') {
          // オプションを収集
          elementInfo.options = Array.from(element.options || []).map(opt => ({
            value: opt.value,
            text: opt.text,
            selected: opt.selected
          }));
          elements.selects.push(elementInfo);
        } else if (element.tagName === 'LABEL') {
          elements.labels.push(elementInfo);
        }
      });

      // フッターのリンクを特定
      const footer = document.querySelector('footer') || document.querySelector('[role="contentinfo"]');
      if (footer) {
        footer.querySelectorAll('a[href]').forEach(link => {
          if (isElementVisible(link)) {
            const linkInfo = collectElementInfo(link);
            linkInfo.isFooter = true;
            elements.footerLinks.push(linkInfo);
          }
        });
      }

      // ナビゲーション要素を特定
      const navs = document.querySelectorAll('nav, [role="navigation"]');
      navs.forEach(nav => {
        nav.querySelectorAll('a[href]').forEach(link => {
          if (isElementVisible(link)) {
            const linkInfo = collectElementInfo(link);
            linkInfo.isNavigation = true;
            elements.navigationItems.push(linkInfo);
          }
        });
      });

      // フォーム要素をグループ化
      document.querySelectorAll('form').forEach(form => {
        if (isElementVisible(form)) {
          const formInfo = {
            id: form.id || null,
            name: form.name || null,
            action: form.action || null,
            method: form.method || 'GET',
            fields: []
          };
          
          form.querySelectorAll('input, textarea, select').forEach(field => {
            if (isElementVisible(field)) {
              const fieldInfo = collectElementInfo(field);
              fieldInfo.sampleData = generateSampleData(field, fieldInfo.labelText, fieldInfo.contextText);
              formInfo.fields.push(fieldInfo);
            }
          });
          
          if (formInfo.fields.length > 0) {
            elements.forms.push(formInfo);
          }
        }
      });

      // タブ要素を検出
      // Bootstrap, Material UI, その他一般的なタブパターン
      const tabSelectors = [
        '[role="tab"]',
        '.nav-tabs a',
        '.nav-pills a',
        '.tab-button',
        '[data-toggle="tab"]',
        '[data-bs-toggle="tab"]',
        '.mat-tab-label',
        '.tabs button',
        '.tab-link',
        '[aria-selected]'
      ];
      
      tabSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(tab => {
          if (isElementVisible(tab)) {
            const tabInfo = collectElementInfo(tab);
            
            // タブのターゲットを特定
            const tabTarget = tab.getAttribute('href') || 
                            tab.getAttribute('data-target') || 
                            tab.getAttribute('data-bs-target') ||
                            tab.getAttribute('aria-controls');
            
            if (tabTarget || tab.getAttribute('role') === 'tab') {
              tabInfo.isTab = true;
              tabInfo.tabTarget = tabTarget;
              tabInfo.tabText = tab.textContent?.trim() || '';
              tabInfo.isActive = tab.classList.contains('active') || 
                               tab.getAttribute('aria-selected') === 'true';
              elements.tabs.push(tabInfo);
            }
          }
        });
      });

      // アコーディオン要素を検出
      const accordionSelectors = [
        '[data-toggle="collapse"]',
        '[data-bs-toggle="collapse"]',
        '.accordion-header',
        '.accordion-button',
        '.collapse-trigger',
        '[aria-expanded]'
      ];
      
      accordionSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(accordion => {
          if (isElementVisible(accordion)) {
            const accordionInfo = collectElementInfo(accordion);
            const target = accordion.getAttribute('href') || 
                         accordion.getAttribute('data-target') || 
                         accordion.getAttribute('data-bs-target') ||
                         accordion.getAttribute('aria-controls');
            
            if (target || accordion.getAttribute('aria-expanded') !== null) {
              accordionInfo.isAccordion = true;
              accordionInfo.accordionTarget = target;
              accordionInfo.accordionText = accordion.textContent?.trim() || '';
              accordionInfo.isExpanded = accordion.getAttribute('aria-expanded') === 'true';
              elements.accordions.push(accordionInfo);
            }
          }
        });
      });

      // 座標順でソート（上から下、左から右）
      const sortByPosition = (a, b) => {
        if (Math.abs(a.position.top - b.position.top) > 10) {
          return a.position.top - b.position.top;
        }
        return a.position.left - b.position.left;
      };

      // 各カテゴリーをソート
      Object.keys(elements).forEach(key => {
        if (Array.isArray(elements[key])) {
          elements[key].sort(sortByPosition);
        }
      });

      return elements;
    });
  }

  /**
   * 収集した要素から包括的なテストケースを生成
   */
  generateTestCasesFromVisibleElements(elements, url) {
    const testCases = [];
    let testIdCounter = 1;

    // ヘッダー/ナビゲーションのテスト
    elements.navigationItems.forEach(nav => {
      if (nav.href || nav.targetUrl) {  // textの存在チェックを削除
        const targetUrl = nav.targetUrl || nav.href;
        const linkText = (nav.text || nav.linkText || nav.title || 'ナビゲーション').trim();
        testCases.push({
          test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
          test_case_name: `ナビゲーション「${linkText}」クリック`,
          test_category: 'ナビゲーション',
          priority: 'high',
          target_url: url,
          link_text: linkText,
          destination_url: targetUrl,
          test_steps: [
            {
              step_number: 1,
              action: 'goto',
              target: url,
              description: 'ページにアクセス'
            },
            {
              step_number: 2,
              action: 'click',
              target: nav.selector,
              description: `ナビゲーションの「${linkText}」リンクをクリック`,
              link_text: linkText
            },
            {
              step_number: 3,
              action: 'wait_for_navigation',
              target: targetUrl,
              description: `「${linkText}」のリンク先（${targetUrl}）への遷移を待つ`
            }
          ],
          expected_result: `「${linkText}」リンクをクリックして${targetUrl}に遷移し、ページが正常に表示される`
        });
      }
    });

    // フォームのテスト
    elements.forms.forEach((form, formIndex) => {
      // フォームの目的を推測
      let formPurpose = 'フォーム';
      const formText = (form.name || form.id || '').toLowerCase();
      const hasSearchField = form.fields.some(f => 
        f.type === 'search' || f.name?.includes('search') || f.placeholder?.includes('検索')
      );
      const hasLoginField = form.fields.some(f => 
        f.type === 'password' || f.name?.includes('password') || f.name?.includes('login')
      );
      const hasEmailField = form.fields.some(f => 
        f.type === 'email' || f.name?.includes('email')
      );
      
      if (hasSearchField || formText.includes('search')) {
        formPurpose = '検索フォーム';
      } else if (hasLoginField) {
        formPurpose = 'ログインフォーム';
      } else if (formText.includes('register') || formText.includes('signup')) {
        formPurpose = '登録フォーム';
      } else if (formText.includes('contact') || formText.includes('inquiry')) {
        formPurpose = 'お問い合わせフォーム';
      } else if (hasEmailField && form.fields.length > 2) {
        formPurpose = '登録/申込フォーム';
      }
      
      // テスト入力値を収集
      const testInputData = [];
      
      const formTestCase = {
        test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
        test_case_name: `${formPurpose}_入力送信`,
        test_category: 'フォーム',
        priority: 'high',
        target_url: url,
        test_steps: [
          {
            step_number: 1,
            action: 'goto',
            target: url,
            description: 'ページにアクセス'
          }
        ],
        expected_result: '', // 後で設定
        test_data: {} // 入力データを保存
      };

      // 各フィールドへの入力
      form.fields.forEach((field, index) => {
        if (field.type === 'checkbox') {
          const fieldLabel = field.labelText || field.name || 'チェックボックス';
          formTestCase.test_steps.push({
            step_number: formTestCase.test_steps.length + 1,
            action: 'check',
            target: field.selector,
            description: `${fieldLabel}をチェック`
          });
          testInputData.push(`${fieldLabel}: チェック済み`);
          formTestCase.test_data[fieldLabel] = 'checked';
        } else if (field.type === 'radio') {
          const fieldLabel = field.labelText || field.name || 'ラジオボタン';
          formTestCase.test_steps.push({
            step_number: formTestCase.test_steps.length + 1,
            action: 'check',
            target: field.selector,
            description: `${fieldLabel}を選択`
          });
          testInputData.push(`${fieldLabel}: 選択`);
          formTestCase.test_data[fieldLabel] = 'selected';
        } else if (field.tagName === 'select') {
          if (field.options && field.options.length > 1) {
            const fieldLabel = field.labelText || field.name || 'セレクトボックス';
            const selectedOption = field.options[1];
            formTestCase.test_steps.push({
              step_number: formTestCase.test_steps.length + 1,
              action: 'select',
              target: field.selector,
              value: selectedOption.value,
              description: `${fieldLabel}で「${selectedOption.text}」を選択`
            });
            testInputData.push(`${fieldLabel}: ${selectedOption.text}`);
            formTestCase.test_data[fieldLabel] = selectedOption.text;
          }
        } else if (field.type !== 'submit' && field.type !== 'button') {
          const fieldLabel = field.labelText || field.placeholder || field.name || 'フィールド';
          const inputValue = field.sampleData || 'テストデータ';
          formTestCase.test_steps.push({
            step_number: formTestCase.test_steps.length + 1,
            action: 'fill',
            target: field.selector,
            value: inputValue,
            description: `${fieldLabel}に「${inputValue}」を入力`
          });
          testInputData.push(`${fieldLabel}: ${inputValue}`);
          formTestCase.test_data[fieldLabel] = inputValue;
        }
      });

      // 送信ボタンを探す（フォーム内、または近くのボタン）
      let submitButton = form.fields.find(f => f.type === 'submit' || f.type === 'button');
      
      if (!submitButton) {
        // フォーム内に送信ボタンがない場合、フォームに関連するボタンを探す
        const buttonTexts = ['送信', '検索', '登録', 'ログイン', 'submit', 'search', 'register', 'login', 'go', '実行'];
        submitButton = elements.buttons.find(b => {
          const btnText = (b.text || b.buttonText || '').toLowerCase();
          // 検索フォームの場合
          if (formPurpose === '検索フォーム') {
            return btnText.includes('検索') || btnText.includes('search') || btnText === 'go';
          }
          // ログインフォームの場合
          if (formPurpose === 'ログインフォーム') {
            return btnText.includes('ログイン') || btnText.includes('login') || btnText.includes('sign in');
          }
          // その他のフォーム
          return buttonTexts.some(text => btnText.includes(text));
        });
      }
      
      if (submitButton) {
        const buttonText = submitButton.text || submitButton.buttonText || submitButton.value || '送信';
        formTestCase.test_steps.push({
          step_number: formTestCase.test_steps.length + 1,
          action: 'click',
          target: submitButton.selector,
          description: `「${buttonText}」ボタンをクリック`,
          button_text: buttonText
        });
      }
      
      // 期待結果を具体的に設定
      if (testInputData.length > 0) {
        if (formPurpose === '検索フォーム') {
          const searchValue = formTestCase.test_data[Object.keys(formTestCase.test_data)[0]];
          formTestCase.expected_result = `「${searchValue}」で検索が実行され、検索結果が表示される`;
          formTestCase.test_case_name = `検索フォーム_「${searchValue}」で検索`;
        } else if (formPurpose === 'ログインフォーム') {
          const email = formTestCase.test_data['メールアドレス'] || formTestCase.test_data['email'] || 
                       formTestCase.test_data[Object.keys(formTestCase.test_data)[0]];
          formTestCase.expected_result = `ユーザー「${email}」でログインに成功し、ダッシュボードまたはホームページに遷移する`;
          formTestCase.test_case_name = `ログイン_${email}`;
        } else if (formPurpose === 'お問い合わせフォーム') {
          formTestCase.expected_result = `以下の内容で問い合わせが送信される:\n${testInputData.join('\n')}`;
          formTestCase.test_case_name = `お問い合わせ送信_テストデータ`;
        } else {
          formTestCase.expected_result = `以下の入力値でフォームが送信される:\n${testInputData.join('\n')}`;
          formTestCase.test_case_name = `${formPurpose}_データ入力送信`;
        }
      } else {
        formTestCase.expected_result = `${formPurpose}が正常に送信される`;
      }

      testCases.push(formTestCase);

      // セキュリティテストケースの追加（XSSとSQLインジェクション）
      // フォーム内のテキスト入力フィールドに対して脆弱性テストを生成
      const textInputFields = form.fields.filter(f => {
        // textareaはtagNameで判定
        if (f.tagName === 'textarea') return true;
        // input要素のテキスト系type
        return f.type === 'text' || f.type === 'email' || f.type === 'search' || 
               f.type === 'url' || f.type === 'tel' || f.type === 'password' ||
               !f.type; // typeが未定義の場合はtextとして扱う
      });

      // 最初のテキスト入力フィールドに対してセキュリティテストを実行
      if (textInputFields.length > 0) {
        const targetField = textInputFields[0];
        
        // XSSテストケース（全8パターン）
        TEST_DATA.invalid.xss.forEach((xssPayload, xssIndex) => {
          const xssTestCase = {
            test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
            test_case_name: `${formPurpose}_XSS攻撃テスト_パターン${xssIndex + 1}`,
            test_category: 'セキュリティ',
            test_type: 'security',
            priority: 'critical',
            target_url: url,
            prerequisites: `1. ${url}にアクセス可能であること\n2. ${formPurpose}が表示されること\n3. 入力フィールド「${targetField.selector}」が存在すること`,
            test_steps: [{
              step_number: 1,
              action: 'goto',
              target: url,
              description: 'ページを開く'
            }, {
              step_number: 2,
              action: 'wait',
              target: targetField.selector,
              description: `入力フィールド「${targetField.selector}」が表示されるまで待機`
            }, {
              step_number: 3,
              action: 'clear',
              target: targetField.selector,
              description: '入力フィールドをクリア'
            }, {
              step_number: 4,
              action: 'fill',
              target: targetField.selector,
              value: xssPayload,
              input_value: xssPayload,
              description: `XSS攻撃スクリプトを入力`
            }],
            test_data: {
              attack_type: 'XSS',
              pattern: `パターン${xssIndex + 1}/${TEST_DATA.invalid.xss.length}`,
              payload: xssPayload,
              actual_script: xssPayload,
              target_field: targetField.name || targetField.id || targetField.selector,
              input_data: xssPayload
            },
            expected_result: `XSS攻撃パターン${xssIndex + 1}「${xssPayload}」が防御される:\n` +
                           `- スクリプト「${xssPayload}」が実行されない\n` +
                           `- アラートダイアログが表示されない\n` +
                           `- HTMLタグがエスケープされて「&lt;script&gt;」のように表示される\n` +
                           `- JavaScriptコードが文字列として扱われる`,
            actual_result: '',
            test_result: 'pending'
          };

          // 送信ボタンがある場合は追加
          if (submitButton) {
            xssTestCase.test_steps.push({
              step_number: 5,
              action: 'click',
              target: submitButton.selector,
              description: `送信ボタン「${submitButton.selector}」をクリック`
            });
            xssTestCase.test_steps.push({
              step_number: 6,
              action: 'wait',
              target: 'body',
              wait_time: 2000,
              description: 'スクリプト実行の可能性を待機（2秒）'
            });
            xssTestCase.test_steps.push({
              step_number: 7,
              action: 'check_alert',
              description: 'アラートが表示されていないことを確認'
            });
          }

          testCases.push(xssTestCase);
        });

        // SQLインジェクションテストケース（全7パターン）
        TEST_DATA.invalid.sql.forEach((sqlPayload, sqlIndex) => {
          const sqlTestCase = {
            test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
            test_case_name: `${formPurpose}_SQLインジェクション攻撃テスト_パターン${sqlIndex + 1}`,
            test_category: 'セキュリティ',
            test_type: 'security',
            priority: 'critical',
            target_url: url,
            prerequisites: `1. ${url}にアクセス可能であること\n2. ${formPurpose}が表示されること\n3. 入力フィールド「${targetField.selector}」が存在すること\n4. バックエンドでSQL処理が実行される可能性があること`,
            test_steps: [{
              step_number: 1,
              action: 'goto',
              target: url,
              description: 'ページを開く'
            }, {
              step_number: 2,
              action: 'wait',
              target: targetField.selector,
              description: `入力フィールド「${targetField.selector}」が表示されるまで待機`
            }, {
              step_number: 3,
              action: 'clear',
              target: targetField.selector,
              description: '入力フィールドをクリア'
            }, {
              step_number: 4,
              action: 'fill',
              target: targetField.selector,
              value: sqlPayload,
              input_value: sqlPayload,
              description: `SQLインジェクション攻撃スクリプトを入力`
            }],
            test_data: {
              attack_type: 'SQL_INJECTION',
              pattern: `パターン${sqlIndex + 1}/${TEST_DATA.invalid.sql.length}`,
              payload: sqlPayload,
              actual_script: sqlPayload,
              target_field: targetField.name || targetField.id || targetField.selector,
              input_data: sqlPayload,
              sql_command: sqlPayload
            },
            expected_result: `SQLインジェクション攻撃パターン${sqlIndex + 1}「${sqlPayload}」が防御される:\n` +
                           `- SQLクエリ「${sqlPayload}」が実行されない\n` +
                           `- データベースエラー（MySQL/PostgreSQL/SQLite等）が表示されない\n` +
                           `- 「Syntax error」「SQL error」などのエラーメッセージが露出しない\n` +
                           `- テーブル削除（DROP TABLE）やデータ漏洩（UNION SELECT）が発生しない\n` +
                           `- 適切なバリデーションエラー（例：「不正な文字が含まれています」）が表示される`,
            actual_result: '',
            test_result: 'pending'
          };

          // 送信ボタンがある場合は追加
          if (submitButton) {
            sqlTestCase.test_steps.push({
              step_number: 5,
              action: 'click',
              target: submitButton.selector,
              description: `送信ボタン「${submitButton.selector}」をクリック`
            });
            sqlTestCase.test_steps.push({
              step_number: 6,
              action: 'wait',
              target: 'body',
              wait_time: 2000,
              description: 'SQLクエリ実行とレスポンスを待機（2秒）'
            });
            sqlTestCase.test_steps.push({
              step_number: 7,
              action: 'check_text',
              target: 'body',
              not_contains: ['SQL', 'syntax error', 'mysql', 'postgres', 'sqlite', 'database error', 'query failed'],
              description: 'SQLエラーメッセージが表示されていないことを確認'
            });
            sqlTestCase.test_steps.push({
              step_number: 8,
              action: 'check_console',
              description: 'コンソールにSQLエラーが出力されていないことを確認'
            });
          }

          testCases.push(sqlTestCase);
        });
      }
    });

    // 個別の入力フィールドのテスト（フォーム外）
    const standaloneInputs = elements.inputs.filter(input => {
      // フォーム内の要素は除外
      return !elements.forms.some(form => 
        form.fields.some(field => field.selector === input.selector)
      );
    });

    standaloneInputs.forEach(input => {
      if (input.sampleData) {
        const fieldLabel = input.labelText || input.placeholder || input.name || '入力項目';
        const inputValue = input.sampleData;
        testCases.push({
          test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
          test_case_name: `入力_${fieldLabel}_「${inputValue}」`,
          test_category: '入力',
          priority: input.required ? 'high' : 'medium',
          target_url: url,
          test_data: {
            [fieldLabel]: inputValue
          },
          test_steps: [
            {
              step_number: 1,
              action: 'goto',
              target: url,
              description: 'ページにアクセス'
            },
            {
              step_number: 2,
              action: 'fill',
              target: input.selector,
              value: inputValue,
              description: `${fieldLabel}に「${inputValue}」を入力`
            }
          ],
          expected_result: `${fieldLabel}に「${inputValue}」が正しく入力され、バリデーションエラーが表示されない`
        });
      }
    });

    // テキストエリアのテスト（フォーム外）
    const standaloneTextareas = elements.textareas.filter(textarea => {
      // フォーム内の要素は除外
      return !elements.forms.some(form => 
        form.fields.some(field => field.selector === textarea.selector)
      );
    });

    standaloneTextareas.forEach(textarea => {
      if (textarea.sampleData) {
        const fieldLabel = textarea.labelText || textarea.placeholder || textarea.name || 'テキストエリア';
        const inputValue = textarea.sampleData;
        testCases.push({
          test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
          test_case_name: `テキストエリア_${fieldLabel}_「${inputValue.substring(0, 20)}...」入力`,
          test_category: 'テキストエリア',
          priority: textarea.required ? 'high' : 'medium',
          target_url: url,
          test_data: {
            field_name: fieldLabel,
            input_value: inputValue
          },
          prerequisites: '対象ページを開く',
          test_steps: [
            {
              step_number: 1,
              action: 'goto',
              target: url,
              description: 'ページにアクセス'
            },
            {
              step_number: 2,
              action: 'fill',
              target: textarea.selector,
              value: inputValue,
              description: `テキストエリア「${fieldLabel}」に「${inputValue.substring(0, 20)}...」を入力`
            }
          ],
          expected_result: `テキストエリア「${fieldLabel}」に「${inputValue.substring(0, 20)}...」が正常に入力される`,
          actual_result: '',
          test_result: 'pending'
        });
      }
    });

    // ボタンのテスト
    elements.buttons.forEach(button => {
      // 無効なボタンや空のボタンを除外
      const buttonText = button.buttonText?.trim();
      const isValidButton = buttonText && 
                           buttonText !== '' &&
                           !button.disabled &&
                           button.selector;
      
      if (isValidButton) {
        const targetUrl = button.targetUrl || button.href;
        const buttonText = button.buttonText.trim();
        const steps = [
          {
            step_number: 1,
            action: 'goto',
            target: url,
            description: 'ページにアクセス'
          },
          {
            step_number: 2,
            action: 'click',
            target: button.selector,
            description: `ボタン「${buttonText}」をクリック`,
            button_text: buttonText
          }
        ];
        
        if (targetUrl && targetUrl !== url) {
          steps.push({
            step_number: 3,
            action: 'wait_for_navigation',
            target: targetUrl,
            description: `「${buttonText}」ボタンのリンク先（${targetUrl}）への遷移を待つ`
          });
        }
        
        testCases.push({
          test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
          test_case_name: `ボタン「${buttonText}」クリック`,
          test_category: 'ボタン',
          priority: 'medium',
          target_url: url,
          button_text: buttonText,
          destination_url: targetUrl,
          test_steps: steps,
          expected_result: targetUrl && targetUrl !== url ? 
            `「${buttonText}」ボタンをクリックして${targetUrl}に遷移し、ページが正常に表示される` : 
            `「${buttonText}」ボタンが正常に動作する`
        });
      }
    });

    // メインコンテンツのリンクテスト
    const mainLinks = elements.links.filter(link => 
      !elements.navigationItems.some(nav => nav.selector === link.selector) &&
      !elements.footerLinks.some(footer => footer.selector === link.selector)
    );

    mainLinks.forEach(link => {
      if (link.href || link.targetUrl) {  // textの存在チェックを削除
        const targetUrl = link.targetUrl || link.href;
        const linkText = (link.text || link.linkText || link.title || 'リンク').trim();
        testCases.push({
          test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
          test_case_name: `リンク「${linkText.substring(0, 30)}」クリック`,
          test_category: 'リンク',
          priority: 'low',
          target_url: url,
          link_text: linkText,
          destination_url: targetUrl,
          test_steps: [
            {
              step_number: 1,
              action: 'goto',
              target: url,
              description: 'ページにアクセス'
            },
            {
              step_number: 2,
              action: 'click',
              target: link.selector,
              description: `リンク「${linkText}」をクリック`,
              link_text: linkText
            },
            {
              step_number: 3,
              action: 'wait_for_navigation',
              target: targetUrl,
              description: `「${linkText}」のリンク先（${targetUrl}）への遷移を待つ`
            }
          ],
          expected_result: `「${linkText}」リンクから${targetUrl}に遷移し、ページが正常に表示される`
        });
      }
    });

    // フッターリンクのテスト
    elements.footerLinks.forEach(link => {
      if (link.href || link.targetUrl) {  // textの存在チェックを削除
        const targetUrl = link.targetUrl || link.href;
        const linkText = (link.text || link.linkText || link.title || 'フッターリンク').trim();
        testCases.push({
          test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
          test_case_name: `フッター「${linkText}」クリック`,
          test_category: 'フッター',
          priority: 'low',
          target_url: url,
          link_text: linkText,
          destination_url: targetUrl,
          test_steps: [
            {
              step_number: 1,
              action: 'goto',
              target: url,
              description: 'ページにアクセス'
            },
            {
              step_number: 2,
              action: 'click',
              target: link.selector,
              description: `フッターの「${linkText}」リンクをクリック`,
              link_text: linkText
            },
            {
              step_number: 3,
              action: 'wait_for_navigation',
              target: targetUrl,
              description: `「${linkText}」のリンク先（${targetUrl}）への遷移を待つ`
            }
          ],
          expected_result: `フッターの「${linkText}」リンクから${targetUrl}に遷移する`
        });
      }
    });

    // セレクトボックスのテスト（各オプションを選択）
    elements.selects.forEach(select => {
      if (select.options && select.options.length > 0) {
        // 各オプションに対してテストケースを作成
        select.options.forEach((option, optionIndex) => {
          // デフォルト選択されているものはスキップ
          if (option.selected && optionIndex === 0) return;
          
          testCases.push({
            test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
            test_case_name: `セレクト_${select.labelText || select.name || 'ドロップダウン'}_${option.text}`,
            test_category: 'セレクト',
            priority: 'medium',
            target_url: url,
            test_steps: [
              {
                step_number: 1,
                action: 'goto',
                target: url,
                description: 'ページにアクセス'
              },
              {
                step_number: 2,
                action: 'select',
                target: select.selector,
                value: option.value,
                description: `${select.labelText || 'セレクトボックス'}から「${option.text}」を選択`
              },
              {
                step_number: 3,
                action: 'wait',
                target: 500,
                description: '選択結果の反映を待つ'
              }
            ],
            expected_result: `「${option.text}」が選択され、関連する内容が表示される`
          });
        });
      }
    });

    // タブのテスト（各タブを切り替え）
    elements.tabs.forEach(tab => {
      // アクティブなタブはスキップ
      if (tab.isActive) return;
      
      testCases.push({
        test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
        test_case_name: `タブ切替_${tab.tabText}`,
        test_category: 'タブ',
        priority: 'high',
        target_url: url,
        test_steps: [
          {
            step_number: 1,
            action: 'goto',
            target: url,
            description: 'ページにアクセス'
          },
          {
            step_number: 2,
            action: 'click',
            target: tab.selector,
            description: `「${tab.tabText}」タブをクリック`
          },
          {
            step_number: 3,
            action: 'wait_for_selector',
            target: tab.tabTarget || '.tab-content.active',
            description: 'タブコンテンツの表示を待つ'
          },
          {
            step_number: 4,
            action: 'wait',
            target: 500,
            description: 'アニメーション完了を待つ'
          }
        ],
        expected_result: `「${tab.tabText}」タブの内容が表示され、他のタブが非表示になる`
      });

      // タブ内のコンテンツもテスト対象にする
      if (tab.tabTarget) {
        testCases.push({
          test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
          test_case_name: `タブ内要素確認_${tab.tabText}`,
          test_category: 'タブ',
          priority: 'medium',
          target_url: url,
          test_steps: [
            {
              step_number: 1,
              action: 'goto',
              target: url,
              description: 'ページにアクセス'
            },
            {
              step_number: 2,
              action: 'click',
              target: tab.selector,
              description: `「${tab.tabText}」タブを開く`
            },
            {
              step_number: 3,
              action: 'wait_for_selector',
              target: tab.tabTarget,
              description: 'タブコンテンツの表示を待つ'
            },
            {
              step_number: 4,
              action: 'screenshot',
              target: `tab_${tab.tabText}`,
              description: `${tab.tabText}タブの内容をキャプチャ`
            }
          ],
          expected_result: `${tab.tabText}タブ内の要素が正しく表示される`
        });
      }
    });

    // アコーディオンのテスト（開閉）
    elements.accordions.forEach(accordion => {
      testCases.push({
        test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
        test_case_name: `アコーディオン_${accordion.accordionText}`,
        test_category: 'アコーディオン',
        priority: 'medium',
        target_url: url,
        test_steps: [
          {
            step_number: 1,
            action: 'goto',
            target: url,
            description: 'ページにアクセス'
          },
          {
            step_number: 2,
            action: 'click',
            target: accordion.selector,
            description: `「${accordion.accordionText}」をクリック`
          },
          {
            step_number: 3,
            action: 'wait',
            target: 500,
            description: 'アニメーション完了を待つ'
          },
          {
            step_number: 4,
            action: accordion.isExpanded ? 'check_hidden' : 'check_visible',
            target: accordion.accordionTarget || '.accordion-content',
            description: accordion.isExpanded ? 'コンテンツが閉じることを確認' : 'コンテンツが開くことを確認'
          }
        ],
        expected_result: accordion.isExpanded ? 
          `アコーディオンが閉じて内容が非表示になる` : 
          `アコーディオンが開いて内容が表示される`
      });
    });

    // チェックボックスのテスト
    elements.checkboxes.forEach(checkbox => {
      testCases.push({
        test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
        test_case_name: `チェックボックス_${checkbox.labelText || checkbox.name || 'チェック'}`,
        test_category: 'チェックボックス',
        priority: 'medium',
        target_url: url,
        test_steps: [
          {
            step_number: 1,
            action: 'goto',
            target: url,
            description: 'ページにアクセス'
          },
          {
            step_number: 2,
            action: 'check',
            target: checkbox.selector,
            description: `${checkbox.labelText || 'チェックボックス'}をチェック`
          },
          {
            step_number: 3,
            action: 'wait',
            target: 300,
            description: '状態変更を待つ'
          },
          {
            step_number: 4,
            action: 'uncheck',
            target: checkbox.selector,
            description: `${checkbox.labelText || 'チェックボックス'}のチェックを外す`
          }
        ],
        expected_result: 'チェックボックスの状態が正しく切り替わる'
      });
    });

    // ラジオボタンのテスト（グループごと）
    const radioGroups = {};
    elements.radios.forEach(radio => {
      const groupName = radio.name || 'default';
      if (!radioGroups[groupName]) {
        radioGroups[groupName] = [];
      }
      radioGroups[groupName].push(radio);
    });

    Object.entries(radioGroups).forEach(([groupName, radios]) => {
      radios.forEach((radio, index) => {
        testCases.push({
          test_id: `TC${String(testIdCounter++).padStart(3, '0')}`,
          test_case_name: `ラジオボタン_${groupName}_${radio.labelText || `選択肢${index + 1}`}`,
          test_category: 'ラジオボタン',
          priority: 'medium',
          target_url: url,
          test_steps: [
            {
              step_number: 1,
              action: 'goto',
              target: url,
              description: 'ページにアクセス'
            },
            {
              step_number: 2,
              action: 'click',
              target: radio.selector,
              description: `${radio.labelText || `選択肢${index + 1}`}を選択`
            },
            {
              step_number: 3,
              action: 'wait',
              target: 300,
              description: '選択状態の反映を待つ'
            }
          ],
          expected_result: `${radio.labelText || `選択肢${index + 1}`}が選択され、他の選択肢が非選択になる`
        });
      });
    });

    return testCases;
  }
}

export default VisualElementCollector;