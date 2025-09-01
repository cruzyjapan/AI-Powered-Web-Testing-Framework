/**
 * EC-CUBE 4.2 Analyzer Module
 * EC-CUBE 4.2のフロントエンド・バックエンドを解析する専用モジュール
 */

export class ECCubeAnalyzer {
  constructor() {
    // EC-CUBE 4.2の典型的なURL構造
    this.patterns = {
      frontend: {
        top: /^\/$/,
        productList: /\/products\/list/,
        productDetail: /\/products\/detail\/\d+/,
        cart: /\/cart/,
        shopping: /\/shopping/,
        contact: /\/contact/,
        entry: /\/entry/,
        mypage: /\/mypage/,
        help: /\/help\//
      },
      backend: {
        admin: /\/admin/,
        adminLogin: /\/admin\/login/,
        adminProduct: /\/admin\/product/,
        adminOrder: /\/admin\/order/,
        adminCustomer: /\/admin\/customer/,
        adminContent: /\/admin\/content/,
        adminSetting: /\/admin\/setting/,
        adminStore: /\/admin\/store/
      }
    };

    // EC-CUBE特有の要素セレクター
    this.selectors = {
      // フロントエンド要素
      frontend: {
        header: '.ec-headerNaviRole, .ec-headerNav',
        searchBox: '.ec-headerSearch__form',
        cartButton: '.ec-cartNaviRole, .ec-headerNav__itemIcon--cart',
        loginLink: '.ec-headerNav__item--login',
        mypageLink: '.ec-headerNav__item--mypage',
        categoryNav: '.ec-categoryNaviRole',
        productItem: '.ec-shelfGrid__item, .ec-productRole',
        productName: '.ec-productRole__title',
        productPrice: '.ec-productRole__price',
        addToCart: '.ec-productRole__btn',
        breadcrumb: '.ec-topicpath',
        footer: '.ec-footerRole'
      },
      // バックエンド要素
      backend: {
        sidebar: '.c-mainNavArea__nav',
        contentArea: '.c-contentsArea',
        pageTitle: '.c-pageTitle',
        toolbar: '.c-toolBar',
        dataTable: '.card-body table',
        searchForm: '.search-box',
        submitButton: 'button[type="submit"]',
        modalDialog: '.modal-dialog',
        alert: '.alert',
        form: 'form[name*="admin_"]'
      },
      // 共通フォーム要素
      forms: {
        csrf: 'input[name*="_token"]',
        required: '.required, .ec-required',
        error: '.ec-errorMessage, .form-error-message, .invalid-feedback',
        help: '.ec-input__help, .form-text'
      }
    };

    // EC-CUBEページタイプ
    this.pageTypes = {
      UNKNOWN: 'unknown',
      FRONT_TOP: 'front_top',
      FRONT_PRODUCT_LIST: 'front_product_list',
      FRONT_PRODUCT_DETAIL: 'front_product_detail',
      FRONT_CART: 'front_cart',
      FRONT_SHOPPING: 'front_shopping',
      FRONT_MYPAGE: 'front_mypage',
      FRONT_ENTRY: 'front_entry',
      ADMIN_LOGIN: 'admin_login',
      ADMIN_DASHBOARD: 'admin_dashboard',
      ADMIN_PRODUCT: 'admin_product',
      ADMIN_ORDER: 'admin_order',
      ADMIN_CUSTOMER: 'admin_customer',
      ADMIN_SETTING: 'admin_setting'
    };
  }

