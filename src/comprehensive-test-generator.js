// 包括的なテストケース生成機能
import { TEST_GENERATION_PROMPT, TEST_DATA, SECURITY_TEST_TEMPLATES } from './ai-test-prompts.js';

export class ComprehensiveTestGenerator {
  
  /**
   * 入力フィールドの属性から適切なテストデータを生成
   */
  generateTestDataForInput(element) {
    const testData = {
      valid: [],
      invalid: [],
      boundary: []
    };
    
    // 入力タイプに基づいてテストデータを生成
    switch (element.type) {
      case 'email':
        testData.valid = ['test@example.com', 'user.name+tag@domain.co.jp'];
        testData.invalid = ['invalid-email', '@example.com', 'test@'];
        break;
        
      case 'tel':
        testData.valid = ['090-1234-5678', '03-1234-5678', '+81-90-1234-5678'];
        testData.invalid = ['abc-defg-hijk', '12345'];
        break;
        
      case 'url':
        testData.valid = ['https://example.com', 'http://localhost:3000'];
        testData.invalid = ['not-a-url', 'ftp://invalid'];
        break;
        
      case 'number':
        const min = element.min ? parseFloat(element.min) : -999999;
        const max = element.max ? parseFloat(element.max) : 999999;
        testData.valid = [String((min + max) / 2)];
        testData.boundary = [String(min), String(max)];
        testData.invalid = [String(min - 1), String(max + 1), 'abc'];
        break;
        
      case 'date':
        testData.valid = [new Date().toISOString().split('T')[0]];
        if (element.min) testData.boundary.push(element.min);
        if (element.max) testData.boundary.push(element.max);
        break;
        
      case 'password':
        testData.valid = ['Password123!', 'SecureP@ss2024'];
        testData.invalid = ['123', 'abc', ''];
        break;
        
      case 'textarea':
        // テキストエリア用の長文テストデータ
        testData.valid = [
          'これはテストメッセージです。\n複数行のテキストを入力できます。',
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit.\nSed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          '第1段落\n\n第2段落\n\n第3段落'
        ];
        testData.boundary = [
          'a'.repeat(1000), // 長文テスト
          'あ'.repeat(500)  // 日本語長文テスト
        ];
        testData.invalid = [
          'a'.repeat(10001), // 超長文
          ''  // 空文字
        ];
        break;
        
      default:
        // テキスト入力のデフォルト
        if (element.maxLength) {
          testData.valid.push('a'.repeat(Math.min(element.maxLength, 50)));
          testData.boundary.push('a'.repeat(element.maxLength));
          testData.invalid.push('a'.repeat(element.maxLength + 1));
        }
        if (element.minLength) {
          testData.boundary.push('a'.repeat(element.minLength));
          testData.invalid.push('a'.repeat(Math.max(0, element.minLength - 1)));
        }
        if (element.pattern) {
          // パターンに基づいた推測
          testData.valid.push('TestData123');
        }
        if (element.placeholder) {
          // プレースホルダーから推測
          const placeholder = element.placeholder.toLowerCase();
          if (placeholder.includes('名前') || placeholder.includes('name')) {
            testData.valid.push('山田太郎');
          } else if (placeholder.includes('メール') || placeholder.includes('email')) {
            testData.valid.push('test@example.com');
          } else if (placeholder.includes('電話') || placeholder.includes('tel')) {
            testData.valid.push('090-1234-5678');
          } else {
            testData.valid.push('テストデータ');
          }
        }
    }
    
    // 必須フィールドの場合は空欄もテスト
    if (element.required) {
      testData.invalid.push('');
    }
    
    return testData;
  }
  
