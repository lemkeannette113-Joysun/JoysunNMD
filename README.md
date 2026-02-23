# 要塞防御 (Fortress Defense)

这是一个基于 React 和 Vite 开发的经典导弹防御类塔防游戏。

## 功能特点
- **多级难度**：简单、困难、地狱。
- **升级系统**：每 600 分可选择升级爆炸范围或导弹速度。
- **双语支持**：中英文切换。
- **音效系统**：合成爆炸音效。
- **响应式设计**：适配手机和电脑。

## 部署到 Vercel

你可以轻松地将此项目部署到 Vercel：

1. **上传到 GitHub**：
   - 在 GitHub 上创建一个新的仓库。
   - 将此代码推送到仓库：
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     git remote add origin <你的仓库URL>
     git branch -M main
     git push -u origin main
     ```

2. **在 Vercel 中导入**：
   - 登录 [Vercel](https://vercel.com)。
   - 点击 "Add New" -> "Project"。
   - 选择你刚才创建的 GitHub 仓库。
   - 在 **Environment Variables** 中添加：
     - `GEMINI_API_KEY`: 你的 Google AI API 密钥（如果游戏逻辑中使用了 AI 功能）。
   - 点击 "Deploy"。

## 开发运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```
