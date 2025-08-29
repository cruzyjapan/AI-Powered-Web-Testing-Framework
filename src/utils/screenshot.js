import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// sharp is optional for image optimization
let sharp;
try {
  sharp = await import('sharp');
} catch (error) {
  // sharp is not installed, will fallback to basic saving
}

class ScreenshotManager {
  constructor(config) {
    this.config = config;
    this.screenshotDir = null;
  }

  setScreenshotDirectory(baseDir) {
    this.screenshotDir = path.join(baseDir, 'screenshots');
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
    return this.screenshotDir;
  }

  async capture(page, testId, stepNumber = null) {
    if (!this.config.test_options.screenshot_enabled) {
      return null;
    }

    if (!this.screenshotDir) {
      console.warn(chalk.yellow('スクリーンショットディレクトリが設定されていません'));
      return null;
    }

    try {
      const timestamp = Date.now();
      const stepSuffix = stepNumber ? `_step${stepNumber}` : '';
      const filename = `${testId}${stepSuffix}_${timestamp}.png`;
      const filepath = path.join(this.screenshotDir, filename);

      // スクリーンショット撮影
      const buffer = await page.screenshot({
        fullPage: true,
        type: 'png'
      });

      // 品質調整
      if (this.config.output_settings.screenshot_quality < 100) {
        await this.optimizeScreenshot(buffer, filepath);
      } else {
        fs.writeFileSync(filepath, buffer);
      }

      return `screenshots/${filename}`;
    } catch (error) {
      console.error(chalk.red('スクリーンショット撮影エラー:'), error.message);
      return null;
    }
  }

  async optimizeScreenshot(buffer, filepath) {
    try {
      const quality = this.config.output_settings.screenshot_quality;
      
      // sharpが利用可能な場合は画像を最適化
      if (sharp) {
        await sharp(buffer)
          .png({ quality: quality, compressionLevel: 9 })
          .toFile(filepath);
      } else {
        // sharpが利用できない場合はそのまま保存
        fs.writeFileSync(filepath, buffer);
      }
    } catch (error) {
      // エラーが発生した場合はそのまま保存
      fs.writeFileSync(filepath, buffer);
    }
  }

  async captureElement(page, selector, testId) {
    if (!this.config.test_options.screenshot_enabled) {
      return null;
    }

    try {
      const element = await page.$(selector);
      if (!element) {
        console.warn(chalk.yellow(`要素が見つかりません: ${selector}`));
        return null;
      }

      const timestamp = Date.now();
      const filename = `${testId}_element_${timestamp}.png`;
      const filepath = path.join(this.screenshotDir, filename);

      const buffer = await element.screenshot();
      fs.writeFileSync(filepath, buffer);

      return `screenshots/${filename}`;
    } catch (error) {
      console.error(chalk.red('要素スクリーンショット撮影エラー:'), error.message);
      return null;
    }
  }

  async compareScreenshots(baseline, current) {
    // スクリーンショット比較機能（将来的な実装）
    try {
      // pixelmatchなどのライブラリを使用して画像を比較
      // const diff = pixelmatch(baseline, current, ...);
      // return diff;
      
      console.log(chalk.yellow('スクリーンショット比較機能は未実装です'));
      return null;
    } catch (error) {
      console.error(chalk.red('スクリーンショット比較エラー:'), error.message);
      return null;
    }
  }

  cleanOldScreenshots(daysToKeep = 7) {
    if (!this.screenshotDir || !fs.existsSync(this.screenshotDir)) {
      return;
    }

    const now = Date.now();
    const cutoffTime = now - (daysToKeep * 24 * 60 * 60 * 1000);

    try {
      const files = fs.readdirSync(this.screenshotDir);
      let deletedCount = 0;

      files.forEach(file => {
        const filepath = path.join(this.screenshotDir, file);
        const stats = fs.statSync(filepath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filepath);
          deletedCount++;
        }
      });

      if (deletedCount > 0) {
        console.log(chalk.gray(`${deletedCount}個の古いスクリーンショットを削除しました`));
      }
    } catch (error) {
      console.error(chalk.red('古いスクリーンショットの削除エラー:'), error.message);
    }
  }

  generateScreenshotGallery(screenshots, reportDir) {
    const galleryPath = path.join(reportDir, 'screenshot-gallery.html');
    
    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>スクリーンショットギャラリー</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            background: #f5f5f5; 
        }
        .gallery { 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
            gap: 20px; 
        }
        .screenshot-card { 
            background: white; 
            border-radius: 8px; 
            overflow: hidden; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
        }
        .screenshot-card img { 
            width: 100%; 
            height: auto; 
            cursor: pointer; 
        }
        .screenshot-info { 
            padding: 10px; 
        }
        .screenshot-title { 
            font-weight: bold; 
            margin-bottom: 5px; 
        }
        .screenshot-time { 
            color: #666; 
            font-size: 0.9em; 
        }
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.9);
        }
        .modal-content {
            margin: auto;
            display: block;
            max-width: 90%;
            max-height: 90%;
            margin-top: 50px;
        }
        .close {
            position: absolute;
            top: 15px;
            right: 35px;
            color: #f1f1f1;
            font-size: 40px;
            font-weight: bold;
            cursor: pointer;
        }
        .close:hover { color: #bbb; }
    </style>
</head>
<body>
    <h1>スクリーンショットギャラリー</h1>
    <div class="gallery">
        ${screenshots.map((screenshot, index) => `
        <div class="screenshot-card">
            <img src="${screenshot.path}" alt="${screenshot.title}" onclick="openModal(${index})">
            <div class="screenshot-info">
                <div class="screenshot-title">${screenshot.title}</div>
                <div class="screenshot-time">${screenshot.time}</div>
            </div>
        </div>
        `).join('')}
    </div>
    
    <div id="modal" class="modal">
        <span class="close" onclick="closeModal()">&times;</span>
        <img class="modal-content" id="modalImg">
    </div>
    
    <script>
        const screenshots = ${JSON.stringify(screenshots)};
        
        function openModal(index) {
            const modal = document.getElementById('modal');
            const modalImg = document.getElementById('modalImg');
            modal.style.display = 'block';
            modalImg.src = screenshots[index].path;
        }
        
        function closeModal() {
            document.getElementById('modal').style.display = 'none';
        }
        
        window.onclick = function(event) {
            const modal = document.getElementById('modal');
            if (event.target == modal) {
                closeModal();
            }
        }
    </script>
</body>
</html>`;

    try {
      fs.writeFileSync(galleryPath, html, 'utf8');
      console.log(chalk.green('✅ スクリーンショットギャラリー生成: screenshot-gallery.html'));
    } catch (error) {
      console.error(chalk.red('ギャラリー生成エラー:'), error.message);
    }
  }
}

export default ScreenshotManager;