  /**
   * ページタイプを判定
   */
  async detectPageType(page) {
    const url = page.url();
    const title = await page.title();
    
    // URLパターンでの判定
    for (const [type, pattern] of Object.entries(this.patterns.backend)) {
      if (pattern.test(url)) {
        if (type === 'admin' && url.endsWith('/admin/')) {
          return this.pageTypes.ADMIN_DASHBOARD;
        }
        return this.pageTypes[`ADMIN_${type.replace('admin', '').toUpperCase()}`] || this.pageTypes.UNKNOWN;
      }
    }
    
    for (const [type, pattern] of Object.entries(this.patterns.frontend)) {
      if (pattern.test(url)) {
        return this.pageTypes[`FRONT_${type.toUpperCase()}`] || this.pageTypes.UNKNOWN;
      }
    }

    // DOM要素での判定
    const hasAdminElements = await page.evaluate((selectors) => {
      return Object.values(selectors.backend).some(selector => 
        document.querySelector(selector) !== null
      );
    }, this.selectors);

    if (hasAdminElements) {
      return this.pageTypes.ADMIN_DASHBOARD;
    }

    return this.pageTypes.FRONT_TOP;
  }

  /**
   * EC-CUBE固有の要素を収集
   */
  async collectECCubeElements(page) {
    const pageType = await this.detectPageType(page);
    const isAdmin = pageType.startsWith('ADMIN_');
    
    return await page.evaluate(({ selectors, isAdmin, pageType }) => {
      const elements = {
        pageType: pageType,
        isAdmin: isAdmin,
        structure: {},
        forms: [],
        products: [],
        navigation: [],
        actions: []
      };

      // 管理画面の解析
      if (isAdmin) {
        // サイドバーメニュー
        const sidebarItems = document.querySelectorAll('.c-mainNavArea__nav .c-mainNavArea__navItem');
        elements.navigation = Array.from(sidebarItems).map(item => {
          const link = item.querySelector('a');
          return {
            text: link?.textContent?.trim(),
            href: link?.href,
            icon: item.querySelector('i')?.className,
            active: item.classList.contains('is-active')
          };
        });

        // データテーブル
        const tables = document.querySelectorAll('.card-body table');
        elements.structure.tables = Array.from(tables).map(table => {
          const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
          const rows = table.querySelectorAll('tbody tr').length;
          return {
            headers: headers,
            rowCount: rows,
            sortable: table.querySelector('.sortable') !== null
          };
        });

        // 管理画面フォーム
        const adminForms = document.querySelectorAll('form[name*="admin_"]');
        elements.forms = Array.from(adminForms).map(form => {
          return {
            name: form.getAttribute('name'),
            action: form.action,
            method: form.method,
            fields: Array.from(form.querySelectorAll('input, select, textarea')).map(field => ({
              name: field.name,
              type: field.type || field.tagName.toLowerCase(),
              required: field.hasAttribute('required'),
              value: field.value
            }))
          };
        });
      } 
      // フロントエンドの解析
      else {
        // 商品要素
        const productElements = document.querySelectorAll('.ec-shelfGrid__item, .ec-productRole');
        elements.products = Array.from(productElements).slice(0, 10).map(product => {
          return {
            name: product.querySelector('.ec-productRole__title')?.textContent?.trim(),
            price: product.querySelector('.ec-productRole__price')?.textContent?.trim(),
            image: product.querySelector('img')?.src,
            link: product.querySelector('a')?.href,
            hasAddToCart: product.querySelector('.ec-productRole__btn') !== null
          };
        });

        // カテゴリナビゲーション
        const categoryItems = document.querySelectorAll('.ec-categoryNaviRole a');
        elements.navigation = Array.from(categoryItems).map(item => ({
          text: item.textContent?.trim(),
          href: item.href,
          active: item.classList.contains('is-active')
        }));

        // カート・購入フロー要素
        if (pageType.includes('CART') || pageType.includes('SHOPPING')) {
          const cartItems = document.querySelectorAll('.ec-cartRow');
          elements.structure.cart = {
            itemCount: cartItems.length,
            hasQuantityControl: document.querySelector('.ec-cartRow__amountUpDown') !== null,
            hasRemoveButton: document.querySelector('.ec-cartRow__delColumn') !== null,
            totalPrice: document.querySelector('.ec-cartRole__totalAmount')?.textContent?.trim()
          };
        }

        // 会員登録・ログインフォーム
        const entryForm = document.querySelector('form[name="entry"], form[name="login_mypage"]');
        if (entryForm) {
          elements.forms.push({
            name: entryForm.getAttribute('name'),
            action: entryForm.action,
            fields: Array.from(entryForm.querySelectorAll('input, select')).map(field => ({
              name: field.name,
              type: field.type,
              required: field.hasAttribute('required') || field.closest('.ec-required') !== null
            }))
          });
        }
      }

      // CSRFトークンの検出
      const csrfToken = document.querySelector('input[name*="_token"]');
      elements.structure.hasCsrfToken = csrfToken !== null;

      // レスポンシブ対応の確認
      elements.structure.responsive = {
        hasViewport: document.querySelector('meta[name="viewport"]') !== null,
        hasMediaQueries: Array.from(document.styleSheets).some(sheet => {
          try {
            return Array.from(sheet.cssRules || []).some(rule => 
              rule.media && rule.media.length > 0
            );
          } catch (e) {
            return false;
          }
        })
      };

      // アクション可能な要素
      const actionButtons = document.querySelectorAll('button[type="submit"], .btn-action, .ec-blockBtn');
      elements.actions = Array.from(actionButtons).slice(0, 10).map(btn => ({
        text: btn.textContent?.trim(),
        type: btn.getAttribute('type'),
        formAction: btn.getAttribute('formaction'),
        classes: btn.className
      }));

      return elements;
    }, { selectors: this.selectors, isAdmin, pageType });
  }