  /**
   * ページ全体を体系的に解析
   */
  async analyzePageComprehensive(page, url) {
    // タイムアウトを設定し、より緩い条件で待機
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',  // networkidleより早く完了
        timeout: 60000 
      });
      
      // 追加の待機（重いサイトの場合）
      await page.waitForTimeout(2000);
    } catch (error) {
      if (error.name === 'TimeoutError') {
        console.log('⚠️ ページの読み込みに時間がかかりましたが、解析を続行します');
        // タイムアウトしても現在の状態で続行
      } else {
        throw error;
      }
    }
    
    const analysis = {
      url: url,
      title: await page.title().catch(() => 'タイトル取得失敗'),
      timestamp: new Date().toISOString(),
      elements: await this.collectAllElements(page),
      forms: await this.analyzeForms(page),
      security: await this.analyzeSecurityFeatures(page),
      accessibility: await this.analyzeAccessibility(page)
    };
    
    return analysis;
  }
  
  /**
   * すべてのインタラクティブ要素を収集（上から下、左から右の順）
   */
  async collectAllElements(page) {
    return await page.evaluate(() => {
      const elements = {
        links: [],
        buttons: [],
        inputs: [],
        textareas: [],
        selects: [],
        checkboxes: [],
        radios: [],
        fileInputs: [],
        dateInputs: [],
        numberInputs: [],
        emailInputs: [],
        telInputs: [],
        urlInputs: [],
        searchInputs: [],
        colorInputs: [],
        rangeInputs: [],
        interactiveElements: []
      };
      
      // すべてのインタラクティブ要素を取得
      const allSelectors = [
        'a[href]',
        'button',
        'input',
        'textarea',
        'select',
        '[role="button"]',
        '[onclick]',
        '[contenteditable="true"]'
      ];
      
      const allElements = document.querySelectorAll(allSelectors.join(', '));
      
      // 座標でソート（上から下、左から右）
      const sortedElements = Array.from(allElements).sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        
        // Y座標の差が5px以上ある場合は上下で判定
        if (Math.abs(rectA.top - rectB.top) > 5) {
          return rectA.top - rectB.top;
        }
        // 同じ高さの場合は左右で判定
        return rectA.left - rectB.left;
      });
      
      // 要素を分類
      sortedElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const elementInfo = {
          tagName: element.tagName.toLowerCase(),
          type: element.type || element.tagName.toLowerCase(),
          id: element.id,
          name: element.name || '',
          className: element.className,
          text: element.textContent?.trim().substring(0, 100) || '',
          value: element.value || '',
          href: element.href || '',
          required: element.required || false,
          disabled: element.disabled || false,
          readonly: element.readOnly || false,
          checked: element.checked || false,
          maxLength: element.maxLength > 0 ? element.maxLength : null,
          minLength: element.minLength > 0 ? element.minLength : null,
          min: element.min || null,
          max: element.max || null,
          step: element.step || null,
          pattern: element.pattern || null,
          placeholder: element.placeholder || '',
          accept: element.accept || null,
          multiple: element.multiple || false,
          autocomplete: element.autocomplete || null,
          position: {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          selector: element.id ? `#${element.id}` :
                   element.name ? `[name="${element.name}"]` :
                   element.className ? `.${element.className.split(' ')[0]}` :
                   `${element.tagName.toLowerCase()}`,
          attributes: {
            role: element.getAttribute('role'),
            ariaLabel: element.getAttribute('aria-label'),
            dataTestId: element.getAttribute('data-testid') || element.getAttribute('data-test-id')
          }
        };
        
        // 要素タイプごとに分類
        switch (element.tagName.toLowerCase()) {
          case 'a':
            elements.links.push(elementInfo);
            break;
          case 'button':
            elements.buttons.push(elementInfo);
            break;
          case 'input':
            switch (element.type) {
              case 'checkbox':
                elements.checkboxes.push(elementInfo);
                break;
              case 'radio':
                elements.radios.push(elementInfo);
                break;
              case 'file':
                elements.fileInputs.push(elementInfo);
                break;
              case 'date':
              case 'datetime-local':
              case 'month':
              case 'week':
              case 'time':
                elements.dateInputs.push(elementInfo);
                break;
              case 'number':
                elements.numberInputs.push(elementInfo);
                break;
              case 'email':
                elements.emailInputs.push(elementInfo);
                break;
              case 'tel':
                elements.telInputs.push(elementInfo);
                break;
              case 'url':
                elements.urlInputs.push(elementInfo);
                break;
              case 'search':
                elements.searchInputs.push(elementInfo);
                break;
              case 'color':
                elements.colorInputs.push(elementInfo);
                break;
              case 'range':
                elements.rangeInputs.push(elementInfo);
                break;
              default:
                elements.inputs.push(elementInfo);
                break;
            }
            break;
          case 'textarea':
            elements.textareas.push(elementInfo);
            break;
          case 'select':
            elementInfo.options = Array.from(element.options || []).map(opt => ({
              value: opt.value,
              text: opt.text,
              selected: opt.selected
            }));
            elements.selects.push(elementInfo);
            break;
          default:
            if (element.getAttribute('role') === 'button' || element.onclick) {
              elements.interactiveElements.push(elementInfo);
            }
        }
      });
      
      return elements;
    });
  }
  
  /**
   * フォームの詳細解析
   */
  async analyzeForms(page) {
    return await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      
      return forms.map(form => {
        const formRect = form.getBoundingClientRect();
        
        return {
          id: form.id,
          name: form.name,
          action: form.action,
          method: form.method.toUpperCase(),
          enctype: form.enctype,
          position: {
            top: Math.round(formRect.top),
            left: Math.round(formRect.left)
          },
          hasCSRF: !!(form.querySelector('[name*="csrf" i], [name*="token" i], [name="_token"]')),
          fields: Array.from(form.querySelectorAll('input, textarea, select')).map(field => ({
            type: field.type || field.tagName.toLowerCase(),
            name: field.name,
            id: field.id,
            required: field.required,
            validation: {
              maxLength: field.maxLength > 0 ? field.maxLength : null,
              minLength: field.minLength > 0 ? field.minLength : null,
              pattern: field.pattern || null,
              min: field.min || null,
              max: field.max || null,
              step: field.step || null
            }
          })),
          submitButtons: Array.from(form.querySelectorAll('[type="submit"], button:not([type="button"]):not([type="reset"])')).map(btn => ({
            text: btn.textContent?.trim() || btn.value || 'Submit',
            name: btn.name,
            id: btn.id
          }))
        };
      });
    });
  }
  
  /**
   * セキュリティ機能の解析
   */
  async analyzeSecurityFeatures(page) {
    return await page.evaluate(() => {
      const security = {
        hasCSRFToken: false,
        hasContentSecurityPolicy: false,
        hasXFrameOptions: false,
        inputValidation: {
          emailFields: 0,
          passwordFields: 0,
          fieldsWithMaxLength: 0,
          fieldsWithPattern: 0
        },
        authentication: {
          hasLoginForm: false,
          hasPasswordField: false,
          hasRememberMe: false,
          hasCaptcha: false
        }
      };
      
      // CSRFトークンの検出
      security.hasCSRFToken = !!(document.querySelector('[name*="csrf" i], [name*="token" i], meta[name="csrf-token"]'));
      
      // メタタグからセキュリティヘッダーを確認
      const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      security.hasContentSecurityPolicy = !!cspMeta;
      
      // 入力フィールドの検証
      const emailFields = document.querySelectorAll('input[type="email"]');
      security.inputValidation.emailFields = emailFields.length;
      
      const passwordFields = document.querySelectorAll('input[type="password"]');
      security.inputValidation.passwordFields = passwordFields.length;
      security.authentication.hasPasswordField = passwordFields.length > 0;
      
      const inputsWithMaxLength = document.querySelectorAll('input[maxlength]');
      security.inputValidation.fieldsWithMaxLength = inputsWithMaxLength.length;
      
      const inputsWithPattern = document.querySelectorAll('input[pattern]');
      security.inputValidation.fieldsWithPattern = inputsWithPattern.length;
      
      // 認証関連
      security.authentication.hasLoginForm = !!(document.querySelector('form[action*="login" i], form[action*="signin" i], form[id*="login" i]'));
      security.authentication.hasRememberMe = !!(document.querySelector('input[type="checkbox"][name*="remember" i]'));
      security.authentication.hasCaptcha = !!(document.querySelector('[class*="captcha" i], [id*="captcha" i], [src*="captcha" i]'));
      
      return security;
    });
  }
  
  /**
   * アクセシビリティの解析
   */
  async analyzeAccessibility(page) {
    return await page.evaluate(() => {
      const accessibility = {
        hasLabels: 0,
        hasAriaLabels: 0,
        hasAltTexts: 0,
        hasTitles: 0,
        hasRoles: 0,
        tabIndexElements: 0,
        formFieldsWithLabels: 0,
        totalFormFields: 0
      };
      
      // ラベルの検出
      accessibility.hasLabels = document.querySelectorAll('label[for]').length;
      accessibility.hasAriaLabels = document.querySelectorAll('[aria-label]').length;
      accessibility.hasAltTexts = document.querySelectorAll('img[alt]').length;
      accessibility.hasTitles = document.querySelectorAll('[title]').length;
      accessibility.hasRoles = document.querySelectorAll('[role]').length;
      accessibility.tabIndexElements = document.querySelectorAll('[tabindex]').length;
      
      // フォームフィールドとラベルの関連
      const formFields = document.querySelectorAll('input, textarea, select');
      accessibility.totalFormFields = formFields.length;
      
      formFields.forEach(field => {
        if (field.labels?.length > 0 || field.getAttribute('aria-label')) {
          accessibility.formFieldsWithLabels++;
        }
      });
      
      return accessibility;
    });
  }
  
  /**
   * 包括的なテストケースを生成
   */
  generateComprehensiveTestCases(analysis) {
    const testCases = [];
    const targetUrl = analysis.url; // 解析したページのURLを使用
    
    // 1. リンクテスト
    analysis.elements.links.forEach((link, index) => {
      // 正常系
      testCases.push({
        testName: `リンクテスト_${index + 1}_正常系_クリック`,
        category: 'リンク',
        type: 'normal',
        priority: 'medium',
        target_url: targetUrl,  // URLを追加
        selector: link.selector,
        action: 'click',
        expectedResult: 'リンクがクリックでき、適切なページに遷移する',
        steps: [
          `要素「${link.selector}」を検索`,
          'リンクをクリック',
          'ページ遷移を確認'
        ]
      });
      
      // 異常系
      if (link.href.startsWith('http')) {
        testCases.push({
          testName: `リンクテスト_${index + 1}_異常系_404確認`,
          category: 'リンク',
          type: 'error',
          priority: 'low',
          target_url: targetUrl,
          selector: link.selector,
          action: 'checkStatus',
          expectedResult: '404エラーが適切に処理される',
          steps: [
            `リンク先URL「${link.href}」のステータスを確認`,
            '404の場合、エラーページが表示されることを確認'
          ]
        });
      }
    });
    
    // 2. 入力フィールドテスト
    const allInputs = [
      ...analysis.elements.inputs,
      ...analysis.elements.textareas
    ];
    
    allInputs.forEach((input, index) => {
      // 正常系テスト
      const validData = this.getValidTestData(input.type);
      testCases.push({
        testName: `入力テスト_${input.name || index}_正常系`,
        category: '入力',
        type: 'normal',
        priority: input.required ? 'high' : 'medium',
        selector: input.selector,
        action: 'fill',
        testData: validData,
        expectedResult: '有効な値が入力でき、エラーが表示されない',
        steps: [
          `入力フィールド「${input.selector}」を検索`,
          `値「${validData}」を入力`,
          'エラーメッセージが表示されないことを確認'
        ]
      });
      
      // 異常系テスト - 空値
      if (input.required) {
        testCases.push({
          testName: `入力テスト_${input.name || index}_異常系_空値`,
          category: '入力',
          type: 'error',
          priority: 'high',
          selector: input.selector,
          action: 'fill',
          testData: '',
          expectedResult: '必須項目エラーが表示される',
          steps: [
            `入力フィールド「${input.selector}」を空にする`,
            'フォームを送信',
            '必須項目エラーメッセージが表示されることを確認'
          ]
        });
      }
      
      // セキュリティテスト - XSS（全パターン）
      TEST_DATA.invalid.xss.forEach((xssPayload, xssIndex) => {
        testCases.push({
          testName: `入力テスト_${input.name || index}_セキュリティ_XSS_${xssIndex + 1}`,
          category: 'セキュリティ',
          type: 'security',
          priority: 'critical',
          target_url: analysis.url,
          prerequisites: `1. ページ「${analysis.url}」にアクセス可能\n2. 入力フィールド「${input.selector}」が存在する\n3. JavaScriptが有効である`,
          selector: input.selector,
          action: 'fill',
          testData: xssPayload,
          test_data: {
            attack_type: 'XSS',
            payload: xssPayload,
            actual_script: xssPayload,
            pattern_index: xssIndex + 1,
            total_patterns: TEST_DATA.invalid.xss.length,
            input_value: xssPayload
          },
          test_steps: [
            {
              step: 1,
              action: 'goto',
              target: analysis.url,
              description: 'ページを開く'
            },
            {
              step: 2,
              action: 'wait',
              target: input.selector,
              description: `入力フィールド「${input.selector}」を待機`
            },
            {
              step: 3,
              action: 'clear',
              target: input.selector,
              description: 'フィールドをクリア'
            },
            {
              step: 4,
              action: 'fill',
              target: input.selector,
              value: xssPayload,
              description: `XSS攻撃スクリプト「${xssPayload}」を入力`
            },
            {
              step: 5,
              action: 'press',
              key: 'Enter',
              description: 'Enterキーで送信または実行'
            },
            {
              step: 6,
              action: 'wait',
              time: 2000,
              description: 'スクリプト実行の可能性を待機'
            },
            {
              step: 7,
              action: 'check_no_alert',
              description: 'アラートが表示されていないことを確認'
            }
          ],
          expectedResult: `XSS攻撃「${xssPayload}」が防御される:\n` +
                         `- スクリプトが実行されない\n` +
                         `- アラートが表示されない\n` +
                         `- HTMLがエスケープされて表示される`,
          steps: [
            `入力フィールド「${input.selector}」を検索`,
            `XSS攻撃パターン${xssIndex + 1}「${xssPayload}」を入力`,
            'スクリプトが実行されないことを確認',
            'エスケープされて表示されることを確認',
            'アラートやポップアップが表示されないことを確認'
          ]
        });
      });
      
      // セキュリティテスト - SQLインジェクション（全パターン）
      TEST_DATA.invalid.sql.forEach((sqlPayload, sqlIndex) => {
        testCases.push({
          testName: `入力テスト_${input.name || index}_セキュリティ_SQL_${sqlIndex + 1}`,
          category: 'セキュリティ',
          type: 'security',
          priority: 'critical',
          target_url: analysis.url,
          prerequisites: `1. ページ「${analysis.url}」にアクセス可能\n2. 入力フィールド「${input.selector}」が存在する\n3. バックエンドでデータベース処理が行われる`,
          selector: input.selector,
          action: 'fill',
          testData: sqlPayload,
          test_data: {
            attack_type: 'SQL_INJECTION',
            payload: sqlPayload,
            actual_script: sqlPayload,
            pattern_index: sqlIndex + 1,
            total_patterns: TEST_DATA.invalid.sql.length,
            input_value: sqlPayload,
            sql_command: sqlPayload
          },
          test_steps: [
            {
              step: 1,
              action: 'goto',
              target: analysis.url,
              description: 'ページを開く'
            },
            {
              step: 2,
              action: 'wait',
              target: input.selector,
              description: `入力フィールド「${input.selector}」を待機`
            },
            {
              step: 3,
              action: 'clear',
              target: input.selector,
              description: 'フィールドをクリア'
            },
            {
              step: 4,
              action: 'fill',
              target: input.selector,
              value: sqlPayload,
              description: `SQLインジェクション「${sqlPayload}」を入力`
            },
            {
              step: 5,
              action: 'press',
              key: 'Enter',
              description: 'Enterキーで送信'
            },
            {
              step: 6,
              action: 'wait',
              time: 3000,
              description: 'データベース処理を待機'
            },
            {
              step: 7,
              action: 'check_no_error',
              patterns: ['SQL', 'syntax error', 'mysql_', 'mysqli', 'postgres', 'sqlite', 'ORA-', 'DB2'],
              description: 'SQLエラーが表示されていないことを確認'
            },
            {
              step: 8,
              action: 'check_console',
              description: 'コンソールにDBエラーがないことを確認'
            }
          ],
          expectedResult: `SQLインジェクション「${sqlPayload}」が防御される:\n` +
                         `- SQLクエリが実行されない\n` +
                         `- データベースエラーが露出しない\n` +
                         `- テーブル操作（DROP/DELETE等）が発生しない\n` +
                         `- 適切なバリデーションエラーが表示される`,
          steps: [
            `入力フィールド「${input.selector}」を検索`,
            `SQL攻撃パターン${sqlIndex + 1}「${sqlPayload}」を入力`,
            'SQLエラーが表示されないことを確認',
            'データベースに影響がないことを確認',
            '正常なエラーメッセージが表示されることを確認'
          ]
        });
      });
      
      // 最大文字数テスト
      if (input.maxLength) {
        testCases.push({
          testName: `入力テスト_${input.name || index}_異常系_最大文字数超過`,
          category: '入力',
          type: 'error',
          priority: 'medium',
          selector: input.selector,
          action: 'fill',
          testData: 'a'.repeat(input.maxLength + 1),
          expectedResult: `最大文字数${input.maxLength}を超える入力が制限される`,
          steps: [
            `入力フィールド「${input.selector}」を検索`,
            `${input.maxLength + 1}文字を入力`,
            `${input.maxLength}文字までしか入力できないことを確認`
          ]
        });
      }
    });
    
    // 3. ボタンテスト
    analysis.elements.buttons.forEach((button, index) => {
      // 正常系
      testCases.push({
        testName: `ボタンテスト_${button.text || index}_正常系`,
        category: 'ボタン',
        type: 'normal',
        priority: button.type === 'submit' ? 'high' : 'medium',
        selector: button.selector,
        action: 'click',
        expectedResult: 'ボタンがクリックでき、期待される動作が実行される',
        steps: [
          `ボタン「${button.selector}」を検索`,
          'ボタンをクリック',
          '期待される動作が実行されることを確認'
        ]
      });
      
      // 異常系 - 連続クリック
      testCases.push({
        testName: `ボタンテスト_${button.text || index}_異常系_連続クリック`,
        category: 'ボタン',
        type: 'error',
        priority: 'medium',
        selector: button.selector,
        action: 'doubleClick',
        expectedResult: '連続クリックが適切に制御される',
        steps: [
          `ボタン「${button.selector}」を検索`,
          'ボタンを素早く2回クリック',
          '処理が重複実行されないことを確認'
        ]
      });
    });
    
    // 4. フォームテスト
    analysis.forms.forEach((form, index) => {
      // CSRF確認
      if (!form.hasCSRF && form.method === 'POST') {
        testCases.push({
          testName: `フォームテスト_${form.id || index}_セキュリティ_CSRF`,
          category: 'セキュリティ',
          type: 'security',
          priority: 'high',
          selector: form.id ? `#${form.id}` : 'form',
          action: 'checkCSRF',
          expectedResult: 'CSRFトークンが存在し、検証される',
          steps: [
            'フォームにCSRFトークンが含まれていることを確認',
            'トークンなしでPOSTリクエストを送信',
            'リクエストが拒否されることを確認'
          ]
        });
      }
    });
    
    return testCases;
  }
  
  /**
   * 入力タイプに応じた有効なテストデータを取得
   */
  getValidTestData(inputType) {
    const typeMap = {
      'email': TEST_DATA.valid.email[0],
      'password': TEST_DATA.valid.password[0],
      'tel': TEST_DATA.valid.phone[0],
      'url': TEST_DATA.valid.url[0],
      'date': TEST_DATA.valid.date[0],
      'number': TEST_DATA.valid.number[0],
      'text': TEST_DATA.valid.text[0],
      'textarea': TEST_DATA.valid.text[0]
    };
    
    return typeMap[inputType] || TEST_DATA.valid.text[0];
  }
}

export default ComprehensiveTestGenerator;