/**
 * Playwright Configuration
 * 日本語環境向けの設定
 */

export default {
  // テストディレクトリ
  testDir: './tests',
  
  // タイムアウト設定
  timeout: 60000,
  
  // リトライ設定
  retries: 2,
  
  // ワーカー数
  workers: 1,
  
  // レポーター設定
  reporter: [
    ['html', { outputFolder: 'reports/playwright-report' }],
    ['json', { outputFile: 'reports/test-results.json' }]
  ],
  
  use: {
    // ブラウザの言語設定
    locale: 'ja-JP',
    
    // タイムゾーン
    timezoneId: 'Asia/Tokyo',
    
    // ビューポート設定
    viewport: null,
    
    // スクリーンショット設定
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true
    },
    
    // トレース設定
    trace: 'retain-on-failure',
    
    // ビデオ設定
    video: 'retain-on-failure',
    
    // ブラウザの起動オプション
    launchOptions: {
      args: [
        '--lang=ja-JP',
        '--font-render-hinting=none',
        '--disable-font-subpixel-positioning'
      ],
      slowMo: 0
    },
    
    // コンテキストオプション
    contextOptions: {
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
      acceptDownloads: true,
      ignoreHTTPSErrors: true
    }
  },
  
  // プロジェクト設定
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        channel: 'chrome'
      }
    },
    {
      name: 'firefox',
      use: {
        browserName: 'firefox'
      }
    },
    {
      name: 'webkit',
      use: {
        browserName: 'webkit'
      }
    }
  ],
  
  // 出力ディレクトリ
  outputDir: './test-results',
  
  // グローバルセットアップ
  globalSetup: undefined,
  
  // グローバルティアダウン
  globalTeardown: undefined
};