  /**
   * EC-CUBE特有のテストシナリオを生成
   */
  generateECCubeTestScenarios(pageType, elements) {
    const scenarios = [];

    switch(pageType) {
      case this.pageTypes.FRONT_TOP:
        scenarios.push(
          { name: '商品検索', steps: ['検索ボックスに入力', '検索実行', '結果確認'] },
          { name: 'カテゴリ遷移', steps: ['カテゴリメニュー選択', '商品一覧表示確認'] },
          { name: 'カート確認', steps: ['カートアイコンクリック', 'カート内容確認'] }
        );
        break;

      case this.pageTypes.FRONT_PRODUCT_LIST:
        scenarios.push(
          { name: '商品絞り込み', steps: ['フィルター選択', '並び替え実行', '結果確認'] },
          { name: '商品詳細遷移', steps: ['商品選択', '詳細ページ表示確認'] },
          { name: 'ページネーション', steps: ['次ページ遷移', '前ページ遷移'] }
        );
        break;

      case this.pageTypes.FRONT_PRODUCT_DETAIL:
        scenarios.push(
          { name: 'カート追加', steps: ['数量選択', 'カートに追加', '追加確認'] },
          { name: '商品画像確認', steps: ['サムネイル切替', '拡大表示'] },
          { name: '関連商品確認', steps: ['関連商品表示', '関連商品クリック'] }
        );
        break;

      case this.pageTypes.FRONT_CART:
        scenarios.push(
          { name: '数量変更', steps: ['数量増減', '金額再計算確認'] },
          { name: '商品削除', steps: ['削除ボタンクリック', '削除確認'] },
          { name: '購入手続き', steps: ['購入手続きへ進む', 'ログイン/ゲスト選択'] }
        );
        break;

      case this.pageTypes.FRONT_SHOPPING:
        scenarios.push(
          { name: '配送先入力', steps: ['住所入力', 'バリデーション確認'] },
          { name: '支払方法選択', steps: ['支払方法選択', '手数料確認'] },
          { name: '注文確認', steps: ['注文内容確認', '注文確定'] }
        );
        break;

      case this.pageTypes.ADMIN_PRODUCT:
        scenarios.push(
          { name: '商品登録', steps: ['新規登録', '必須項目入力', '保存'] },
          { name: '商品検索', steps: ['検索条件入力', '検索実行', '結果確認'] },
          { name: '商品編集', steps: ['商品選択', '情報更新', '保存'] },
          { name: 'CSV出力', steps: ['出力条件設定', 'CSV出力実行'] }
        );
        break;

      case this.pageTypes.ADMIN_ORDER:
        scenarios.push(
          { name: '受注検索', steps: ['検索条件設定', '検索実行'] },
          { name: 'ステータス変更', steps: ['受注選択', 'ステータス更新', '保存'] },
          { name: '受注編集', steps: ['受注詳細表示', '編集', '更新'] },
          { name: 'メール送信', steps: ['受注選択', 'メールテンプレート選択', '送信'] }
        );
        break;

      case this.pageTypes.ADMIN_CUSTOMER:
        scenarios.push(
          { name: '会員検索', steps: ['検索条件入力', '検索実行'] },
          { name: '会員編集', steps: ['会員選択', '情報編集', '保存'] },
          { name: '会員登録', steps: ['新規登録', '情報入力', '保存'] }
        );
        break;
    }

    return scenarios;
  }

