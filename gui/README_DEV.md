# Các lệnh CMD - Tunview GUI ( DEV )

## Tạo package.json :

```
npm init -y
```

## Tạo nodejs + electron :

```
npm install electron --save-dev
```

## Cài electrion-builder để tạo production :

```
npm install electron-builder --save-dev
```

## Chạy trên môi trường development :

```
npm start
```

## Build installer ( chạy cmd với quyền admin ) :

```
npm run build
```

# Các file mặc định - Tunview GUI ( DEV )

## main.js :

```js
const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

## preload.js :

```js
window.addEventListener("DOMContentLoaded", () => {
  console.log("Preload loaded!");
});
```

## package.json :

```json
{
  "name": "gui",
  "version": "1.0.0",
  "main": "main.js",
  "description": "",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder"
  },
  "devDependencies": {
    "electron": "^39.2.4",
    "electron-builder": "^25.0.0"
  },
  "build": {
    "appId": "com.tunview.desktop",
    "productName": "Tunview Desktop",
    "directories": {
      "output": "dist"
    },
    "win": {
      "target": "nsis"
    },
    "nsis": {
      "oneClick": false,
      "perMachine": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```
