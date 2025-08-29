# Windows 11 セットアップガイド

## 🪟 Windows 11での文字化け問題の解決方法

Windows 11環境（特にWSL2使用時）でPlaywrightのブラウザに文字化けが発生する場合の対処法です。

## 問題の症状

- Playwrightで起動したブラウザで日本語が文字化けする（□□□と表示される）
- テストケースの録画時に日本語が正しく表示されない
- スクリーンショットで日本語が文字化けする
- WSL2環境で日本語フォントが見つからない
- CSV/Excelエクスポート時に文字化けやアスタリスクが表示される

## 解決方法

### 方法1: システムロケールの設定（推奨）

1. **Windows設定を開く**
   - `Windows + I` キーを押す
   - または「スタート」→「設定」

2. **時刻と言語設定**
   ```
   時刻と言語 → 言語と地域 → 管理用の言語の設定
   ```

3. **システムロケールの変更**
   ```
   管理タブ → システムロケールの変更 → 
   「日本語（日本）」を選択 → 
   「ベータ: ワールドワイド言語サポートでUnicode UTF-8を使用」にチェック
   ```

4. **システムを再起動**

### 方法2: 環境変数の設定

PowerShellまたはコマンドプロンプトで以下を設定：

```powershell
# PowerShell
[System.Environment]::SetEnvironmentVariable("LANG", "ja_JP.UTF-8", "User")
[System.Environment]::SetEnvironmentVariable("LC_ALL", "ja_JP.UTF-8", "User")

# または一時的に設定
$env:LANG="ja_JP.UTF-8"
$env:LC_ALL="ja_JP.UTF-8"
```

```cmd
# コマンドプロンプト
setx LANG "ja_JP.UTF-8"
setx LC_ALL "ja_JP.UTF-8"
```

### 方法3: Playwrightの設定変更

`playwright.config.js` を作成して以下を追加：

```javascript
export default {
  use: {
    // ブラウザの言語設定
    locale: 'ja-JP',
    
    // タイムゾーン
    timezoneId: 'Asia/Tokyo',
    
    // ブラウザの起動オプション
    launchOptions: {
      args: ['--lang=ja-JP']
    }
  }
};
```

**注意**: ES Modules形式（`export default`）を使用してください。`module.exports`はエラーになります。

### 方法4: フォントのインストール

日本語フォントが不足している場合：

1. **Windows Terminal または PowerShell を管理者権限で開く**

2. **日本語フォントパックをインストール**
   ```powershell
   # オプション機能から日本語補助フォントを追加
   DISM /Online /Add-Capability /CapabilityName:Language.Fonts.Jpan~~~und-JPAN~0.0.1.0
   ```

3. **Google Noto Fontsをインストール（オプション）**
   - https://fonts.google.com/noto/specimen/Noto+Sans+JP
   - ダウンロードして、フォントファイルを右クリック→「インストール」

### 方法5: WSL2を使用（完全な解決策）

Windows 11でWSL2（Windows Subsystem for Linux）を使用することで、Linux環境と同じ動作を実現：

1. **WSL2のインストール**
   ```powershell
   wsl --install
   ```

2. **Ubuntu環境でのセットアップ**
   ```bash
   # WSL2 Ubuntu内で実行
   cd /mnt/c/path/to/project
   ./init.sh
   ```

3. **日本語フォントのインストール（重要）**
   ```bash
   # 日本語フォントパッケージをインストール
   sudo apt update
   sudo apt install -y fonts-noto-cjk fonts-noto-cjk-extra
   ```

4. **日本語ロケールの設定**
   ```bash
   # ロケールを生成
   sudo locale-gen ja_JP.UTF-8
   sudo update-locale LANG=ja_JP.UTF-8
   
   # 環境変数を設定
   export LANG=ja_JP.UTF-8
   export LC_ALL=ja_JP.UTF-8
   
   # bashrcに追加（永続化）
   echo 'export LANG=ja_JP.UTF-8' >> ~/.bashrc
   echo 'export LC_ALL=ja_JP.UTF-8' >> ~/.bashrc
   source ~/.bashrc
   ```