  /**
   * EC-CUBE用のテストデータを生成
   */
  generateECCubeTestData(fieldName, fieldType) {
    const testData = {
      // 会員登録用
      'entry[name][name01]': ['山田', '佐藤', '鈴木'],
      'entry[name][name02]': ['太郎', '花子', '一郎'],
      'entry[kana][kana01]': ['ヤマダ', 'サトウ', 'スズキ'],
      'entry[kana][kana02]': ['タロウ', 'ハナコ', 'イチロウ'],
      'entry[postal_code]': ['100-0001', '150-0001', '160-0001'],
      'entry[address][pref]': ['13', '27', '14'], // 都道府県コード
      'entry[address][addr01]': ['千代田区', '渋谷区', '新宿区'],
      'entry[address][addr02]': ['1-1-1', '2-2-2', '3-3-3'],
      'entry[phone_number]': ['090-1234-5678', '080-9876-5432', '070-1111-2222'],
      'entry[email][first]': ['test@example.com', 'user@test.jp', 'sample@eccube.net'],
      
      // 商品登録用
      'admin_product[name]': ['テスト商品', 'サンプル商品', 'デモ商品'],
      'admin_product[product_code]': ['TEST-001', 'SAMPLE-002', 'DEMO-003'],
      'admin_product[price02]': ['1000', '2000', '3000'],
      'admin_product[stock]': ['100', '50', '999'],
      'admin_product[description_detail]': ['これはテスト商品です。', '商品の詳細説明文です。'],
      
      // 検索用
      'search': ['Tシャツ', 'パーカー', 'ジャケット'],
      'name': ['テスト', 'サンプル', 'デモ'],
      'price_min': ['1000', '500', '0'],
      'price_max': ['10000', '5000', '3000']
    };

    // フィールド名に基づいてテストデータを返す
    if (testData[fieldName]) {
      return testData[fieldName][Math.floor(Math.random() * testData[fieldName].length)];
    }

    // 汎用的なフィールドタイプに基づく生成
    switch(fieldType) {
      case 'email':
        return `test${Date.now()}@example.com`;
      case 'tel':
        return '090-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0') + '-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      case 'number':
        return Math.floor(Math.random() * 100).toString();
      case 'text':
      default:
        return 'テストデータ' + Date.now();
    }
  }

  /**
   * EC-CUBEページの包括的な解析
   */
  async analyzePage(page) {
    try {
      const pageType = await this.detectPageType(page);
      const elements = await this.collectECCubeElements(page);
      const scenarios = this.generateECCubeTestScenarios(pageType, elements);

      // プラグインの検出
      const plugins = await this.detectPlugins(page);
      
      // パフォーマンス指標
      const performance = await this.measurePerformance(page);

      return {
        url: page.url(),
        title: await page.title(),
        pageType: pageType,
        isAdmin: elements.isAdmin,
        structure: elements.structure,
        elements: elements,
        scenarios: scenarios,
        plugins: plugins,
        performance: performance,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('EC-CUBE解析エラー:', error);
      throw error;
    }
  }

  /**
   * EC-CUBEプラグインの検出
   */
  async detectPlugins(page) {
    return await page.evaluate(() => {
      const plugins = [];
      
      // メタタグからプラグイン情報を検出
      const metaTags = document.querySelectorAll('meta[name*="eccube"], meta[name*="plugin"]');
      metaTags.forEach(meta => {
        plugins.push({
          name: meta.getAttribute('name'),
          content: meta.getAttribute('content')
        });
      });

      // JavaScriptグローバル変数から検出
      if (window.eccube_plugins) {
        Object.keys(window.eccube_plugins).forEach(key => {
          plugins.push({
            name: key,
            version: window.eccube_plugins[key]
          });
        });
      }

      // 特定のクラス名パターンから推測
      const pluginIndicators = [
        'plg_', // プラグインプレフィックス
        'plugin-',
        'eccube-plugin-'
      ];

      pluginIndicators.forEach(prefix => {
        const elements = document.querySelectorAll(`[class*="${prefix}"]`);
        const uniquePlugins = new Set();
        elements.forEach(el => {
          const classes = el.className.split(' ');
          classes.forEach(cls => {
            if (cls.includes(prefix)) {
              uniquePlugins.add(cls);
            }
          });
        });
        uniquePlugins.forEach(plugin => {
          plugins.push({
            name: plugin,
            type: 'css-class'
          });
        });
      });

      return plugins;
    });
  }

  /**
   * パフォーマンス測定
   */
  async measurePerformance(page) {
    return await page.evaluate(() => {
      const perf = window.performance;
      const timing = perf.timing;
      
      return {
        loadTime: timing.loadEventEnd - timing.navigationStart,
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        firstPaint: perf.getEntriesByType('paint')[0]?.startTime || 0,
        resourceCount: perf.getEntriesByType('resource').length,
        totalResourceSize: perf.getEntriesByType('resource').reduce((total, resource) => {
          return total + (resource.transferSize || 0);
        }, 0)
      };
    });
  }
}

