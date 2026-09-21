// 将 OpenAPI 数据粘贴到同目录 api-doc.json，运行 bun docs/generate-api-doc.js。
// 自动生成同目录 api-doc.html；样式和交互均内嵌，无需其他模板文件。
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { resolve } from "path";
import { Script } from "vm";

// 内嵌 HTML 模板。
var api_doc_template_default = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>%%TITLE%% \xB7 AI Gateway API \u6587\u6863</title>
    <style>
      :root {
        --bg: #fff;
        --soft: #f8f8fa;
        --ink: #202127;
        --muted: #50535d;
        --line: #e5e5e9;
        --accent: #b92e78;
        --tint: #fbeaf3;
        --green: #187452;
        --code: #f7f7f9;
        --code-text: #252938;
        --radius: 9px;
      }
      [data-theme="dark"] {
        --bg: #141923;
        --soft: #1b2230;
        --ink: #e5eaf3;
        --muted: #bcc6d6;
        --line: #30394b;
        --accent: #b3a5ff;
        --tint: #2e264b;
        --green: #78d9b4;
        --code: #0d121c;
        --code-text: #edf2fa;
      }
      * {
        box-sizing: border-box;
      }
      html {
        scroll-behavior: smooth;
        scroll-padding-top: 94px;
      }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--ink);
        font:
          14px/1.65 -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          "Microsoft YaHei",
          sans-serif;
      }
      button,
      input,
      textarea,
      select {
        font: inherit;
      }
      button,
      a,
      input,
      textarea,
      select {
        -webkit-tap-highlight-color: transparent;
      }
      button {
        cursor: pointer;
      }
      a {
        color: inherit;
        text-decoration: none;
      }
      button {
        border: 1px solid var(--line);
        background: var(--bg);
        color: var(--ink);
        border-radius: 7px;
        padding: 7px 12px;
      }
      button:hover {
        background: var(--soft);
      }
      :focus-visible {
        outline: 3px solid var(--accent);
        outline-offset: 3px;
      }
      code,
      pre,
      textarea,
      .mono {
        font-family: Consolas, "SFMono-Regular", monospace;
      }
      code {
        font-size: 0.91em;
      }
      p {
        color: var(--muted);
      }
      .topbar {
        height: 68px;
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 30px;
        border-bottom: 1px solid var(--line);
        background: var(--bg);
        gap: 16px;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 700;
        font-size: 17px;
      }
      .logo {
        background: var(--accent);
        color: var(--bg);
        width: 31px;
        height: 31px;
        display: grid;
        place-items: center;
        border-radius: 9px;
        font-family: monospace;
      }
      .brand small {
        font-size: 12px;
        color: var(--muted);
        font-weight: 400;
        border-left: 1px solid var(--line);
        padding-left: 14px;
      }
      .actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .version {
        font-size: 12px;
        color: var(--muted);
        margin-right: 12px;
      }
      .layout {
        max-width: 1700px;
        margin: auto;
        display: grid;
        grid-template-columns: 228px minmax(0, 1fr);
      }
      .sidebar {
        position: sticky;
        top: 68px;
        height: calc(100vh - 68px);
        border-right: 1px solid var(--line);
        padding: 32px 18px;
        display: flex;
        flex-direction: column;
      }
      .nav-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1.6px;
        color: var(--muted);
        padding: 0 12px;
        margin: 20px 0 10px;
      }
      .sidebar a {
        display: block;
        padding: 9px 12px;
        border-radius: 7px;
        color: var(--muted);
        font-size: 13px;
      }
      .sidebar a:hover {
        background: var(--soft);
        color: var(--ink);
      }
      .sidebar .selected {
        background: var(--tint);
        color: var(--accent);
        font-weight: 600;
      }
      .tiny-post {
        font-size: 9px;
        font-weight: 800;
        color: var(--green);
        margin-right: 7px;
      }
      .side-footer {
        margin-top: auto;
        padding: 18px 12px 0;
        border-top: 1px solid var(--line);
        font-size: 11px;
        color: var(--muted);
      }
      .dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        background: var(--green);
        border-radius: 50%;
        margin-right: 6px;
      }
      main {
        min-width: 0;
        padding: 44px 42px 60px;
      }
      .breadcrumb {
        color: var(--muted);
        font-size: 12px;
        margin-bottom: 20px;
      }
      .breadcrumb span {
        padding: 0 9px;
        color: #98a1af;
      }
      .hero {
        margin-bottom: 32px;
      }
      .eyebrow {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 1.5px;
        color: var(--accent);
      }
      h1 {
        font-size: 36px;
        line-height: 1.25;
        letter-spacing: -1.1px;
        margin: 12px 0;
      }
      h2 {
        font-size: 18px;
        margin: 0 0 18px;
        letter-spacing: -0.3px;
      }
      h3 {
        font-size: 14px;
        margin: 0;
      }
      .hero p {
        max-width: 670px;
        margin: 12px 0 20px;
        line-height: 1.9;
      }
      .badges {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .badge {
        border: 1px solid var(--line);
        border-radius: 5px;
        padding: 2px 8px;
        color: var(--muted);
        font-size: 11px;
      }
      .endpoint {
        display: flex;
        align-items: center;
        gap: 13px;
        background: var(--soft);
        border: 1px solid var(--line);
        border-radius: 9px;
        padding: 13px 16px;
        margin: 25px 0 0;
        max-width: 720px;
      }
      .method {
        background: #dff4e9;
        color: #176246;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 800;
        padding: 3px 8px;
      }
      .endpoint code {
        overflow-wrap: anywhere;
      }
      .endpoint button {
        margin-left: auto;
        font-size: 11px;
        flex-shrink: 0;
      }
      .columns {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(340px, 0.9fr);
        gap: 34px;
        align-items: start;
      }
      .content {
        min-width: 0;
      }
      .section {
        padding-top: 8px;
        margin-bottom: 36px;
      }
      .section-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 16px;
      }
      .section-title h2 {
        margin: 0;
      }
      .caption {
        font-size: 11px;
        color: var(--muted);
      }
      .notice {
        background: var(--tint);
        border: 1px solid var(--line);
        border-radius: 9px;
        padding: 13px 15px;
        font-size: 12px;
        color: var(--ink);
        line-height: 1.85;
      }
      .auth {
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 18px;
        margin-top: 15px;
      }
      .auth-head {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 12px;
      }
      .auth p {
        font-size: 12px;
        margin: 8px 0;
      }
      .auth code {
        display: block;
        background: var(--soft);
        padding: 10px;
        border-radius: 6px;
        overflow-wrap: anywhere;
      }
      .search {
        width: 100%;
        border: 1px solid var(--line);
        background: var(--soft);
        color: var(--ink);
        padding: 10px 12px;
        border-radius: 8px;
        margin-bottom: 14px;
      }
      .field {
        border-bottom: 1px solid var(--line);
        padding: 16px 0;
        min-width: 0;
      }
      .field-head {
        display: flex;
        gap: 9px;
        align-items: baseline;
        flex-wrap: wrap;
      }
      .field-name {
        font-size: 12px;
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .type {
        font:
          11px Consolas,
          monospace;
        color: var(--muted);
      }
      .required {
        font-size: 10px;
        color: #b13d57;
        background: #fff0f3;
        border-radius: 4px;
        padding: 1px 5px;
      }
      .field p {
        font-size: 12px;
        margin: 7px 0 0;
      }
      .constraint {
        display: inline-block;
        margin: 7px 5px 0 0;
        padding: 1px 6px;
        border-radius: 4px;
        background: var(--soft);
        font:
          10px/1.8 Consolas,
          monospace;
        color: var(--muted);
        overflow-wrap: anywhere;
        max-width: 100%;
      }
      .field details {
        margin-top: 10px;
      }
      .field summary {
        cursor: pointer;
        color: var(--accent);
        font-size: 11px;
      }
      .nested {
        border-left: 1px solid var(--line);
        padding-left: 14px;
        margin: 5px 0;
      }
      .nested .field:last-child {
        border-bottom: 0;
      }
      .empty {
        padding: 20px;
        text-align: center;
        color: var(--muted);
        font-size: 12px;
      }
      .status-row {
        display: flex;
        gap: 14px;
        padding: 13px 0;
        border-bottom: 1px solid var(--line);
        font-size: 12px;
      }
      .status-code {
        font-family: monospace;
        font-weight: 700;
        color: var(--green);
        min-width: 30px;
      }
      .examples {
        position: sticky;
        top: 92px;
        min-width: 0;
      }
      .panel {
        border: 1px solid var(--line);
        border-radius: var(--radius);
        overflow: hidden;
        margin-bottom: 19px;
      }
      .panel-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 13px 16px;
        gap: 10px;
        background: var(--soft);
        border-bottom: 1px solid var(--line);
      }
      .panel-head strong {
        font-size: 12px;
      }
      .panel-head span {
        font-size: 10px;
        color: var(--muted);
      }
      .config {
        padding: 16px;
      }
      .config label {
        display: block;
        font-size: 11px;
        font-weight: 600;
        margin-bottom: 6px;
      }
      .config input,
      .config select {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid var(--line);
        border-radius: 6px;
        color: var(--ink);
        background: var(--bg);
        font-size: 12px;
      }
      .config select {
        margin-bottom: 12px;
      }
      .config p {
        font-size: 10px;
        margin: 7px 0 0;
      }
      .code-panel {
        background: var(--code);
        color: var(--code-text);
      }
      .tabs {
        display: flex;
        gap: 3px;
        padding: 9px 10px 0;
        border-bottom: 1px solid #2b3341;
        align-items: center;
        flex-wrap: wrap;
      }
      .tabs button {
        position: relative;
        border: 0;
        background: none;
        border-radius: 0;
        color: #9eabc0;
        font-size: 11px;
        padding: 9px 9px 11px;
      }
      .tabs button[aria-pressed="true"] {
        color: #ddd4ff;
      }
      .tabs button[data-language]::after,
      .tabs button[data-response]::after {
        content: "";
        position: absolute;
        right: 8px;
        bottom: 3px;
        left: 8px;
        height: 2px;
        border-radius: 999px;
        background: #b5a4ff;
        opacity: 0;
        transform: scaleX(0);
        transform-origin: center;
        transition:
          opacity 120ms ease,
          transform 220ms var(--ease);
      }
      .tabs button[aria-pressed="true"]::after {
        opacity: 1;
        transform: scaleX(1);
      }
      .tabs button:hover {
        color: #fff;
      }
      .tabs .copy {
        margin-left: auto;
        color: #bfcadd;
        font-size: 10px;
      }
      pre {
        font-size: 11px;
        line-height: 1.9;
        padding: 18px;
        margin: 0;
        overflow: auto;
        max-height: 430px;
        tab-size: 2;
      }
      .token-key {
        color: #a9bfff;
      }
      .token-string {
        color: #a6d5b0;
      }
      .token-number {
        color: #efc18e;
      }
      .token-literal {
        color: #c2a9f7;
      }
      .code-footer {
        border-top: 1px solid #2b3341;
        font-size: 10px;
        color: #9eabc0;
        padding: 9px 16px;
      }
      .editor {
        display: block;
        resize: vertical;
        width: 100%;
        min-height: 250px;
        background: var(--code);
        color: var(--code-text);
        border: 0;
        padding: 16px;
        font-size: 11px;
        line-height: 1.8;
      }
      .editor-tools {
        display: flex;
        gap: 8px;
        padding: 10px 14px;
        align-items: center;
      }
      .editor-tools button {
        font-size: 11px;
      }
      .error {
        font-size: 11px;
        color: #c3465d;
        padding: 0 14px 12px;
        margin: 0;
      }
      .note {
        font-size: 11px;
        color: var(--muted);
        line-height: 1.9;
      }
      .footer {
        margin-top: 40px;
        border-top: 1px solid var(--line);
        padding-top: 16px;
        font-size: 11px;
        color: var(--muted);
      }
      .toast {
        position: fixed;
        bottom: 25px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--ink);
        color: var(--bg);
        padding: 10px 20px;
        border-radius: 8px;
        z-index: 30;
        font-size: 12px;
        max-width: 90vw;
      }
      .skip {
        position: fixed;
        top: -100px;
        left: 20px;
        z-index: 50;
        background: var(--bg);
        padding: 10px;
      }
      .skip:focus {
        top: 8px;
      }
      [hidden] {
        display: none !important;
      }
      @media (min-width: 1500px) {
        main {
          padding: 48px 60px;
        }
        .columns {
          gap: 48px;
        }
      }
      @media (max-width: 1150px) {
        .layout {
          grid-template-columns: 185px minmax(0, 1fr);
        }
        main {
          padding: 32px 24px;
        }
        .columns {
          grid-template-columns: minmax(0, 1fr);
        }
        .examples {
          position: static;
          grid-row: 1;
        }
        .examples pre {
          max-height: 300px;
        }
        .sidebar {
          padding: 25px 10px;
        }
      }
      @media (max-width: 640px) {
        .sidebar {
          display: none;
        }
        .layout {
          display: block;
        }
        .topbar {
          padding: 0 16px;
          height: 60px;
        }
        .brand {
          font-size: 14px;
        }
        .brand small,
        .version {
          display: none;
        }
        main {
          padding: 26px 18px;
        }
        h1 {
          font-size: 29px;
        }
        .topbar button {
          font-size: 11px;
          padding: 6px 8px;
        }
        .hero {
          margin-bottom: 24px;
        }
        .endpoint {
          padding: 11px;
          gap: 8px;
        }
        .endpoint code {
          font-size: 11px;
        }
      }
      /* Keep documentation readable at the browser's default zoom, including mobile. */
      body {
        font-size: 16px;
        line-height: 1.8;
      }
      h2 {
        font-size: 22px;
      }
      h3 {
        font-size: 16px;
      }
      .sidebar a,
      .notice,
      .auth p,
      .field-name,
      .field p,
      .status-row,
      .panel-head strong,
      .config input,
      .config select,
      .empty,
      .toast {
        font-size: 15px;
      }
      .brand small,
      .version,
      .breadcrumb,
      .badge,
      .caption,
      .type,
      .constraint,
      .field summary,
      .config label,
      .config p,
      .tabs button,
      .tabs .copy,
      .editor-tools button,
      .error,
      .note,
      .footer,
      .side-footer,
      .endpoint button {
        font-size: 14px;
      }
      .nav-label,
      .tiny-post,
      .eyebrow,
      .method,
      .required,
      .panel-head span,
      .code-footer {
        font-size: 13px;
      }
      pre,
      .editor {
        font-size: 14px;
        line-height: 1.85;
      }
      pre code {
        font-size: inherit;
      }
      .tabs button,
      .code-footer {
        color: #bdc9dc;
      }
      .breadcrumb span {
        color: var(--muted);
      }
      .field {
        padding: 19px 0;
      }
      .field p {
        line-height: 1.85;
      }
      .type {
        overflow-wrap: anywhere;
      }
      .panel-head,
      .section-title {
        flex-wrap: wrap;
      }
      .examples {
        max-height: calc(100vh - 110px);
        overflow-y: auto;
        scrollbar-gutter: stable;
      }
      @media (max-width: 1150px) {
        .examples {
          max-height: none;
          overflow: visible;
          scrollbar-gutter: auto;
        }
      }
      @media (max-width: 640px) {
        .topbar {
          height: auto;
          min-height: 68px;
          flex-wrap: wrap;
          padding: 12px 16px;
        }
        .topbar button {
          font-size: 13px;
        }
        .endpoint {
          flex-wrap: wrap;
        }
        .endpoint code {
          font-size: 14px;
        }
        .config input,
        .config select,
        .search,
        .editor {
          font-size: 16px;
        }
      }
      .layout {
        max-width: 1560px;
        grid-template-columns: 240px minmax(0, 1fr);
      }
      .sidebar {
        background: var(--soft);
      }
      main {
        padding: 38px 36px 60px;
      }
      .hero {
        border-bottom: 1px solid var(--line);
        padding-bottom: 25px;
        margin-bottom: 26px;
      }
      h1 {
        font-size: 29px;
        letter-spacing: 0;
        margin: 0 0 15px;
      }
      .doc-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .doc-actions button {
        font-size: 13px;
        padding: 5px 10px;
        background: var(--soft);
      }
      .intro {
        margin: 0 0 25px;
        font-size: 15px;
      }
      .columns {
        grid-template-columns: minmax(0, 1.2fr) minmax(360px, 1fr);
        gap: 26px;
      }
      .endpoint {
        margin: 0;
        border: 0;
        border-bottom: 1px solid var(--line);
        border-radius: 0;
        background: transparent;
        padding: 15px;
      }
      .method {
        background: transparent;
        color: #365bb5;
        padding: 0;
        font-size: 12px;
      }
      .endpoint button {
        color: var(--accent);
      }
      .request-card {
        border: 1px solid var(--line);
        border-radius: var(--radius);
        margin-bottom: 30px;
        overflow: hidden;
        background: var(--soft);
      }
      .request-card > details > summary {
        padding: 11px 15px;
        cursor: pointer;
        font-size: 14px;
      }
      .request-card > details + details {
        border-top: 1px solid var(--line);
      }
      .config {
        border-top: 1px solid var(--line);
      }
      .auth {
        border: 0;
        border-radius: 0;
        padding: 0;
        margin: 0;
      }
      .auth code {
        background: var(--soft);
        font-size: 14px;
      }
      .field-name {
        color: var(--accent);
      }
      .field {
        padding: 14px 0;
      }
      .required {
        background: transparent;
        color: var(--accent);
      }
      .constraint {
        background: transparent;
        padding-left: 0;
      }
      .section {
        margin-bottom: 30px;
      }
      .examples {
        top: 88px;
        max-height: calc(100vh - 105px);
      }
      .examples .panel-head {
        background: var(--code);
      }
      .tabs {
        border-color: var(--line);
        padding: 4px 8px 0;
        gap: 0;
      }
      .tabs button,
      .tabs .copy {
        font-size: 13px;
        padding: 9px 7px;
        color: var(--muted);
      }
      .tabs button:hover {
        color: var(--ink);
      }
      .tabs button[aria-pressed="true"] {
        color: var(--accent);
        border-color: var(--accent);
      }
      .code-footer {
        color: var(--muted);
        border-color: var(--line);
      }
      .token-key {
        color: #345ca0;
      }
      .token-string {
        color: #32694c;
      }
      .token-number {
        color: #91521e;
      }
      .token-literal,
      .token-keyword {
        color: #7946a2;
      }
      .token-function {
        color: #2f6690;
      }
      .token-comment {
        color: var(--muted);
        font-style: italic;
      }
      [data-theme="dark"] .token-key {
        color: #a9bfff;
      }
      [data-theme="dark"] .token-string {
        color: #a6d5b0;
      }
      [data-theme="dark"] .token-number {
        color: #efc18e;
      }
      [data-theme="dark"] .token-literal,
      [data-theme="dark"] .token-keyword {
        color: #c2a9f7;
      }
      [data-theme="dark"] .token-function {
        color: #8fc7ff;
      }
      @media (max-width: 1150px) and (min-width: 901px) {
        .layout {
          grid-template-columns: 190px minmax(0, 1fr);
        }
        main {
          padding: 28px 22px;
        }
        .columns {
          grid-template-columns: minmax(0, 1fr) minmax(300px, 0.95fr);
          gap: 20px;
        }
        .examples {
          position: sticky;
          grid-row: auto;
          max-height: calc(100vh - 105px);
          overflow-y: auto;
        }
        .sidebar a {
          font-size: 14px;
        }
      }
      @media (max-width: 900px) {
        .layout {
          grid-template-columns: 180px minmax(0, 1fr);
        }
        .columns {
          grid-template-columns: minmax(0, 1fr);
        }
        .examples {
          position: static;
          grid-row: auto;
          max-height: none;
          overflow: visible;
        }
        main {
          padding: 28px 22px;
        }
      }
      @media (max-width: 640px) {
        .layout {
          display: block;
        }
        main {
          padding: 24px 18px;
        }
        .sidebar {
          display: none;
        }
        h1 {
          font-size: 25px;
        }
        .endpoint {
          flex-wrap: wrap;
        }
        .topbar .brand small {
          display: none;
        }
      }
      @media print {
        .sidebar,
        .actions,
        .doc-actions,
        .config,
        .editor-panel,
        .search,
        .copy,
        .endpoint button,
        .toast {
          display: none !important;
        }
        .topbar,
        .examples {
          position: static;
        }
        .examples {
          max-height: none;
          overflow: visible;
        }
        .layout,
        .columns {
          display: block;
        }
        main {
          padding: 20px;
        }
        .code-panel {
          background: #f4f4f4;
          color: #111;
        }
        pre {
          max-height: none;
          white-space: pre-wrap;
        }
        .token-key,
        .token-string,
        .token-number,
        .token-literal {
          color: inherit;
        }
        .panel {
          break-inside: avoid;
        }
      }
      /* Embedded document with a compact outline and Feishu-inspired colors. */
      :root {
        --bg: #fff;
        --soft: #f5f6f7;
        --ink: #1f2329;
        --muted: #51565d;
        --line: #dee0e3;
        --accent: #245bdb;
        --tint: #edf2ff;
        --green: #18794e;
        --code: #f5f6f7;
        --code-text: #1f2329;
        --radius: 8px;
      }
      [data-theme="dark"] {
        --bg: #1a1a1a;
        --soft: #242424;
        --ink: #ebebeb;
        --muted: #b5b9c0;
        --line: #393c41;
        --accent: #85a8ff;
        --tint: #253453;
        --green: #78d9b4;
        --code: #242424;
        --code-text: #ebebeb;
      }
      html {
        scroll-padding-top: 16px;
      }
      .layout {
        display: grid;
        grid-template-columns: 164px minmax(0, 1fr);
        max-width: none;
        width: 100%;
        align-items: start;
      }
      .outline {
        position: sticky;
        top: 12px;
        margin: 16px 0 16px 12px;
        padding: 8px;
        border-right: 1px solid var(--line);
        font-size: 14px;
      }
      .outline summary {
        cursor: pointer;
        padding: 6px 10px;
        color: var(--muted);
        font-weight: 600;
      }
      .outline nav {
        display: grid;
        gap: 3px;
        margin-top: 8px;
      }
      .outline a {
        display: block;
        border-radius: 6px;
        padding: 7px 10px;
        color: var(--muted);
        border-left: 2px solid transparent;
      }
      .outline a:hover {
        background: var(--soft);
        color: var(--ink);
      }
      .outline a[aria-current="location"] {
        background: var(--tint);
        color: var(--accent);
        border-left-color: var(--accent);
        font-weight: 600;
      }
      .method {
        color: var(--accent);
      }
      .tabs button[aria-pressed="true"] {
        background: var(--tint);
      }
      .search:focus,
      .config input:focus,
      .config select:focus {
        border-color: var(--accent);
      }
      .required {
        color: var(--accent);
      }
      main {
        padding: 16px 20px 24px;
      }
      .intro {
        margin-bottom: 18px;
      }
      .columns {
        grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
        gap: 24px;
      }
      .examples {
        position: static;
        top: auto;
        grid-row: auto;
        max-height: none;
        overflow: visible;
        scrollbar-gutter: auto;
      }
      .examples pre {
        max-height: none;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .config code {
        overflow-wrap: anywhere;
      }
      .footer {
        margin-top: 24px;
      }
      .footer .doc-actions {
        margin-top: 12px;
      }
      @media (max-width: 980px) {
        .columns {
          grid-template-columns: minmax(0, 1fr);
          gap: 16px;
        }
        .examples {
          grid-row: 1;
        }
      }
      @media (max-width: 700px) {
        .layout {
          display: block;
        }
        .outline {
          position: static;
          margin: 12px 12px 0;
          padding: 6px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: var(--soft);
        }
        .outline nav {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        main {
          padding: 12px;
        }
        .tabs button,
        .tabs .copy {
          padding: 10px 8px;
        }
      }
      /* Visual hierarchy for the embedded reference. */
      :root {
        --soft: #f6f8fb;
        --line: #e5e9f0;
        --muted: #586579;
        --accent: #285fd4;
        --tint: #edf3ff;
        --code: #f7f9fc;
        --radius: 12px;
      }
      body {
        font-family:
          Inter, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        line-height: 1.75;
      }
      .layout {
        grid-template-columns: 176px minmax(0, 1fr);
        max-width: 1440px;
        margin: 0 auto;
      }
      main {
        padding: 24px 28px 32px;
      }
      .outline {
        margin: 24px 0 0 8px;
        padding: 4px 14px 16px 8px;
        border-right: 0;
      }
      .outline summary {
        font-size: 13px;
        letter-spacing: 0.5px;
        padding: 8px 12px;
        list-style: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .outline summary::-webkit-details-marker {
        display: none;
      }
      .outline summary::after {
        content: "+";
        font-size: 16px;
        font-weight: 400;
      }
      .outline[open] summary::after {
        content: "\u2212";
      }
      .outline nav {
        gap: 5px;
        margin-top: 12px;
      }
      .outline a {
        font-size: 14px;
        padding: 9px 12px;
        border: 0;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .outline a::before {
        content: "";
        width: 4px;
        height: 4px;
        flex-shrink: 0;
        border-radius: 50%;
        background: var(--line);
      }
      .outline a[aria-current="location"]::before {
        background: var(--accent);
      }
      .outline a[aria-current="location"] {
        border: 0;
        background: var(--tint);
      }
      .intro {
        font-size: 15px;
        margin: 0 0 24px;
        color: var(--muted);
        max-width: 760px;
        line-height: 1.9;
      }
      .columns {
        column-gap: 32px;
        grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
      }
      .section {
        --section-indent: clamp(16px, 2vw, 24px);
        padding-top: 0;
        padding-inline-start: var(--section-indent);
        margin-bottom: 38px;
      }
      .section > .section-title,
      .section > h2 {
        margin-inline-start: calc(-1 * var(--section-indent));
      }
      h2 {
        font-size: 19px;
        font-weight: 650;
        letter-spacing: 0;
      }
      .section-title {
        margin-bottom: 18px;
      }
      .section-title .caption {
        font-size: 12px;
        letter-spacing: 0.1px;
      }
      .request-card {
        background: var(--bg);
        border-radius: 12px;
        margin-bottom: 32px;
      }
      .endpoint {
        background: var(--soft);
        padding: 18px 16px;
        gap: 10px;
        flex-wrap: wrap;
        max-width: none;
      }
      .endpoint code {
        font-size: 14px;
        font-weight: 600;
        letter-spacing: -0.25px;
      }
      .method {
        font-size: 11px;
        background: var(--tint);
        color: var(--accent);
        padding: 3px 7px;
        border-radius: 5px;
        letter-spacing: 0.4px;
      }
      .endpoint button {
        font-size: 12px;
        padding: 4px 8px;
        background: var(--bg);
        color: var(--muted);
      }
      .request-card > details > summary {
        padding: 12px 16px;
        color: var(--muted);
        font-size: 13px;
      }
      .request-card > details[open] > summary {
        color: var(--ink);
        font-weight: 600;
      }
      .auth .field-head code {
        background: transparent;
        padding: 0;
        font-size: 14px;
      }
      .auth > code {
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 12px 14px;
        font-size: 13px;
      }
      .auth p code {
        display: inline;
        padding: 2px 5px;
        font-size: 12px;
      }
      .auth p {
        font-size: 14px;
        line-height: 1.9;
        margin: 10px 0;
      }
      .search {
        background: var(--bg);
        padding: 11px 13px;
        border-radius: 8px;
        margin-top: 7px;
        font-size: 14px;
      }
      .search::placeholder {
        color: var(--muted);
        opacity: 1;
      }
      .field {
        padding: 18px 0;
        border-bottom: 1px solid var(--line);
      }
      .field-name {
        color: var(--ink);
        font-size: 14px;
        font-weight: 650;
      }
      .field-head {
        gap: 8px;
        align-items: center;
      }
      .type {
        font-size: 12px;
        background: var(--soft);
        border: 1px solid var(--line);
        border-radius: 5px;
        padding: 1px 6px;
        line-height: 1.6;
      }
      .required {
        font-size: 11px;
        color: var(--accent);
        padding: 0 2px;
      }
      .field p {
        font-size: 14px;
        margin-top: 9px;
        color: var(--muted);
      }
      .constraint {
        font-size: 12px;
        line-height: 1.8;
        padding: 1px 7px;
        background: var(--soft);
        border-radius: 4px;
        margin-top: 9px;
      }
      .field summary {
        font-size: 13px;
        padding: 3px 0;
      }
      .nested {
        margin-top: 10px;
        padding-left: clamp(12px, 1.5vw, 20px);
        border-left: 2px solid var(--line);
      }
      .nested .field {
        padding: 14px 0;
      }
      .notice {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 16px;
        border: 1px solid color-mix(in srgb, var(--accent) 16%, var(--bg));
        border-radius: 12px;
        background: var(--tint);
        font-size: 14px;
      }
      .notice-icon {
        flex: 0 0 20px;
        width: 20px;
        height: 20px;
        margin-top: 3px;
        color: var(--accent);
      }
      .notice-content {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .badge {
        font-size: 12px;
        background: var(--soft);
        border-radius: 5px;
        padding: 2px 7px;
      }
      .examples .panel {
        border-radius: 12px;
        margin-bottom: 20px;
        background: var(--bg);
      }
      .examples .panel-head {
        padding: 13px 16px;
        background: var(--bg);
        border-bottom: 1px solid var(--line);
      }
      .panel-head strong {
        font-size: 14px;
        font-weight: 600;
      }
      .panel-head span {
        font-size: 12px;
      }
      .tabs {
        background: var(--bg);
        padding: 8px;
        gap: 3px;
        border-bottom: 1px solid var(--line);
      }
      .tabs button,
      .tabs .copy {
        border: 0;
        border-radius: 6px;
        padding: 6px 8px;
        font-size: 12px;
        line-height: 1.6;
      }
      .tabs button[aria-pressed="true"] {
        color: var(--accent);
        background: var(--tint);
        font-weight: 600;
      }
      .tabs button:hover {
        background: var(--soft);
      }
      .tabs .copy {
        margin-left: auto;
        border: 1px solid var(--line);
      }
      .examples pre {
        padding: 18px;
        font-size: 14px;
        line-height: 1.9;
        min-height: 120px;
      }
      .code-footer {
        padding: 10px 16px;
        font-size: 12px;
        background: var(--bg);
      }
      .note {
        font-size: 13px;
        line-height: 1.9;
        margin: 16px 0;
      }
      .editor-panel summary {
        cursor: pointer;
      }
      .editor-tools {
        padding: 12px 16px;
      }
      .editor-tools button {
        font-size: 13px;
      }
      .status-row {
        font-size: 14px;
        padding: 16px 0;
      }
      .status-row p {
        font-size: 13px;
        margin: 5px 0 0;
      }
      .footer {
        font-size: 12px;
        margin-top: 32px;
        padding-top: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .footer .doc-actions {
        margin: 0;
        gap: 6px;
      }
      .doc-actions button {
        font-size: 12px;
        background: var(--bg);
        padding: 5px 9px;
      }
      @media (max-width: 1050px) {
        .layout {
          grid-template-columns: 154px minmax(0, 1fr);
        }
        main {
          padding: 20px;
        }
        .outline {
          padding-right: 6px;
        }
        .columns {
          grid-template-columns: minmax(0, 1fr);
          gap: 0;
        }
        .content {
          display: contents;
        }
        .request-card {
          grid-row: 1;
        }
        .content > #authentication {
          grid-row: 2;
        }
        .examples {
          grid-row: 3;
          margin-bottom: 20px;
        }
        .content > #request {
          grid-row: 4;
        }
        .content > #responses {
          grid-row: 5;
        }
        .content > #streaming {
          grid-row: 6;
        }
        .content > #errors {
          grid-row: 7;
        }
      }
      @media (max-width: 700px) {
        .layout {
          display: block;
        }
        .outline {
          margin: 12px 14px 0;
          padding: 4px;
          background: var(--soft);
          border: 1px solid var(--line);
          border-radius: 10px;
        }
        .outline summary {
          padding: 8px 10px;
        }
        .outline nav {
          margin: 0 0 4px;
          gap: 2px;
        }
        .outline a {
          padding: 8px 10px;
        }
        main {
          padding: 18px 14px 24px;
        }
        .intro {
          margin-bottom: 20px;
          font-size: 14px;
        }
        .endpoint {
          padding: 15px 12px;
        }
        .examples pre {
          padding: 15px;
        }
        .footer {
          display: block;
        }
        .footer .doc-actions {
          margin-top: 12px;
        }
      }
      :root {
        --motion: 180ms;
        --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
      }
      body,
      button,
      a,
      input,
      select,
      textarea,
      summary,
      .panel,
      .code-panel,
      .code-footer,
      .tabs,
      .type,
      .constraint,
      .notice,
      .request-card,
      .endpoint,
      .outline,
      .field,
      .token-key,
      .token-string,
      .token-number,
      .token-keyword,
      .token-function,
      .token-comment,
      .token-literal {
        transition:
          background-color var(--motion) ease,
          color var(--motion) ease,
          border-color var(--motion) ease,
          box-shadow var(--motion) ease,
          transform var(--motion) var(--ease);
      }
      button:active {
        transform: scale(0.97);
      }
      summary:hover {
        background: var(--soft);
      }
      input:hover,
      select:hover,
      textarea:hover {
        border-color: var(--accent);
      }
      input:focus,
      select:focus,
      textarea:focus {
        box-shadow: 0 0 0 3px var(--tint);
      }
      .outline a::before {
        transition:
          background-color var(--motion) ease,
          transform var(--motion) var(--ease);
      }
      .outline a[aria-current="location"]::before {
        transform: scale(1.4);
      }
      .outline summary::after {
        content: "+";
        transition: transform var(--motion) var(--ease);
      }
      .outline[open] summary::after {
        content: "+";
        transform: rotate(45deg);
      }
      .toast {
        top: max(16px, env(safe-area-inset-top));
        bottom: auto;
        opacity: 0;
        visibility: hidden;
        transform: translate(-50%, -12px);
        pointer-events: none;
        max-width: min(560px, calc(100vw - 32px));
        border: 1px solid var(--line);
        background: var(--bg);
        color: var(--ink);
        box-shadow: 0 6px 24px #182b4d1f;
        transition:
          opacity 200ms ease,
          transform 200ms var(--ease),
          visibility 200ms;
      }
      .toast.is-visible {
        opacity: 1;
        visibility: visible;
        transform: translate(-50%, 0);
      }
      @media (hover: hover) {
        button:hover {
          transform: translateY(-1px);
        }
        .outline a:hover {
          transform: translateX(2px);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        html {
          scroll-behavior: auto;
        }
        *,
        *::before,
        *::after {
          transition: none !important;
          animation: none !important;
        }
        button:hover,
        button:active,
        .outline a:hover {
          transform: none;
        }
      }
      @media print {
        .outline {
          display: none;
        }
        .layout,
        .columns,
        .content {
          display: block;
        }
      }
      .body-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .body-field {
        min-width: 0;
      }
      .body-field label {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 6px;
        font-size: 13px;
      }
      .body-field input,
      .body-field select,
      .body-field textarea {
        width: 100%;
        min-width: 0;
        padding: 8px 10px;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: var(--bg);
        color: var(--ink);
        font-size: 14px;
      }
      .body-field textarea {
        resize: vertical;
        min-height: 90px;
      }
      .body-field select {
        margin: 0;
      }
      .body-wide {
        grid-column: 1 / -1;
      }
      .body-group {
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 10px;
      }
      .body-group > summary {
        cursor: pointer;
        font-size: 13px;
        overflow-wrap: anywhere;
      }
      .body-group .body-grid {
        margin-top: 12px;
        padding-left: 10px;
        border-left: 1px solid var(--line);
      }
      .body-tools {
        display: flex;
        gap: 8px;
        margin: 10px 0;
        flex-wrap: wrap;
      }
      .body-tools button {
        font-size: 12px;
        padding: 4px 8px;
      }
      .body-error {
        color: #b42338;
        font-size: 12px;
        margin: 4px 0 0;
      }
      .body-field [aria-invalid="true"] {
        border-color: #b42338;
      }
      @media (max-width: 480px) {
        .body-grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      /* Embedded request workspace: consistent surfaces, spacing and controls. */
      :root {
        --bg: #fff;
        --soft: #f6f8fb;
        --ink: #202b3d;
        --muted: #56657a;
        --line: #e4e9f1;
        --accent: #245bdb;
        --tint: #edf3ff;
        --code: #f8faff;
        --radius: 12px;
      }
      [data-theme="dark"] {
        --bg: #171c25;
        --soft: #202735;
        --ink: #e6edf8;
        --muted: #b0bdd1;
        --line: #334057;
        --accent: #8caeff;
        --tint: #253958;
        --code: #1c2432;
      }
      .layout {
        max-width: 1580px;
        grid-template-columns: 160px minmax(0, 1fr);
      }
      .outline {
        top: 20px;
        margin: 20px 0 0;
        padding: 8px 12px;
      }
      .outline summary {
        font-size: 16px;
        font-weight: 600;
        letter-spacing: 1px;
      }
      .outline a {
        font-size: 14px;
        padding: 10px 12px;
      }
      main {
        padding: 24px 24px 32px;
      }
      .intro {
        margin: 0 0 20px;
        font-size: 15px;
        max-width: none;
      }
      .columns {
        column-gap: 28px;
        grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      }
      .request-card {
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--bg);
        margin-bottom: 40px;
      }
      .endpoint {
        padding: 18px 20px;
        background: var(--soft);
      }
      .endpoint code {
        font-size: 15px;
      }
      .method {
        padding: 4px 8px;
        font-size: 11px;
        letter-spacing: 0.7px;
      }
      .request-card > details > summary {
        padding: 14px 20px;
      }
      .config {
        padding: 20px;
      }
      .workspace-heading {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 18px;
      }
      .step-number {
        display: grid;
        place-items: center;
        width: 25px;
        height: 25px;
        flex: 0 0 25px;
        border-radius: 7px;
        background: var(--tint);
        color: var(--accent);
        font-size: 12px;
        font-weight: 650;
      }
      .workspace-heading h2 {
        margin: 0;
        font-size: 17px;
      }
      .workspace-heading .caption {
        margin-left: auto;
        font-size: 12px;
      }
      .connection-fields {
        display: grid;
        grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
        gap: 14px;
      }
      .config label {
        font-size: 13px;
        font-weight: 500;
      }
      .config input,
      .config select {
        min-height: 40px;
        margin: 0;
        font-size: 14px;
        border-radius: 8px;
      }
      .config p {
        font-size: 12px;
        line-height: 1.8;
        margin: 10px 0 18px;
      }
      .body-mode {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px;
        background: var(--soft);
        border: 1px solid var(--line);
        border-radius: 9px;
        margin: 20px 0;
      }
      .body-mode button {
        flex: 1;
        border: 1px solid transparent;
        background: transparent;
        font-size: 13px;
        padding: 7px 10px;
        border-radius: 6px;
      }
      .body-mode button[aria-pressed="true"] {
        background: var(--bg);
        border-color: var(--line);
        color: var(--accent);
        font-weight: 600;
      }
      .body-grid {
        gap: 18px 14px;
      }
      .body-field {
        position: relative;
      }
      .body-field label {
        gap: 4px;
        font-size: 13px;
        align-items: center;
        overflow-wrap: anywhere;
      }
      .body-field label .caption {
        font-size: 11px;
        font-weight: 400;
      }
      .body-field input,
      .body-field select,
      .body-field textarea {
        border-radius: 8px;
        background: var(--soft);
        font-size: 14px;
        min-height: 40px;
      }
      .body-field input:focus,
      .body-field select:focus,
      .body-field textarea:focus {
        background: var(--bg);
      }
      .body-field textarea {
        min-height: 104px;
        line-height: 1.75;
      }
      .body-field > .body-tools {
        margin: 5px 0 0;
        justify-content: flex-end;
      }
      .body-tools button {
        border: 0;
        padding: 3px 6px;
        color: var(--muted);
        background: transparent;
        font-size: 11px;
      }
      .body-tools button:hover {
        color: var(--accent);
        background: var(--tint);
      }
      .body-tools button[data-action="add"],
      .body-tools button[data-action="enable"] {
        border: 1px dashed var(--line);
        font-size: 12px;
        padding: 7px 10px;
        color: var(--accent);
      }
      .body-group {
        border: 0;
        border-top: 1px solid var(--line);
        border-radius: 0;
        padding: 14px 0 0;
      }
      .body-group > summary {
        font-size: 14px;
        padding: 4px 0;
      }
      .body-group > summary .caption {
        font-size: 11px;
        margin-left: 6px;
      }
      .body-group .body-grid {
        padding-left: 14px;
        margin-top: 14px;
      }
      .body-subheading {
        grid-column: 1 / -1;
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 12px;
        color: var(--muted);
        padding: 0 0 10px;
        border-bottom: 1px solid var(--line);
      }
      .advanced-fields {
        grid-column: 1 / -1;
        border: 1px solid var(--line);
        border-radius: 9px;
        padding: 12px;
        background: var(--bg);
      }
      .advanced-fields > summary {
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        padding: 3px;
      }
      .advanced-fields > .body-grid {
        margin-top: 18px;
      }
      .editor-panel {
        margin: 0 0 16px;
        border-radius: 10px;
      }
      .editor-panel .editor {
        min-height: 340px;
        padding: 16px;
        font-size: 14px;
      }
      #apply-json {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--bg);
      }
      .section {
        margin-bottom: 38px;
      }
      .section-title {
        padding-bottom: 12px;
        border-bottom: 1px solid var(--line);
      }
      .section-title h2 {
        font-size: 18px;
      }
      .field-name {
        font-size: 14px;
      }
      .field p {
        font-size: 14px;
      }
      .examples > .section-title {
        border: 0;
        padding: 0;
        margin: 0 0 16px;
      }
      .examples .panel {
        border-radius: 12px;
        border-color: var(--line);
      }
      .examples .panel-head {
        padding: 14px 16px;
      }
      .tabs {
        padding: 8px;
        gap: 4px;
      }
      .tabs button,
      .tabs .copy {
        font-size: 12px;
        padding: 7px 9px;
      }
      .tabs .copy {
        color: var(--accent);
        background: var(--bg);
      }
      .examples pre {
        font-size: 14px;
        padding: 20px;
        line-height: 1.9;
      }
      .preview-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 11px 16px;
        background: var(--bg);
        border-bottom: 1px solid var(--line);
        gap: 10px;
      }
      .preview-toolbar strong {
        font-size: 13px;
        font-weight: 600;
      }
      .preview-toolbar button {
        padding: 3px 8px;
        font-size: 11px;
        background: var(--soft);
      }
      .examples[data-wrap="true"] pre {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .examples[data-wrap="false"] pre {
        white-space: pre;
        overflow-wrap: normal;
        overflow-x: auto;
      }
      .code-footer {
        font-size: 11px;
        color: var(--muted);
      }
      .body-error:empty {
        display: none;
      }
      .body-error:not(:empty) {
        margin-top: 6px;
      }
      .preview-toolbar,
      .body-mode,
      .advanced-fields {
        transition:
          background-color var(--motion),
          border-color var(--motion),
          color var(--motion);
      }
      @media (max-width: 1100px) {
        .layout {
          grid-template-columns: 140px minmax(0, 1fr);
        }
        main {
          padding: 20px;
        }
        .columns {
          grid-template-columns: minmax(0, 1fr);
          gap: 0;
        }
        .content {
          display: contents;
        }
        .request-card {
          grid-row: 1;
        }
        .examples {
          grid-row: 2;
          margin-bottom: 32px;
        }
        .content > #authentication {
          grid-row: 3;
        }
        .content > #request {
          grid-row: 4;
        }
        .content > #responses {
          grid-row: 5;
        }
        .content > #streaming {
          grid-row: 6;
        }
        .content > #errors {
          grid-row: 7;
        }
      }
      @media (max-width: 700px) {
        .layout {
          display: block;
        }
        .outline {
          margin: 12px;
          padding: 4px;
        }
        main {
          padding: 12px;
        }
        .connection-fields {
          grid-template-columns: minmax(0, 1fr);
        }
        .config {
          padding: 16px;
        }
        .endpoint {
          padding: 16px;
        }
        .endpoint code {
          font-size: 13px;
        }
        .body-field input,
        .body-field select,
        .body-field textarea {
          font-size: 16px;
        }
      }
      @media print {
        .body-mode,
        .preview-toolbar button {
          display: none;
        }
        .columns,
        .content {
          display: block;
        }
      }
      /* Keep parameter documentation on the left and examples on the right. */
      .columns {
        grid-template-columns: minmax(0, 1fr) minmax(290px, 340px);
        column-gap: 24px;
      }
      .content {
        display: block;
      }
      .request-card {
        grid-column: auto;
        grid-row: auto;
      }
      .examples {
        grid-column: auto;
        grid-row: auto;
        position: sticky;
        top: 16px;
        align-self: start;
      }
      .content > .section {
        grid-column: auto;
        grid-row: auto;
        min-width: 0;
      }
      .examples .section-title h2 {
        font-size: 17px;
      }
      .examples pre {
        min-height: 0;
        padding: 16px;
        font-size: 12.5px;
        line-height: 1.75;
      }
      .examples .panel {
        margin-bottom: 16px;
      }
      .examples .tabs {
        padding: 6px;
      }
      .examples .tabs button,
      .examples .tabs .copy {
        padding: 5px 7px;
        font-size: 11px;
      }
      .preview-toolbar {
        padding: 9px 12px;
      }
      .schema-scroll {
        max-width: 100%;
        overflow-x: auto;
        border: 1px solid var(--line);
        border-radius: 7px;
      }
      .schema-table {
        width: 100%;
        min-width: 660px;
        border-collapse: collapse;
        table-layout: fixed;
        font-size: 14px;
        line-height: 1.8;
      }
      .schema-table th,
      .schema-table td {
        padding: 13px 16px;
        text-align: left;
        vertical-align: top;
        border-bottom: 1px solid var(--line);
        overflow-wrap: anywhere;
      }
      .schema-table thead th {
        background: var(--soft);
        color: var(--ink);
        font-size: 13px;
        font-weight: 600;
      }
      .schema-table tbody th {
        font-weight: 400;
      }
      .schema-table tr:last-child > th,
      .schema-table tr:last-child > td {
        border-bottom: 0;
      }
      .schema-table col:nth-child(1) {
        width: 21%;
      }
      .schema-table col:nth-child(2) {
        width: 24%;
      }
      .schema-table col:nth-child(3) {
        width: 8%;
      }
      .schema-table col:nth-child(4) {
        width: 12%;
      }
      .schema-table col:nth-child(5) {
        width: 35%;
      }
      .schema-table code {
        font-size: 12px;
        background: var(--soft);
        border-radius: 3px;
        padding: 2px 5px;
        white-space: normal;
      }
      .schema-table tbody th code {
        background: transparent;
        padding: 0;
      }
      .schema-table td,
      .schema-table tbody th {
        transition: background-color var(--motion) ease;
      }
      .schema-table tbody tr:hover > td,
      .schema-table tbody tr:hover > th {
        background: var(--tint);
      }
      .schema-table .schema-meta {
        color: var(--muted);
        font-size: 12px;
        margin-top: 5px;
      }
      .schema-children {
        margin-top: 12px;
      }
      .schema-children > summary {
        cursor: pointer;
        font-size: 13px;
        color: var(--accent);
        padding: 4px 0;
      }
      .schema-children .schema-scroll {
        margin-top: 10px;
      }
      .schema-table .schema-child-row > td {
        padding: 0 16px 12px;
      }
      @media (max-width: 900px) {
        .columns {
          grid-template-columns: minmax(0, 1fr);
        }
        .examples {
          position: static;
          width: 100%;
        }
      }
      @media print {
        .schema-scroll {
          overflow: visible;
        }
        .schema-table {
          min-width: 0;
        }
      }
      /* Compact parameter inspector; shared with nested object/array editors. */
      #body-form,
      #body-form .body-grid {
        grid-template-columns: minmax(0, 1fr);
        gap: 0;
      }
      #body-form {
        border: 1px solid var(--line);
        border-radius: 12px;
        overflow: hidden;
        background: var(--bg);
      }
      #body-form .body-subheading {
        padding: 12px 16px;
        margin: 0;
        background: var(--soft);
        font-weight: 600;
      }
      #body-form div.body-field {
        display: grid;
        grid-template-columns: minmax(120px, 30%) minmax(0, 1fr);
        align-items: start;
        gap: 16px;
        padding: 16px;
        border-bottom: 1px solid var(--line);
      }
      #body-form .body-field > label {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 5px;
        margin: 0;
        padding-top: 7px;
        overflow-wrap: anywhere;
        font-family: Consolas, monospace;
      }
      #body-form label .caption {
        font-size: 11px;
        font-weight: 400;
      }
      #body-form .body-value {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
        gap: 0 6px;
        min-width: 0;
      }
      #body-form .body-value > input,
      #body-form .body-value > select,
      #body-form .body-value > textarea {
        grid-column: 1;
        grid-row: 1;
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: 7px;
        box-shadow: 0 1px 2px #00000005;
      }
      #body-form .body-value > .body-error {
        grid-column: 1 / -1;
        grid-row: 2;
      }
      #body-form .body-value > .body-tools {
        grid-column: 2;
        grid-row: 1;
        margin: 4px 0;
      }
      #body-form .body-tools button {
        min-height: 32px;
        padding: 4px 8px;
        border-radius: 6px;
        white-space: nowrap;
      }
      #body-form .body-union-controls {
        display: grid;
        grid-template-columns: minmax(88px, 115px) minmax(0, 1fr);
        align-items: start;
        gap: 8px;
        min-width: 0;
      }
      #body-form .body-union-controls > select {
        background: var(--soft);
        font-size: 12px;
      }
      #body-form .body-union-controls > div.body-field {
        display: block;
        padding: 0;
        border: 0;
      }
      #body-form .body-union-controls > .body-field > label {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
      }
      #body-form .body-union-controls > details {
        grid-column: 1 / -1;
      }
      #body-form .body-group {
        margin: 0;
        padding: 12px 16px;
        border: 0;
        border-bottom: 1px solid var(--line);
      }
      #body-form .body-group .body-grid {
        margin-top: 12px;
        padding-left: 0;
        border: 1px solid var(--line);
        border-radius: 8px;
        overflow: hidden;
      }
      #body-form .advanced-fields {
        margin: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
      }
      #body-form .advanced-fields > summary {
        padding: 14px 16px;
        background: var(--soft);
        color: var(--ink);
      }
      #body-form .advanced-fields > .body-grid {
        margin: 0;
      }
      #body-form .advanced-fields > summary .caption {
        margin-left: 8px;
        font-weight: 400;
      }
      .body-mode {
        display: flex;
        justify-content: flex-start;
        gap: 20px;
        padding: 0;
        border: 0;
        border-bottom: 1px solid var(--line);
        border-radius: 0;
        background: transparent;
        margin-bottom: 20px;
      }
      .body-mode button {
        flex: 0 0 auto;
        padding: 10px 2px;
        border: 0;
        border-bottom: 2px solid transparent;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
      }
      .body-mode button[aria-pressed="true"] {
        border-bottom-color: var(--accent);
        background: transparent;
        box-shadow: none;
        color: var(--accent);
      }
      @media (max-width: 620px) {
        #body-form div.body-field {
          grid-template-columns: minmax(0, 1fr);
          gap: 8px;
          padding: 12px;
        }
        #body-form .body-field > label {
          flex-direction: row;
          justify-content: space-between;
          padding: 0;
        }
        #body-form .body-union-controls {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      /* Input/Select visual tokens adapted from web/src/components/ui.
         Native controls preserve standalone HTML and keyboard semantics. */
      .request-card {
        --control-border: #d8dce4;
        --control-ring: color-mix(in srgb, var(--accent) 22%, transparent);
        --control-shadow: 0 1px 2px #00000006;
      }
      [data-theme="dark"] .request-card {
        --control-border: #465166;
        --control-shadow: 0 1px 2px #00000020;
      }
      .request-card :is(#base-url, #api-key),
      #body-form .body-field :is(input, select, textarea) {
        box-sizing: border-box;
        min-height: 36px;
        border: 1px solid var(--control-border);
        border-radius: 8px;
        background-color: var(--bg);
        color: var(--ink);
        padding: 7px 11px;
        font-size: 13px;
        line-height: 20px;
        box-shadow: var(--control-shadow);
        outline: none;
        transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
      }
      .request-card :is(#base-url, #api-key)::placeholder,
      #body-form :is(input, textarea)::placeholder {
        color: var(--muted);
        opacity: 0.75;
      }
      #body-form .body-field select {
        appearance: none;
        padding-right: 34px;
        cursor: pointer;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23778192' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m8 9 4-4 4 4M8 15l4 4 4-4'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 10px center;
        text-overflow: ellipsis;
      }
      #body-form .body-field select:hover,
      .request-card :is(#base-url, #api-key):hover,
      #body-form .body-field :is(input, textarea):hover {
        border-color: color-mix(in srgb, var(--ink) 35%, var(--control-border));
      }
      .request-card :is(#base-url, #api-key):focus-visible,
      #body-form .body-field :is(input, select, textarea):focus-visible {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px var(--control-ring);
      }
      .request-card :is(#base-url, #api-key)[aria-invalid="true"],
      #body-form .body-field [aria-invalid="true"] {
        border-color: #d24960;
        box-shadow: 0 0 0 3px #d249601a;
      }
      #body-form .body-field :is(input, select, textarea):disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background-color: var(--soft);
      }
      #body-form .body-field textarea {
        min-height: 100px;
        line-height: 1.65;
      }
      #body-form .body-value > .body-tools {
        margin: 2px 0;
      }
      @supports (appearance: base-select) {
        #body-form .body-field select,
        #body-form .body-field select::picker(select) {
          appearance: base-select;
        }
        #body-form .body-field select::picker-icon {
          content: "";
          display: block;
          flex: 0 0 16px;
          align-self: center;
          margin-block: 0;
          width: 16px;
          height: 16px;
          border: 0;
          background-color: currentColor;
          mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 16px 16px no-repeat;
          color: var(--muted);
          transform: rotate(0deg);
          transform-origin: center;
          transition: transform 180ms ease, color 160ms ease;
        }
        #body-form .body-field select {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          height: 36px;
          padding-block: 0;
          background-image: none;
          padding-right: 12px;
        }
        #body-form .body-field select:open::picker-icon {
          transform: rotate(180deg);
          color: var(--accent);
        }
        #body-form .body-field select::picker(select) {
          margin-top: 5px;
          padding: 4px;
          border: 1px solid var(--control-border);
          border-radius: 10px;
          background: var(--bg);
          color: var(--ink);
          box-shadow: 0 8px 24px #00000018, 0 2px 6px #00000008;
          max-height: 280px;
          overflow-y: auto;
          font-size: 13px;
        }
        #body-form .body-field option {
          padding: 7px 10px;
          min-height: 34px;
          border-radius: 6px;
          cursor: pointer;
          gap: 10px;
        }
        #body-form .body-field option:hover,
        #body-form .body-field option:focus-visible {
          background: var(--soft);
          outline: none;
        }
        #body-form .body-field option:checked {
          background: var(--tint);
          color: var(--accent);
          font-weight: 500;
        }
        #body-form .body-field option::checkmark {
          order: 1;
          margin-left: auto;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .request-card #base-url,
        #body-form .body-field :is(input, select, textarea) {
          transition: none;
        }
      }
      .request-card > .config {
        padding-top: 14px;
        padding-bottom: 8px;
      }
      #base-url-error {
        margin: 6px 0 0;
        padding: 0;
      }
      #base-url-error:empty {
        display: none;
      }
      /* Shared disclosure indicator, including dynamically rendered fields. */
      details > summary {
        display: flex;
        align-items: center;
        gap: 8px;
        list-style: none;
        cursor: pointer;
      }
      details > summary::-webkit-details-marker {
        display: none;
      }
      details > summary::marker {
        content: "";
      }
      details > summary::after,
      .outline[open] > summary::after {
        content: "";
        display: block;
        flex: 0 0 7px;
        width: 7px;
        height: 7px;
        margin: 0 5px 0 auto;
        border: solid currentColor;
        border-width: 0 1.5px 1.5px 0;
        color: var(--muted);
        transform: rotate(-45deg);
        transform-origin: center;
        transition: transform 220ms cubic-bezier(.2,.7,.2,1), color 160ms ease;
      }
      details[open]:not([data-target-open="false"]) > summary::after,
      details[data-target-open="true"] > summary::after {
        transform: rotate(45deg);
      }
      details > summary:hover::after,
      details > summary:focus-visible::after {
        color: var(--accent);
      }
      button,
      details > summary {
        transition: background-color 160ms ease, color 160ms ease,
          border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
      }
      :is(button, a) svg {
        transform-origin: center;
        transition: transform 160ms ease, opacity 160ms ease, color 160ms ease;
      }
      :is(button, a):hover svg,
      :is(button, a):focus-visible svg {
        transform: scale(1.08);
      }
      button:active svg {
        transform: scale(.94);
      }
      @media (prefers-reduced-motion: reduce) {
        details > summary::after,
        .outline[open] > summary::after,
        #body-form .body-field select::picker-icon,
        button,
        details > summary,
        :is(button, a) svg {
          transition: none;
        }
        :is(button, a):is(:hover, :focus-visible, :active) svg {
          transform: none;
        }
      }
      /* Fill the viewport without outer horizontal gutters. */
      .layout {
        width: 100%;
        max-width: none;
        margin-inline: 0;
        padding-inline: 0;
      }
      main {
        padding-right: 0;
        padding-left: 12px;
      }
      .outline {
        margin-inline: 0;
        padding-left: 0;
      }
    </style>
  </head>
  <body>
    <a class="skip" href="#overview">\u8DF3\u8F6C\u5230\u6587\u6863\u6B63\u6587</a>
    <div class="layout">
      <details class="outline" id="outline" open>
        <summary>\u6587\u6863\u76EE\u5F55</summary>
        <nav aria-label="\u6587\u6863\u76EE\u5F55">
          <a href="#overview" aria-current="location">\u914D\u7F6E\u8BF7\u6C42</a>
          <a href="#examples">\u4EE3\u7801\u793A\u4F8B</a>
          <a href="#authentication">\u8EAB\u4EFD\u8BA4\u8BC1</a>
          <a href="#request">\u8BF7\u6C42\u53C2\u6570</a>
          <a href="#responses">\u54CD\u5E94\u7ED3\u6784</a>
        </nav>
      </details>
      <main id="overview">
        <h1>%%TITLE%%</h1><p class="intro">%%INTRO%%</p>
        <div class="columns">
          <div class="content">
            <div class="request-card">
              <div class="endpoint">
                <span class="method">%%METHOD%%</span><code>%%PATH%%</code
                ><button id="copy-path">\u590D\u5236\u8DEF\u5F84</button>
              </div>
              <div class="config">
                <label for="base-url">Base URL</label>
                <input
                  id="base-url"
                  type="url"
                  inputmode="url"
                  spellcheck="false"
                  aria-describedby="base-url-error"
                />
                <p class="error" id="base-url-error" role="status"></p>
              </div>
              <details open>
                <summary>Authorization</summary>
                <div class="config">
                  %%AUTH_CONTROL%%
                </div>
              </details>
              <details open>
                <summary>
                  \u8BF7\u6C42\u914D\u7F6E <span class="caption">application/json</span>
                </summary>
                <div class="config">
                  <div class="workspace-heading">
                    <h2>\u8BF7\u6C42\u5185\u5BB9</h2>
                    <span class="caption">* \u5FC5\u586B</span>
                  </div>
                  <div class="body-mode" aria-label="\u8BF7\u6C42\u7F16\u8F91\u65B9\u5F0F">
                    <button
                      type="button"
                      id="body-fields"
                      aria-pressed="true"
                      aria-controls="body-form"
                    >
                      \u53C2\u6570\u8868\u5355
                    </button>
                    <button
                      type="button"
                      id="body-json"
                      aria-pressed="false"
                      aria-controls="json-panel"
                    >
                      JSON \u7F16\u8F91
                    </button>
                  </div>
                  <div class="panel editor-panel" id="json-panel" hidden>
                    <label for="json-editor" class="skip">\u8BF7\u6C42 JSON</label>
                    <textarea
                      class="editor"
                      id="json-editor"
                      spellcheck="false"
                    ></textarea>
                    <div class="editor-tools">
                      <button id="apply-json">\u5E94\u7528 JSON</button>
                      <button id="reset-json">\u91CD\u7F6E\u8BF7\u6C42</button>
                    </div>
                    <p class="error" id="editor-error" role="status"></p>
                  </div>
                  <div id="body-form" class="body-grid"></div>
                  <p>
                    \u53EF\u9009\u53C2\u6570\u6309\u9700\u8BBE\u7F6E\uFF1B0\u3001false
                    \u548C\u7A7A\u5B57\u7B26\u4E32\u4F1A\u4FDD\u7559\u3002\u8F93\u5165\u6709\u8BEF\u65F6\uFF0C\u4EE3\u7801\u4FDD\u7559\u4E0A\u6B21\u6709\u6548\u503C\u3002
                  </p>
                </div>
              </details>
            </div>
            <section id="authentication" class="section">
              <div class="section-title">
                <h2>\u8EAB\u4EFD\u8BA4\u8BC1</h2>
                <span class="caption">%%SECURITY%%</span>
              </div>
              <div class="auth">
                <div class="field-head">
                  <code class="field-name">Authorization</code
                  ><span class="type">Bearer &lt;token&gt;</span>
                </div>
                <p>%%AUTH_DESCRIPTION%%</p>
                <code>%%AUTH%%</code>
                <p>%%AUTH_LOCATION%%</p>
              </div>
            </section>
            <section id="request" class="section">
              <div class="section-title">
                <h2>\u8BF7\u6C42\u53C2\u6570</h2>
                <span class="caption">Body \xB7 application/json</span>
              </div>
              <label for="search" class="caption"
                >\u641C\u7D22\u53C2\u6570\u540D\u79F0\u6216\u8BF4\u660E\uFF08\u542B\u5D4C\u5957\u5B57\u6BB5\uFF09</label
              ><input
                id="search"
                class="search"
                type="search"
                placeholder="\u641C\u7D22\u53C2\u6570\u540D\u79F0\u6216\u8BF4\u660E\u2026"
              />
              <div id="request-fields"></div>
            </section>
            <section id="responses" class="section">
              <div class="section-title">
                <h2>\u54CD\u5E94\u7ED3\u6784</h2>
                <span class="badge">%%STATUS%%</span>
              </div>
              <p class="note">
                \u5C55\u793A\u6240\u9009\u72B6\u6001\u7801\u7684\u54CD\u5E94\u7ED3\u6784\u3002Schema \u5360\u4F4D\u793A\u4F8B\u4E0D\u4EE3\u8868\u771F\u5B9E\u54CD\u5E94\u3002
              </p>
              <div id="response-fields"></div>
            </section>
          </div>
          <aside class="examples" id="examples" data-wrap="true" aria-label="\u8BF7\u6C42\u548C\u54CD\u5E94\u793A\u4F8B">
            <div class="section-title">
              <div class="workspace-heading">
                <h2>\u4EE3\u7801\u4E0E\u54CD\u5E94</h2>
              </div>
            </div>
            <div class="panel">
              <div class="preview-toolbar">
                <strong>\u8BF7\u6C42\u793A\u4F8B</strong
                ><button id="code-wrap" type="button" aria-pressed="true">
                  \u6A2A\u5411\u6EDA\u52A8
                </button>
              </div>
              <div class="code-panel">
                <div class="tabs" id="language-tabs" aria-label="\u8BF7\u6C42\u793A\u4F8B\u8BED\u8A00">
                  <button data-language="curl" aria-pressed="true">cURL</button
                  ><button data-language="javascript" aria-pressed="false">
                    JavaScript</button
                  ><button data-language="go" aria-pressed="false">Go</button
                  ><button data-language="python" aria-pressed="false">
                    Python</button
                  ><button data-language="java" aria-pressed="false">
                    Java</button
                  ><button data-language="csharp" aria-pressed="false">
                    C#</button
                  ><button class="copy" id="copy-request">\u590D\u5236</button>
                </div>
                <pre><code id="request-code"></code></pre>
                <div class="code-footer">\u8BF7\u6C42\u793A\u4F8B</div>
              </div>
            </div>
            <div class="panel">
              <div class="panel-head">
                <strong>\u54CD\u5E94\u793A\u4F8B</strong><span>Schema \u5360\u4F4D\u793A\u4F8B</span>
              </div>
              <div class="code-panel">
                <div class="tabs" id="response-tabs" aria-label="\u54CD\u5E94\u793A\u4F8B\u7C7B\u578B">
                  %%RESPONSE_TABS%%<button class="copy" id="copy-response">\u590D\u5236</button>
                </div>
                <pre><code id="response-code"></code></pre>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
    <div
      id="toast"
      class="toast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    ></div>
    <noscript
      ><p>\u8BF7\u542F\u7528 JavaScript\uFF0C\u4EE5\u663E\u793A\u5B8C\u6574\u53C2\u6570\u7ED3\u6784\u548C\u4EA4\u4E92\u5F0F\u4EE3\u7801\u793A\u4F8B\u3002</p></noscript
    >
    <script>
      "use strict";
      %%DATA%%
      // Match Fumadocs OpenAPI's request sampling: examples first, then only
      // required properties. Response placeholders still include every property.
      function sampleSchema(schema, requiredOnly) {
        if (Object.hasOwn(schema, "example"))
          return structuredClone(schema.example);
        if (schema.examples?.length) return structuredClone(schema.examples[0]);
        if (Object.hasOwn(schema, "default"))
          return structuredClone(schema.default);
        if (Object.hasOwn(schema, "const"))
          return structuredClone(schema.const);
        if (schema.enum?.length) return structuredClone(schema.enum[0]);
        if (schema.oneOf?.length) return sampleSchema(schema.oneOf[0], requiredOnly);
        if (schema.anyOf?.length) return sampleSchema(schema.anyOf[0], requiredOnly);
        const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
        if (type === "object") {
          const names = requiredOnly
            ? schema.required || []
            : Object.keys(schema.properties || {});
          return Object.fromEntries(
            names
              .filter((name) => Object.hasOwn(schema.properties || {}, name))
              .map((name) => [
                name,
                sampleSchema(schema.properties[name], requiredOnly),
              ]),
          );
        }
        if (type === "array")
          return [sampleSchema(schema.items || {}, requiredOnly)];
        if (type === "integer" || type === "number")
          return Math.min(
            schema.maximum ?? Infinity,
            Math.max(schema.minimum ?? -Infinity, 0),
          );
        if (type === "boolean") return false;
        if (type === "null") return null;
        return "string";
      }
      function sampleRequestSchema(schema) {
        return sampleSchema(schema, true);
      }
      function sampleResponseSchema(schema) {
        return sampleSchema(schema, false);
      }
      const $ = (id) => document.getElementById(id);
      const escapeHtml = (text) =>
        String(text).replace(
          /[&<>"']/g,
          (char) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[char],
        );
      function typeLabel(schema) {
        if (schema.oneOf) return schema.oneOf.map(typeLabel).join(" | ");
        if (schema.type === "array")
          return "array<" + typeLabel(schema.items) + ">";
        if (Array.isArray(schema.type)) return schema.type.join(" | ");
        return schema.type || "any";
      }
      function renderFields(schema, query = "", path = "") {
        const rows = Object.entries(schema.properties || {})
          .map(([name, field]) => {
            const fullPath = path ? path + "." + name : name;
            const children = [];
            if (field.properties) children.push(field);
            if (field.items) children.push(field.items);
            if (field.oneOf)
              children.push(
                ...field.oneOf.map((branch) => branch.items || branch),
              );
            const nested = children
              .map((child) => renderFields(child, query, fullPath))
              .join("");
            const matches = (fullPath + " " + (field.description || ""))
              .toLowerCase()
              .includes(query);
            if (query && !matches && !nested) return "";
            const constraints = [];
            if (field.enum) constraints.push("\u679A\u4E3E: " + field.enum.join(" \xB7 "));
            if (field.items?.enum)
              constraints.push("\u5143\u7D20\u679A\u4E3E: " + field.items.enum.join(" \xB7 "));
            for (const branch of field.oneOf || [])
              if (branch.enum)
                constraints.push("\u679A\u4E3E: " + branch.enum.join(" \xB7 "));
            if ("minimum" in field) constraints.push("\u6700\u5C0F: " + field.minimum);
            if ("maximum" in field) constraints.push("\u6700\u5927: " + field.maximum);
            if (field.examples)
              constraints.push("\u793A\u4F8B: " + field.examples.join(", "));
            if (field.additionalProperties)
              constraints.push(
                "\u52A8\u6001\u952E\u503C: " + typeLabel(field.additionalProperties),
              );
            const allNested =
              query && matches
                ? children
                    .map((child) => renderFields(child, "", fullPath))
                    .join("")
                : nested;
            return (
              '<tr><th scope="row"><code>' +
              escapeHtml(name) +
              "</code></th><td><code>" +
              escapeHtml(typeLabel(field)) +
              "</code></td><td>" +
              ((schema.required || []).includes(name)
                ? '<span class="required">\u662F</span>'
                : "\u2014") +
              "</td><td>" +
              ("default" in field
                ? "<code>" +
                  escapeHtml(JSON.stringify(field.default)) +
                  "</code>"
                : "\u2014") +
              "</td><td>" +
              (field.description ? escapeHtml(field.description) : "\u2014") +
              constraints
                .map(
                  (item) =>
                    '<div class="schema-meta">' + escapeHtml(item) + "</div>",
                )
                .join("") +
              "</td></tr>" +
              (allNested
                ? '<tr class="schema-child-row"><td colspan="5"><details class="schema-children"' +
                  (query ? " open" : "") +
                  "><summary>" +
                  escapeHtml(name) +
                  " \xB7 \u5B50\u5B57\u6BB5</summary>" +
                  allNested +
                  "</details></td></tr>"
                : "")
            );
          })
          .join("");
        if (!rows) return "";
        return (
          '<div class="schema-scroll" tabindex="0" role="region" aria-label="' +
          escapeHtml(path || "\u53C2\u6570") +
          '\u5B57\u6BB5\u8868"><table class="schema-table"><colgroup><col><col><col><col><col></colgroup><thead><tr><th scope="col">\u540D\u79F0</th><th scope="col">\u7C7B\u578B</th><th scope="col">\u5FC5\u586B</th><th scope="col">\u9ED8\u8BA4\u503C</th><th scope="col">\u8BF4\u660E</th></tr></thead><tbody>' +
          rows +
          "</tbody></table></div>"
        );
      }
      function highlightJson(text) {
        return text.replace(
          /"(?:\\\\.|[^"\\\\])*"\\s*:|"(?:\\\\.|[^"\\\\])*"|\\b(?:true|false|null)\\b|-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b/g,
          (token) => {
            let kind = "number";
            if (token.startsWith('"'))
              kind = token.endsWith(":") ? "key" : "string";
            else if (["true", "false", "null"].includes(token))
              kind = "literal";
            return (
              '<span class="token-' +
              kind +
              '">' +
              escapeHtml(token) +
              "</span>"
            );
          },
        );
      }
      const codeKeywords = {
        curl: ["curl", "POST", "GET", "PUT", "PATCH", "DELETE"],
        javascript: [
          "async", "await", "const", "let", "var", "function", "return",
          "if", "else", "for", "while", "new", "class", "import", "from",
        ],
        go: [
          "package", "import", "func", "var", "const", "type", "struct",
          "interface", "return", "if", "else", "for", "range", "defer", "go",
        ],
        python: [
          "import", "from", "as", "def", "return", "if", "elif", "else",
          "for", "while", "in", "try", "except", "finally", "with", "class",
        ],
        java: [
          "import", "class", "interface", "public", "private", "protected",
          "static", "final", "var", "new", "try", "catch", "throws", "return",
        ],
        csharp: [
          "using", "namespace", "class", "interface", "public", "private",
          "protected", "static", "readonly", "var", "new", "await", "async",
          "try", "catch", "return",
        ],
      };
      function highlightCode(text, codeLanguage) {
        const keywords = new Set(codeKeywords[codeLanguage] || []);
        const literals = new Set([
          "true", "false", "null", "nil", "None", "True", "False",
        ]);
        const pattern = /"""[\\s\\S]*?"""|'''[\\s\\S]*?'''|\\x60(?:\\\\[\\s\\S]|[^\\x60])*\\x60|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*|#[^\\n]*|-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b|\\b[A-Za-z_$][\\w$]*\\b/g;
        let html = "";
        let index = 0;
        for (const match of text.matchAll(pattern)) {
          html += escapeHtml(text.slice(index, match.index));
          const token = match[0];
          let kind = "";
          if (/^["'\\x60]/.test(token)) kind = "string";
          else if (/^(?:\\/\\/|\\/\\*|#)/.test(token)) kind = "comment";
          else if (/^-?\\d/.test(token)) kind = "number";
          else if (literals.has(token)) kind = "literal";
          else if (keywords.has(token)) kind = "keyword";
          else if (/^[A-Za-z_$]/.test(token) && /^\\s*\\(/.test(text.slice(match.index + token.length)))
            kind = "function";
          html += kind
            ? '<span class="token-' + kind + '">' + escapeHtml(token) + "</span>"
            : escapeHtml(token);
          index = match.index + token.length;
        }
        return html + escapeHtml(text.slice(index));
      }
      let body = structuredClone(defaultRequest);
      let language = "curl";
      let responseKind = Object.keys(operation.responses)[0];
      let requestCode = "";
      let responseCode = "";
      let toastTimer;
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      );
      const disclosureAnimations = new Map();
      function animateDisclosure(details, open) {
        const start = details.getBoundingClientRect().height;
        disclosureAnimations.get(details)?.cancel();
        disclosureAnimations.delete(details);
        delete details.dataset.targetOpen;
        if (reducedMotion.matches || !details.animate) {
          details.open = open;
          return;
        }
        details.open = open;
        const end = details.getBoundingClientRect().height;
        details.open = true;
        const animation = details.animate(
          [
            { height: start + "px", overflow: "hidden" },
            { height: end + "px", overflow: "hidden" },
          ],
          { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" },
        );
        disclosureAnimations.set(details, animation);
        details.dataset.targetOpen = String(open);
        animation.onfinish = () => {
          details.open = open;
          disclosureAnimations.delete(details);
          delete details.dataset.targetOpen;
        };
      }
      function animateContent(element) {
        element.getAnimations().forEach((animation) => animation.cancel());
        if (reducedMotion.matches) return;
        element.animate(
          [
            { opacity: 0.35, transform: "translateY(4px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 180, easing: "ease-out" },
        );
      }
      document.addEventListener("click", (event) => {
        const summary = event.target.closest("summary");
        if (!summary || event.defaultPrevented) return;
        const details = summary.parentElement;
        if (details.tagName !== "DETAILS") return;
        event.preventDefault();
        const open =
          details.dataset.targetOpen === undefined
            ? details.open
            : details.dataset.targetOpen === "true";
        animateDisclosure(details, !open);
      });
      reducedMotion.addEventListener("change", () => {
        if (!reducedMotion.matches) return;
        disclosureAnimations.forEach((animation) => animation.finish());
        document.getAnimations().forEach((animation) => animation.finish());
      });
      function notify(text) {
        clearTimeout(toastTimer);
        $("toast").textContent = text;
        $("toast").classList.add("is-visible");
        toastTimer = setTimeout(() => {
          $("toast").classList.remove("is-visible");
        }, 3000);
      }
      async function copy(text) {
        try {
          if (navigator.clipboard && window.isSecureContext)
            await navigator.clipboard.writeText(text);
          else {
            const previous = document.activeElement;
            const area = document.createElement("textarea");
            area.value = text;
            area.style.cssText = "position:fixed;left:-9999px";
            document.body.append(area);
            area.select();
            const success = document.execCommand("copy");
            area.remove();
            previous?.focus();
            if (!success) throw new Error("clipboard unavailable");
          }
          notify("\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F");
        } catch {
          notify("\u6D4F\u89C8\u5668\u672A\u5141\u8BB8\u590D\u5236\uFF0C\u8BF7\u9009\u4E2D\u4EE3\u7801\u540E\u624B\u52A8\u590D\u5236\u3002");
        }
      }
// Mirrors fumadocs-openapi 10.1.0 request generators used by new-api-docs-v1.
function indentCode(code, tab = 1) {
  return code
    .split("\\n")
    .map((line) => "  ".repeat(tab) + line)
    .join("\\n");
}
function delimitedString(value, delimiter) {
  return delimiter + value.replaceAll(delimiter, "\\\\" + delimiter) + delimiter;
}
function updateRequest() {
  const json = JSON.stringify(body, null, 2);
  const quote = JSON.stringify;
  const headers = { ...requestHeaders };
  if (language === "curl") {
    const lines = ["curl -X " + httpMethod + ' "' + endpoint + '"'];
    for (const [name, value] of Object.entries(requestHeaders))
      lines.push('-H "' + name + ": " + value + '"');
    lines.push('-H "Content-Type: application/json"');
    lines.push("-d " + delimitedString(json, "'"));
    requestCode = lines
      .map((line, index) => indentCode(line, index > 0 ? 1 : 0))
      .join(" " + String.fromCharCode(92) + "\\n");
  }
  if (language === "javascript") {
    const javascriptHeaders = {
      "Content-Type": "application/json",
      ...headers,
    };
    const options = [
      "method: " + quote(httpMethod),
      "headers: " + JSON.stringify(javascriptHeaders, null, 2),
      "body",
    ];
    requestCode =
      "const body = JSON.stringify(" + json + ")\\n\\nfetch(" +
      quote(endpoint) + ", {\\n" +
      options.map((option) => indentCode(option)).join(",\\n") +
      "\\n})";
  }
  if (language === "python") {
    const pythonHeaderValues = {
      "Content-Type": "application/json",
      ...headers,
    };
    const pythonHeaders =
      "{\\n" +
      Object.entries(pythonHeaderValues)
        .map(([name, value]) => "  " + quote(name) + ": " + quote(value))
        .join(", \\n") +
      "\\n}";
    requestCode =
      "import requests\\n\\nurl = " + quote(endpoint) +
      "\\nbody = " + delimitedString(json, '\"\"\"') +
      "\\nresponse = requests.request(" + quote(httpMethod) +
      ", url, data = body, headers = " + pythonHeaders +
      ")\\n\\nprint(response.text)";
  }
  if (language === "go") {
    const goHeaders = new Map(Object.entries(requestHeaders));
    goHeaders.set("Content-Type", "application/json");
    requestCode =
      'package main\\n\\nimport (\\n  "fmt"\\n  "net/http"\\n  "io/ioutil"\\n  "strings"\\n)\\n\\nfunc main() {\\n' +
      "  url := " + quote(endpoint) +
      "\\n  body := strings.NewReader(" + delimitedString(json, String.fromCharCode(96)) +
      ")\\n  req, _ := http.NewRequest(" + quote(httpMethod) + ", url, body)\\n" +
      indentCode([...goHeaders].map(([name, value]) =>
        'req.Header.Add("' + name + '", ' + quote(value) + ")").join("\\n")) +
      "\\n  res, _ := http.DefaultClient.Do(req)\\n  defer res.Body.Close()\\n  body, _ := ioutil.ReadAll(res.Body)\\n\\n  fmt.Println(res)\\n  fmt.Println(string(body))\\n}";
  }
  if (language === "java") {
    const javaHeaders = new Map(Object.entries(requestHeaders));
    javaHeaders.set("Content-Type", "application/json");
    requestCode =
      "import java.net.URI;\\nimport java.net.http.HttpClient;\\nimport java.net.http.HttpRequest;\\nimport java.net.http.HttpResponse;\\nimport java.net.http.HttpResponse.BodyHandlers;\\nimport java.time.Duration;\\nimport java.net.http.HttpRequest.BodyPublishers;\\n\\n" +
      "var body = BodyPublishers.ofString(" + delimitedString(json, '\"\"\"') +
      ");\\nHttpClient client = HttpClient.newBuilder()\\n  .connectTimeout(Duration.ofSeconds(10))\\n  .build();\\n\\nHttpRequest.Builder requestBuilder = HttpRequest.newBuilder()\\n  .uri(URI.create(" +
      quote(endpoint) + "))\\n" +
      [...javaHeaders].map(([name, value]) =>
        "  .header(" + quote(name) + ", " + quote(value) + ")").join("\\n") +
      "\\n  ." + httpMethod.toUpperCase() +
      "(body)\\n  .build();\\n\\ntry {\\n  HttpResponse<String> response = client.send(requestBuilder.build(), BodyHandlers.ofString());\\n  System.out.println(" +
      quote("Status code: ") +
      " + response.statusCode());\\n  System.out.println(" +
      quote("Response body: ") +
      " + response.body());\\n} catch (Exception e) {\\n  e.printStackTrace();\\n}";
  }
  if (language === "csharp") {
    const csharpHeaders = Object.entries(requestHeaders).map(([name, value]) =>
      'client.DefaultRequestHeaders.Add("' + name + '", ' + quote(value) + ");").join("\\n");
    const method = httpMethod[0].toUpperCase() +
      httpMethod.slice(1).toLowerCase() + "Async";
    requestCode =
      "using System;\\nusing System.Net.Http;\\nusing System.Text;\\n\\nvar body = new StringContent(" +
      delimitedString("\\n" + json + "\\n", '\"\"\"') +
      ', Encoding.UTF8, "application/json");\\n\\nvar client = new HttpClient();\\n' +
      (csharpHeaders ? csharpHeaders + "\\n" : "") +
      "var response = await client." + method + '("' + endpoint +
      '", body);\\nvar responseBody = await response.Content.ReadAsStringAsync();';
  }
  $("request-code").innerHTML = highlightCode(requestCode, language);
}
      function updateResponse() {
        const response = operation.responses[responseKind];
        const media = response.content?.["application/json"];
        const schema = media?.schema || {};
        let example = media?.example;
        if (example === undefined && media?.examples) example = Object.values(media.examples)[0]?.value;
        if (example === undefined && media) example = sampleResponseSchema(schema);
        responseCode = example === undefined ? response.description || "\u65E0\u54CD\u5E94\u4F53" : JSON.stringify(example, null, 2);
        $("response-code").innerHTML = highlightJson(responseCode);
        $("response-fields").innerHTML = renderFields(schema) || "<p>" + escapeHtml(response.description || "\u65E0\u5B57\u6BB5\u5B9A\u4E49") + "</p>";
        document.querySelector("#responses .badge").textContent = responseKind;
      }
      const formNodes = new Map();
      function requestValueError(schema, value, path = "body") {
        if (schema.oneOf)
          return schema.oneOf.some(
            (branch) => !requestValueError(branch, value, path),
          )
            ? ""
            : path + " \u7684\u503C\u4E0D\u7B26\u5408\u53EF\u9009\u7C7B\u578B";
        if (schema.type === "array") {
          if (!Array.isArray(value)) return path + " \u5FC5\u987B\u662F\u6570\u7EC4";
          for (let index = 0; index < value.length; index++) {
            const error = requestValueError(
              schema.items,
              value[index],
              path + "[" + index + "]",
            );
            if (error) return error;
          }
          return "";
        }
        if (schema.type === "object") {
          if (!value || Array.isArray(value) || typeof value !== "object")
            return path + " \u5FC5\u987B\u662F\u5BF9\u8C61";
          for (const key of schema.required || [])
            if (!Object.hasOwn(value, key))
              return path + "." + key + " \u4E3A\u5FC5\u586B\u5B57\u6BB5";
          for (const [key, item] of Object.entries(value)) {
            const child = Object.hasOwn(schema.properties || {}, key)
              ? schema.properties[key]
              : schema.additionalProperties;
            if (!child || typeof child !== "object") continue;
            const error = requestValueError(child, item, path + "." + key);
            if (error) return error;
          }
          return "";
        }
        if (schema.type === "number" || schema.type === "integer") {
          if (typeof value !== "number" || !Number.isFinite(value))
            return path + " \u5FC5\u987B\u662F\u6709\u9650\u6570\u5B57";
          if (schema.type === "integer" && !Number.isSafeInteger(value))
            return path + " \u5FC5\u987B\u662F\u5B89\u5168\u8303\u56F4\u5185\u7684\u6574\u6570";
          if (schema.minimum !== undefined && value < schema.minimum)
            return path + " \u4E0D\u80FD\u5C0F\u4E8E " + schema.minimum;
          if (schema.maximum !== undefined && value > schema.maximum)
            return path + " \u4E0D\u80FD\u5927\u4E8E " + schema.maximum;
        } else if (typeof value !== schema.type)
          return path + " \u5FC5\u987B\u662F " + schema.type;
        if (schema.enum && !schema.enum.includes(value))
          return path + " \u4E0D\u5728\u5141\u8BB8\u7684\u679A\u4E3E\u8303\u56F4\u5185";
        return "";
      }
      function initialValue(schema) {
        if (schema.oneOf) return initialValue(schema.oneOf[0]);
        if (schema.type === "object")
          return Object.fromEntries(
            (schema.required || []).map((key) => [
              key,
              initialValue(schema.properties[key]),
            ]),
          );
        if (schema.type === "array") return [];
        if (schema.type === "boolean") return false;
        if (schema.type === "number" || schema.type === "integer")
          return schema.default ?? schema.minimum ?? 0;
        return schema.examples?.[0] ?? schema.enum?.[0] ?? "";
      }
      function renderBodyField(schema, value, path, required = false) {
        const id = "body-" + formNodes.size;
        formNodes.set(id, { schema, path, required });
        const title =
          escapeHtml(String(path.at(-1))) +
          (required ? ' <span class="required">*</span>' : "");
        const label =
          '<label for="' +
          id +
          '"><span>' +
          title +
          '</span><span class="caption">' +
          escapeHtml(typeLabel(schema)) +
          "</span></label>";
        const attributes =
          ' id="' +
          id +
          '" data-field="' +
          id +
          '" aria-describedby="' +
          id +
          '-error"';
        const error =
          '<p class="body-error" id="' + id + '-error" role="status"></p>';
        const unset =
          !required && !Number.isInteger(path.at(-1))
            ? '<button type="button" data-action="unset" data-node="' +
              id +
              '">\u53D6\u6D88\u8BBE\u7F6E</button>'
            : "";
        if (schema.oneOf) {
          let branch = schema.oneOf.findIndex(
            (item) =>
              item.type === (Array.isArray(value) ? "array" : typeof value),
          );
          if (branch < 0) branch = 0;
          return (
            '<div class="body-field body-wide body-union">' +
            label +
            '<div class="body-union-controls">' +
            '<select data-branch="' +
            id +
            '" id="' +
            id +
            '">' +
            schema.oneOf
              .map(
                (item, index) =>
                  '<option value="' +
                  index +
                  '"' +
                  (branch === index ? " selected" : "") +
                  ">" +
                  escapeHtml(typeLabel(item)) +
                  "</option>",
              )
              .join("") +
            "</select>" +
            renderBodyField(schema.oneOf[branch], value, path, required) +
            "</div></div>"
          );
        }
        if (
          (schema.type === "object" &&
            Object.keys(schema.properties || {}).length) ||
          schema.type === "array"
        ) {
          let inner = "";
          if (value !== undefined) {
            if (schema.type === "array")
              inner = value
                .map(
                  (item, index) =>
                    '<div class="body-wide body-array-item">' +
                    renderBodyField(
                      schema.items,
                      item,
                      [...path, index],
                      true,
                    ) +
                    '<div class="body-tools"><button type="button" data-action="remove" data-node="' +
                    id +
                    '" data-index="' +
                    index +
                    '">\u5220\u9664\u7B2C ' +
                    (index + 1) +
                    " \u9879</button></div></div>",
                )
                .join("");
            else
              inner = Object.entries(schema.properties)
                .map(([key, field]) =>
                  renderBodyField(
                    field,
                    value[key],
                    [...path, key],
                    (schema.required || []).includes(key),
                  ),
                )
                .join("");
          }
          let action = "";
          if (value === undefined)
            action =
              '<button type="button" data-action="enable" data-node="' +
              id +
              '">\u8BBE\u7F6E ' +
              escapeHtml(String(path.at(-1))) +
              "</button>";
          else if (schema.type === "array")
            action =
              '<button type="button" data-action="add" data-node="' +
              id +
              '">\u6DFB\u52A0\u4E00\u9879</button>';
          return (
            '<details class="body-field body-wide body-group" data-path="' +
            escapeHtml(JSON.stringify(path)) +
            '"' +
            (value !== undefined ? " open" : "") +
            "><summary>" +
            title +
            ' <span class="caption">' +
            escapeHtml(typeLabel(schema)) +
            '</span></summary><div class="body-grid">' +
            inner +
            '</div><div class="body-tools">' +
            action +
            unset +
            "</div></details>"
          );
        }
        let input;
        if (schema.type === "boolean" || schema.enum) {
          const options = schema.enum || [true, false];
          input =
            "<select" +
            attributes +
            '><option value="">\u672A\u8BBE\u7F6E</option>' +
            options
              .map(
                (item) =>
                  '<option value="' +
                  escapeHtml(String(item)) +
                  '"' +
                  (value === item ? " selected" : "") +
                  ">" +
                  escapeHtml(String(item)) +
                  "</option>",
              )
              .join("") +
            "</select>";
        } else if (schema.type === "object") {
          input =
            "<textarea" +
            attributes +
            ' spellcheck="false" placeholder="JSON \u5BF9\u8C61">' +
            escapeHtml(
              value === undefined ? "" : JSON.stringify(value, null, 2),
            ) +
            "</textarea>";
        } else if (
          schema.type === "string" &&
          (path.at(-1) === "content" || String(value ?? "").includes("\\n"))
        ) {
          input =
            "<textarea" +
            attributes +
            ' placeholder="\u6D88\u606F\u5185\u5BB9">' +
            escapeHtml(value ?? "") +
            "</textarea>";
        } else {
          const numeric = ["number", "integer"].includes(schema.type);
          input =
            "<input" +
            attributes +
            ' type="' +
            (numeric ? "number" : "text") +
            '"' +
            (numeric
              ? ' step="' + (schema.type === "integer" ? "1" : "any") + '"'
              : "") +
            ' value="' +
            escapeHtml(value ?? "") +
            '" placeholder="\u672A\u8BBE\u7F6E"' +
            (schema.minimum !== undefined
              ? ' min="' + schema.minimum + '"'
              : "") +
            (schema.maximum !== undefined
              ? ' max="' + schema.maximum + '"'
              : "") +
            ">";
        }
        return (
          '<div class="body-field' +
          (schema.type === "object" ? " body-wide" : "") +
          '">' +
          label +
          '<div class="body-value">' +
          input +
          error +
          (unset ? '<div class="body-tools">' + unset + "</div>" : "") +
          "</div></div>"
        );
      }
      function renderBodyForm() {
        const opened = new Map(
          [...$("body-form").querySelectorAll("details[data-path]")].map(
            (item) => [item.dataset.path, item.open],
          ),
        );
        formNodes.clear();
        const common = new Set(requestSchema.required || []);
        let mainFields = "";
        let advancedFields = "";
        for (const [key, schema] of Object.entries(requestSchema.properties)) {
          const field = renderBodyField(
            schema,
            body[key],
            [key],
            (requestSchema.required || []).includes(key),
          );
          if (common.has(key)) mainFields += field;
          else advancedFields += field;
        }
        const configuredAdvanced = Object.keys(body).filter(
          (key) => !common.has(key),
        ).length;
        $("body-form").innerHTML =
          '<div class="body-subheading"><span>\u5FC5\u586B\u53C2\u6570</span></div>' +
          mainFields +
          '<details class="advanced-fields" data-path="advanced"' +
          (configuredAdvanced ? " open" : "") +
          '><summary>\u66F4\u591A\u53C2\u6570 <span class="caption">\u6309\u9700\u8BBE\u7F6E\u53EF\u9009\u5B57\u6BB5</span></summary><div class="body-grid">' +
          advancedFields +
          "</div></details>";
        $("body-form")
          .querySelectorAll("details[data-path]")
          .forEach((item) => {
            if (opened.has(item.dataset.path))
              item.open = opened.get(item.dataset.path);
          });
      }
      function setBodyValue(path, value) {
        let parent = body;
        for (const key of path.slice(0, -1)) parent = parent[key];
        const key = path.at(-1);
        if (value === undefined) delete parent[key];
        else
          Object.defineProperty(parent, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true,
          });
        $("json-editor").value = JSON.stringify(body, null, 2);
        $("editor-error").textContent = "";
        updateRequest();
      }
      $("body-form").addEventListener("input", (event) => {
        const input = event.target;
        if (!input.dataset.field) return;
        const node = formNodes.get(input.dataset.field);
        try {
          let value = input.value;
          if (input.validity.badInput) throw new Error("\u8BF7\u8F93\u5165\u6709\u6548\u6570\u5B57");
          if (node.schema.type === "boolean")
            value = value === "" ? undefined : value === "true";
          else if (["number", "integer"].includes(node.schema.type)) {
            value = value === "" ? undefined : Number(value);
            if (
              value !== undefined &&
              (!Number.isFinite(value) || !input.validity.valid)
            )
              throw new Error("\u8BF7\u8F93\u5165\u7B26\u5408\u8303\u56F4\u548C\u7C7B\u578B\u7684\u6570\u5B57");
          } else if (node.schema.type === "object") {
            value = value.trim() === "" ? undefined : JSON.parse(value);
            if (
              value !== undefined &&
              (!value || Array.isArray(value) || typeof value !== "object")
            )
              throw new Error("\u8BF7\u8F93\u5165 JSON \u5BF9\u8C61");
          } else if (node.schema.enum && value === "") value = undefined;
          if (node.required && value === undefined)
            throw new Error("\u6B64\u5B57\u6BB5\u4E3A\u5FC5\u586B");
          if (value !== undefined) {
            const error = requestValueError(
              node.schema,
              value,
              node.path.join("."),
            );
            if (error) throw new Error(error);
          }
          setBodyValue(node.path, value);
          input.setAttribute("aria-invalid", "false");
          $(input.id + "-error").textContent = "";
        } catch (error) {
          input.setAttribute("aria-invalid", "true");
          $(input.id + "-error").textContent = error.message;
        }
      });
      $("body-form").addEventListener("change", (event) => {
        const select = event.target;
        if (!select.dataset.branch) return;
        const node = formNodes.get(select.dataset.branch);
        if ($("body-form").querySelector('[aria-invalid="true"]')) {
          const value = node.path.reduce((current, key) => current[key], body);
          select.value = String(
            Math.max(
              0,
              node.schema.oneOf.findIndex(
                (branch) =>
                  branch.type ===
                  (Array.isArray(value) ? "array" : typeof value),
              ),
            ),
          );
          notify("\u8BF7\u5148\u4FEE\u6B63\u8F93\u5165\u9519\u8BEF\u540E\u518D\u5207\u6362\u7C7B\u578B");
          return;
        }
        setBodyValue(
          node.path,
          initialValue(node.schema.oneOf[Number(select.value)]),
        );
        renderBodyForm();
      });
      $("body-form").addEventListener("click", (event) => {
        const button = event.target.closest("[data-action]");
        if (!button) return;
        if ($("body-form").querySelector('[aria-invalid="true"]')) {
          notify("\u8BF7\u5148\u4FEE\u6B63\u8F93\u5165\u9519\u8BEF");
          return;
        }
        const node = formNodes.get(button.dataset.node);
        let value = node.path.reduce((current, key) => current[key], body);
        if (button.dataset.action === "unset") value = undefined;
        if (button.dataset.action === "enable")
          value = initialValue(node.schema);
        if (button.dataset.action === "add")
          value = [...value, initialValue(node.schema.items)];
        if (button.dataset.action === "remove")
          value = value.filter(
            (_, index) => index !== Number(button.dataset.index),
          );
        setBodyValue(node.path, value);
        renderBodyForm();
        animateContent($("body-form"));
      });
      function resetRequest() {
        body = structuredClone(defaultRequest);
        $("json-editor").value = JSON.stringify(body, null, 2);
        $("editor-error").textContent = "";
        renderBodyForm();
        updateRequest();
      }
      $("base-url").value = baseUrl;
      $("base-url").addEventListener("input", () => {
        const value = $("base-url").value.trim();
        try {
          const parsed = new URL(value);
          if (!['http:', 'https:'].includes(parsed.protocol))
            throw new Error("unsupported protocol");
          if (parsed.search || parsed.hash)
            throw new Error("query and hash are not supported");
          baseUrl = parsed.href.endsWith("/")
            ? parsed.href.slice(0, -1)
            : parsed.href;
          endpoint = baseUrl + apiPath;
          $("base-url").removeAttribute("aria-invalid");
          $("base-url-error").textContent = "";
        } catch {
          baseUrl = value;
          endpoint = placeholderBaseUrl + apiPath;
          $("base-url").setAttribute("aria-invalid", "true");
          $("base-url-error").textContent =
            "请输入以 http:// 或 https:// 开头且不含查询参数的有效 URL。";
        }
        updateRequest();
      });
      $("api-key")?.addEventListener("input", (event) => {
        const apiKey = event.currentTarget.value.trim();
        requestHeaders.Authorization =
          "Bearer " + (apiKey || "YOUR_API_KEY");
        updateRequest();
      });
      $("request-fields").innerHTML = renderFields(requestSchema);
      
      $("search").addEventListener("input", () => {
        $("request-fields").innerHTML =
          renderFields(requestSchema, $("search").value.trim().toLowerCase()) ||
          '<div class="empty">\u6CA1\u6709\u5339\u914D\u7684\u53C2\u6570</div>';
        animateContent($("request-fields"));
      });
      $("language-tabs").addEventListener("click", (event) => {
        const button = event.target.closest("[data-language]");
        if (!button) return;
        language = button.dataset.language;
        document
          .querySelectorAll("[data-language]")
          .forEach((item) =>
            item.setAttribute("aria-pressed", String(item === button)),
          );
        updateRequest();
      });
      $("response-tabs").addEventListener("click", (event) => {
        const button = event.target.closest("[data-response]");
        if (!button) return;
        responseKind = button.dataset.response;
        document
          .querySelectorAll("[data-response]")
          .forEach((item) =>
            item.setAttribute("aria-pressed", String(item === button)),
          );
        updateResponse();
      });
      $("reset-json").addEventListener("click", resetRequest);
      $("apply-json").addEventListener("click", () => {
        try {
          const parsed = JSON.parse($("json-editor").value);
          if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
            throw new Error("\u8BF7\u6C42\u6B63\u6587\u5FC5\u987B\u662F JSON \u5BF9\u8C61\u3002");
          const schemaError = requestValueError(requestSchema, parsed);
          if (schemaError) throw new Error(schemaError);
          body = parsed;
          renderBodyForm();
          $("json-editor").value = JSON.stringify(body, null, 2);
          $("editor-error").textContent = "";
          updateRequest();
          notify("\u5DF2\u540C\u6B65\u8868\u5355\u548C\u8BF7\u6C42\u793A\u4F8B");
        } catch (error) {
          $("editor-error").textContent = "\u65E0\u6CD5\u5E94\u7528\uFF1A" + error.message;
        }
      });
      function switchBodyMode(jsonMode) {
        if (jsonMode && $("body-form").querySelector('[aria-invalid="true"]')) {
          notify("\u8BF7\u5148\u4FEE\u6B63\u8868\u5355\u4E2D\u7684\u9519\u8BEF\uFF0C\u518D\u5207\u6362\u5230 JSON");
          $("body-form").querySelector('[aria-invalid="true"]').focus();
          return;
        }
        if (
          !jsonMode &&
          !$("json-panel").hidden &&
          $("json-editor").value !== JSON.stringify(body, null, 2)
        ) {
          $("apply-json").click();
          if ($("editor-error").textContent) {
            $("json-editor").focus();
            return;
          }
        }
        $("json-panel").hidden = !jsonMode;
        $("body-form").hidden = jsonMode;
        $("body-json").setAttribute("aria-pressed", String(jsonMode));
        $("body-fields").setAttribute("aria-pressed", String(!jsonMode));
        animateContent(jsonMode ? $("json-panel") : $("body-form"));
      }
      $("body-json").addEventListener("click", () => switchBodyMode(true));
      $("body-fields").addEventListener("click", () => switchBodyMode(false));
      $("code-wrap").addEventListener("click", () => {
        const wrap = $("code-wrap").getAttribute("aria-pressed") !== "true";
        $("code-wrap").setAttribute("aria-pressed", String(wrap));
        $("code-wrap").textContent = wrap ? "\u6A2A\u5411\u6EDA\u52A8" : "\u81EA\u52A8\u6362\u884C";
        $("examples").dataset.wrap = String(wrap);
      });
      $("copy-path").addEventListener("click", () =>
        copy(apiPath),
      );
      $("copy-request").addEventListener("click", () => {
        if (requestCode) copy(requestCode);
        else notify("\u8BF7\u5148\u586B\u5199\u6709\u6548\u7684 Base URL\u3002");
      });
      $("copy-response").addEventListener("click", () => copy(responseCode));
      const narrowEmbed = window.matchMedia("(max-width:700px)");
      $("outline").open = !narrowEmbed.matches;
      narrowEmbed.addEventListener("change", () => {
        animateDisclosure($("outline"), !narrowEmbed.matches);
      });
      function updateOutline() {
        const current = window.location.hash || "#overview";
        document.querySelectorAll(".outline a").forEach((link) => {
          if (link.getAttribute("href") === current)
            link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      }
      window.addEventListener("hashchange", updateOutline);
      updateOutline();
      resetRequest();
      updateResponse();
    </script>
  </body>
</html>
`;

// docs/generate-api-doc.mjs
var escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[char]);
var scriptJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
function resolveDocument(value, document, refs = []) {
  if (!value || typeof value !== "object")
    return value;
  if (Array.isArray(value))
    return value.map((item) => resolveDocument(item, document, refs));
  if (value.$ref) {
    const ref = value.$ref;
    if (!ref.startsWith("#/"))
      throw new Error(`\u6682\u4E0D\u652F\u6301\u5916\u90E8\u5F15\u7528\uFF1A${ref}`);
    if (refs.includes(ref))
      throw new Error(`\u6682\u4E0D\u652F\u6301\u5FAA\u73AF\u5F15\u7528\uFF1A${ref}`);
    let target = document;
    for (const key of decodeURIComponent(ref.slice(2)).split("/")) {
      const decoded = key.replaceAll("~1", "/").replaceAll("~0", "~");
      if (!target || !Object.hasOwn(target, decoded))
        throw new Error(`\u65E0\u6CD5\u89E3\u6790\u5F15\u7528\uFF1A${ref}`);
      target = target[decoded];
    }
    const { $ref, ...siblings } = value;
    return resolveDocument({ ...target, ...siblings }, document, [...refs, $ref]);
  }
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveDocument(item, document, refs)]));
  if (result.properties) {
    const keys = [...new Set([...result["x-apifox-orders"] || [], ...Object.keys(result.properties)])];
    result.properties = Object.fromEntries(keys.filter((key) => Object.hasOwn(result.properties, key)).map((key) => [key, result.properties[key]]));
  }
  return result;
}
async function generate(input, output) {
  const source = (await readFile(input, "utf8")).replace(/^\uFEFF/, "").trim();
  if (!source)
    throw new Error("\u8BF7\u5148\u5C06 OpenAPI JSON \u7C98\u8D34\u5230\u811A\u672C\u65C1\u7684 api-doc.json \u6587\u4EF6\u4E2D\uFF0C\u518D\u8FD0\u884C\u811A\u672C\u3002");
  const document = JSON.parse(source);
  if (!(document.openapi || "").startsWith("3."))
    throw new Error("\u8BF7\u8F93\u5165 OpenAPI 3.x JSON");
  const operations = [];
  for (const [path2, rawPathItem] of Object.entries(document.paths || {})) {
    const item2 = resolveDocument(rawPathItem, document);
    for (const method2 of ["get", "post", "put", "patch", "delete", "head", "options", "trace"]) {
      if (item2[method2])
        operations.push({ path: path2, method: method2, item: item2, operation: item2[method2] });
    }
  }
  if (operations.length !== 1)
    throw new Error("请在 api-doc.json 中放入一个接口的 OpenAPI 数据。");
  const { path, method, item, operation } = operations[0];
  const media = operation.requestBody?.content?.["application/json"];
  if (!media?.schema || media.schema.type !== "object")
    throw new Error("\u5F53\u524D\u6A21\u677F\u8981\u6C42 application/json \u5BF9\u8C61\u8BF7\u6C42\u4F53");
  if (item.parameters?.length || operation.parameters?.length)
    throw new Error("\u5F53\u524D\u6A21\u677F\u5C1A\u4E0D\u652F\u6301 path/query/header/cookie \u53C2\u6570\uFF0C\u8BF7\u52FF\u5FFD\u7565\u8FD9\u4E9B\u53C2\u6570\u751F\u6210\u6587\u6863");
  const security = operation.security ?? document.security ?? [];
  let scheme;
  let securityName = "";
  if (security.length) {
    if (security.length !== 1 || Object.keys(security[0]).length !== 1)
      throw new Error("\u5F53\u524D\u6A21\u677F\u4EC5\u652F\u6301\u5355\u4E00 Bearer \u8BA4\u8BC1\u6216\u65E0\u8BA4\u8BC1");
    securityName = Object.keys(security[0])[0];
    scheme = resolveDocument(document.components?.securitySchemes?.[securityName], document);
    if (scheme?.type !== "http" || scheme.scheme?.toLowerCase() !== "bearer")
      throw new Error("\u5F53\u524D\u6A21\u677F\u4EC5\u652F\u6301 HTTP Bearer \u8BA4\u8BC1");
  }
  if (!Object.keys(operation.responses || {}).length)
    throw new Error("\u63A5\u53E3\u7F3A\u5C11 responses");
  for (const response of Object.values(operation.responses)) {
    if (response.content && !response.content["application/json"])
      throw new Error("\u5F53\u524D\u6A21\u677F\u4EC5\u652F\u6301 JSON \u54CD\u5E94\u6216\u65E0\u54CD\u5E94\u4F53");
  }
  const title = operation.summary || document.info?.title || operation.operationId || path;
  const data = `const operation = ${scriptJson(operation)};
      const apiPath = ${scriptJson(path)};
      const defaultBaseUrl = "https://";
      const placeholderBaseUrl = "https://URL";
      let baseUrl = defaultBaseUrl;
      let endpoint = placeholderBaseUrl + apiPath;
      const httpMethod = ${scriptJson(method.toUpperCase())};
      const requestHeaders = ${scriptJson(scheme ? { Authorization: "Bearer YOUR_API_KEY" } : {})};
      const requestSchema = operation.requestBody.content["application/json"].schema;
      const defaultRequest = ${media.example !== undefined ? scriptJson(media.example) : Object.values(media.examples || {})[0]?.value !== undefined ? scriptJson(Object.values(media.examples)[0].value) : "sampleRequestSchema(requestSchema)"};`;
  const slots = {
    TITLE: escapeHtml(title),
    INTRO: escapeHtml(operation.description || document.info?.description || ""),
    METHOD: method.toUpperCase(),
    PATH: escapeHtml(path),
    STATUS: escapeHtml(Object.keys(operation.responses)[0]),
    SECURITY: escapeHtml(securityName || "\u65E0\u8BA4\u8BC1"),
    AUTH: scheme ? "Authorization: Bearer YOUR_API_KEY" : "\u6B64\u63A5\u53E3\u672A\u8981\u6C42\u8BA4\u8BC1",
    AUTH_CONTROL: scheme
      ? `<label for="api-key">API Key</label>
                <input
                  id="api-key"
                  type="password"
                  placeholder="YOUR_API_KEY"
                  autocomplete="off"
                  autocapitalize="none"
                  spellcheck="false"
                  aria-describedby="api-key-help"
                />
                <p id="api-key-help">\u4EC5\u7528\u4E8E\u66F4\u65B0\u5F53\u524D\u9875\u9762\u7684\u8BF7\u6C42\u793A\u4F8B\uFF0C\u4E0D\u4F1A\u5B58\u50A8\u6216\u53D1\u9001\u3002</p>`
      : "<p>\u6B64\u63A5\u53E3\u672A\u8981\u6C42\u8BA4\u8BC1\u3002</p>",
    AUTH_DESCRIPTION: escapeHtml(scheme?.description || (scheme ? "\u5728\u8BF7\u6C42\u5934\u4E2D\u643A\u5E26 Bearer Token\u3002" : "OpenAPI \u672A\u58F0\u660E\u8BA4\u8BC1\u8981\u6C42\u3002")),
    AUTH_LOCATION: scheme ? "\u4F4D\u7F6E\uFF1A<code>header</code>" : "",
    RESPONSE_TABS: Object.keys(operation.responses).map((status, index) => `<button data-response="${escapeHtml(status)}" aria-pressed="${index === 0}">${escapeHtml(status)}</button>`).join(""),
    DATA: data
  };
  const html = api_doc_template_default.replace(/%%([A-Z_]+)%%/g, (_, key) => {
    if (!Object.hasOwn(slots, key))
      throw new Error(`\u672A\u77E5\u6A21\u677F\u53D8\u91CF\uFF1A${key}`);
    return slots[key];
  });
  for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g))
    new Script(script, { filename: "api-doc-inline.js" });
  if ([fileURLToPath(new URL("./chat-completions.html", import.meta.url)), resolve(input)].includes(resolve(output)))
    throw new Error("\u8F93\u51FA\u4E0D\u80FD\u8986\u76D6\u53C2\u8003\u9875\u9762\u6216\u8F93\u5165 JSON");
  await writeFile(output, html);
  console.log(`\u5DF2\u751F\u6210 ${output}\uFF1A${method.toUpperCase()} ${path}`);
}
try {
  const input = fileURLToPath(new URL("./api-doc.json", import.meta.url));
  const output = fileURLToPath(new URL("./api-doc.html", import.meta.url));
  await generate(input, output);
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