5. **Playwright依存関係のインストール**
   ```bash
   # 必要なライブラリをインストール
   sudo apt-get install -y libnspr4 libnss3 libasound2t64
   
   # またはPlaywrightの推奨コマンド
   sudo npx playwright install-deps
   ```

## テスト実行時の追加オプション

Windows環境でテストを実行する際は、以下のオプションを追加：

```bash
# 環境変数を設定してから実行
set LANG=ja_JP.UTF-8
./web-test generate --url https://example.com

# またはPowerShellの場合
$env:LANG="ja_JP.UTF-8"
./web-test generate --url https://example.com
```

## config/settings.json への追加設定

Windows環境用の設定を追加：

```json
{
  "test_options": {
    "locale": "ja-JP",
    "timezoneId": "Asia/Tokyo",
    "browserArgs": ["--lang=ja-JP"],
    "headless": false
  },
  "encoding": {
    "primary": "shift_jis",
    "secondary": "utf8"
  }
}
```

### エンコーディング設定について

- **shift_jis**: 日本企業環境でのExcel互換性を重視
- **utf8**: 国際標準、他システムとの連携を重視
- **utf8_bom**: ExcelでUTF-8を正しく認識させたい場合

## WSL2環境での完全セットアップ手順

WSL2環境で文字化けを完全に解決するための一括セットアップ：

```bash
#!/bin/bash
# WSL2 日本語環境セットアップスクリプト

# システムアップデート
sudo apt update && sudo apt upgrade -y

# 日本語フォントインストール
sudo apt install -y fonts-noto-cjk fonts-noto-cjk-extra fonts-ipafont fonts-ipaexfont

# 日本語ロケール設定
sudo locale-gen ja_JP.UTF-8
sudo update-locale LANG=ja_JP.UTF-8

# 環境変数設定
export LANG=ja_JP.UTF-8
export LC_ALL=ja_JP.UTF-8
export LC_CTYPE=ja_JP.UTF-8

# bashrcに永続化
echo 'export LANG=ja_JP.UTF-8' >> ~/.bashrc
echo 'export LC_ALL=ja_JP.UTF-8' >> ~/.bashrc
echo 'export LC_CTYPE=ja_JP.UTF-8' >> ~/.bashrc

# Playwright依存関係
sudo apt-get install -y \
  libnspr4 \
  libnss3 \
  libasound2t64 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2

# フォントキャッシュ更新
fc-cache -fv

echo "✅ WSL2日本語環境セットアップ完了！"
echo "⚠️  新しいターミナルセッションを開いて設定を反映してください"
```

## トラブルシューティング

### それでも文字化けする場合

1. **ブラウザのキャッシュをクリア**
   ```bash
   rm -rf ~/.cache/ms-playwright
   npx playwright install chromium --force
   ```

2. **Node.jsのエンコーディング設定**
   ```javascript
   // web-testファイルの先頭に追加
   process.env.LANG = 'ja_JP.UTF-8';
   process.env.LC_ALL = 'ja_JP.UTF-8';
   ```

3. **Chromiumの日本語フォント指定**
   ```javascript
   // src/test-case-generator.js のブラウザ起動部分を修正
   const browser = await chromium.launch({
     headless: false,
     args: [
       '--lang=ja-JP',
       '--font-render-hinting=none',
       '--disable-font-subpixel-positioning'
     ]
   });
   ```

## 確認方法

以下のコマンドで文字化けが解決されているか確認：

```bash
# テスト録画を開始
./web-test generate --url https://example.com

# ブラウザで日本語が正しく表示されることを確認
```

## 関連情報

- [Playwright Locale Settings](https://playwright.dev/docs/emulation#locale--timezone)
- [Windows Terminal UTF-8 Support](https://docs.microsoft.com/windows/terminal/customize-settings/profile-advanced)
- [WSL2 Installation Guide](https://docs.microsoft.com/windows/wsl/install)