// EC-CUBE用のテストデータプロバイダー
export const EC_CUBE_TEST_DATA = {
  // 日本の住所データ
  addresses: {
    prefectures: [
      { code: '13', name: '東京都' },
      { code: '27', name: '大阪府' },
      { code: '14', name: '神奈川県' }
    ],
    cities: ['千代田区', '港区', '新宿区', '渋谷区'],
    streets: ['1-1-1', '2-2-2', '3-3-3', '本町1-2-3']
  },
  
  // 日本人の名前
  names: {
    lastNames: ['山田', '佐藤', '鈴木', '田中', '高橋'],
    firstNames: ['太郎', '花子', '一郎', '美咲', '健太'],
    lastNamesKana: ['ヤマダ', 'サトウ', 'スズキ', 'タナカ', 'タカハシ'],
    firstNamesKana: ['タロウ', 'ハナコ', 'イチロウ', 'ミサキ', 'ケンタ']
  },
  
  // 商品データ
  products: {
    names: ['Tシャツ', 'パーカー', 'ジーンズ', 'スニーカー', 'バッグ'],
    categories: ['トップス', 'ボトムス', 'アウター', 'シューズ', 'アクセサリー'],
    prices: [1000, 2000, 3000, 5000, 10000, 15000],
    colors: ['ホワイト', 'ブラック', 'グレー', 'ネイビー', 'レッド'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL']
  },
  
  // 支払い方法
  payments: {
    methods: ['クレジットカード', '代金引換', '銀行振込', 'コンビニ決済'],
    cards: ['VISA', 'MasterCard', 'JCB', 'AMEX']
  }
};